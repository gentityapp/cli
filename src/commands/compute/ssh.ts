import { c } from "../../ui/colors";
import { resolveInstanceId } from "../../api/resolve";
import { loadConfig } from "../../config";

interface InboundMsg {
  type: "output" | "exit" | string;
  data?: string;
  exitCode?: number;
  signal?: string;
}

// `gentity compute ssh <id>` — open an interactive shell inside the
// instance's container, terminal-style. Wraps the same WebSocket bridge
// the dashboard's xterm.js view uses (/api/instances/:id/terminal).
// Auth: `?token=gn_live_...` query param (WebSocket headers aren't
// portable across runtimes, query is universal).
//
// Protocol:
//   client → server  { type: "input",  data: "<keystrokes>" }
//                    { type: "resize", cols: N, rows: N }
//   server → client  { type: "output", data: "..." }
//                    { type: "exit",   exitCode, signal }
export async function runComputeSsh(idOrSubdomain: string): Promise<number> {
  const id = await resolveInstanceId(idOrSubdomain);
  const cfg = await loadConfig();
  if (!cfg.token) {
    console.error(c.red("error:"), "Not logged in. Run `gentity login` first.");
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error(c.red("error:"), "ssh needs a real TTY — refusing to run with redirected stdin.");
    return 1;
  }

  // ws(s):// equivalent of the configured https://gentity.ai.
  const wsBase = cfg.apiUrl.replace(/^http/, "ws");
  const url = `${wsBase}/api/instances/${id}/terminal?token=${encodeURIComponent(cfg.token)}`;

  process.stdout.write(c.dim(`Connecting to ${id}…\n`));

  const ws = new WebSocket(url);

  // Stdin in raw mode so keystrokes are forwarded character-by-character
  // (no line buffering, no local echo, Ctrl-C goes through to the agent
  // instead of killing us). Restore on exit no matter how we leave.
  const setRaw = (raw: boolean) => {
    try {
      process.stdin.setRawMode(raw);
    } catch {
      // best-effort; some shells don't expose setRawMode
    }
  };

  let cleanedUp = false;
  const cleanup = (code: number) => {
    if (cleanedUp) return;
    cleanedUp = true;
    setRaw(false);
    process.stdin.pause();
    try {
      ws.close();
    } catch {
      // already closed
    }
    process.exit(code);
  };

  let exitCode = 0;
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  ws.onopen = () => {
    setRaw(true);
    process.stdin.resume();
    // Tell the remote PTY about our current window size so prompts and
    // editors look right from the first keystroke.
    sendResize();
  };

  ws.onmessage = (ev) => {
    try {
      const raw = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
      const msg = JSON.parse(raw) as InboundMsg;
      if (msg.type === "output" && typeof msg.data === "string") {
        process.stdout.write(msg.data);
      } else if (msg.type === "exit") {
        exitCode = msg.exitCode ?? 0;
        // Server is about to close; let onclose finalise.
      }
    } catch {
      // Non-JSON noise — ignore.
    }
  };

  ws.onerror = (e) => {
    const message = (e as { message?: string }).message ?? "connection error";
    process.stderr.write(c.red(`\nws error: ${message}\n`));
    exitCode = 1;
  };

  ws.onclose = (ev) => {
    if (ev.code === 1008 /* policy violation, our 401 path */ || ev.code === 4401) {
      process.stderr.write(c.red("\nauthentication rejected — token may be revoked.\n"));
      exitCode = exitCode || 1;
    } else if (ev.code !== 1000 && ev.code !== 1005 && !cleanedUp) {
      process.stderr.write(c.dim(`\nconnection closed (${ev.code})\n`));
    }
    resolveDone();
  };

  // ── forward local input / signals to the remote PTY ───────────────────
  const onData = (chunk: Buffer) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "input", data: chunk.toString("utf8") }));
  };
  process.stdin.on("data", onData);

  // SIGWINCH only fires when the controlling TTY is resized. We forward
  // a resize message so the remote PTY (and anything inside it like
  // vim / htop) reflows correctly.
  function sendResize() {
    if (ws.readyState !== WebSocket.OPEN) return;
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    ws.send(JSON.stringify({ type: "resize", cols, rows }));
  }
  process.stdout.on("resize", sendResize);

  // SIGTERM / unhandled exit — make sure the TTY isn't left in raw mode.
  const onTerm = () => cleanup(143);
  process.on("SIGTERM", onTerm);
  process.on("SIGHUP", () => cleanup(129));

  await done;
  cleanup(exitCode);
  return exitCode;
}
