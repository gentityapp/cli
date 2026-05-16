import { apiRequest, ApiError } from "../../api/client";
import { c } from "../../ui/colors";
import { resolveInstanceId } from "../../api/resolve";
import { loadConfig } from "../../config";

interface FlyLogLine {
  timestamp?: string;
  message?: string;
  level?: string;
  instance?: string;
  region?: string;
  [k: string]: unknown;
}

interface LogsOpts {
  lines?: number;
  follow?: boolean;
  json?: boolean;
}

// `gentity compute logs <id> [--lines N] [--follow]` — fetch / stream
// Fly Machine logs for the instance's container.
//
// Without --follow: GET the buffered tail (last N lines, default 200) and
// print. Suitable for one-shot scripted use.
//
// With --follow: open an SSE stream to /api/instances/:id/logs?follow=1
// and pipe `data:` events into stdout until the user kills us (Ctrl-C)
// or the stream ends. SSE because:
//   - WebSocket would need its own auth dance (the terminal does it via
//     ?token=) and a separate handler. SSE works over a normal fetch and
//     reuses Bearer auth as-is.
//   - The protocol is line-delimited, which is exactly what we want.
export async function runComputeLogs(idOrSubdomain: string, opts: LogsOpts): Promise<number> {
  const id = await resolveInstanceId(idOrSubdomain);

  if (opts.follow) {
    return streamLogs(id, opts.json === true);
  }
  return tailLogs(id, opts);
}

async function tailLogs(id: string, opts: LogsOpts): Promise<number> {
  const lines = opts.lines ?? 200;
  try {
    const { logs } = await apiRequest<{ logs: FlyLogLine[] }>(
      `/api/instances/${id}/logs?lines=${lines}`,
    );
    if (opts.json) {
      console.log(JSON.stringify(logs, null, 2));
    } else {
      for (const line of logs) printLogLine(line);
    }
    return 0;
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(c.red("error:"), err.message);
    } else {
      console.error(c.red("error:"), err);
    }
    return 1;
  }
}

async function streamLogs(id: string, asJson: boolean): Promise<number> {
  // Hand-roll the SSE consumer over fetch's streaming body so we don't
  // depend on EventSource (Bun has it, Node doesn't, this keeps the binary
  // portable). Reads `data: <jsonline>\n\n` frames until the server emits
  // `event: end` or the user disconnects.
  const cfg = await loadConfig();
  if (!cfg.token) {
    console.error(c.red("error:"), "Not logged in. Run `gentity login` first.");
    return 1;
  }
  const url = `${cfg.apiUrl}/api/instances/${id}/logs?follow=1`;
  const ctrl = new AbortController();
  // Wire SIGINT to abort the fetch so we exit cleanly on Ctrl-C without
  // leaving the connection (and thus the upstream flyctl process) running.
  const onSigint = () => {
    ctrl.abort();
  };
  process.on("SIGINT", onSigint);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "text/event-stream",
        "User-Agent": "gentity-cli/0.0.2",
      },
      signal: ctrl.signal,
    });
  } catch (err) {
    process.off("SIGINT", onSigint);
    if (ctrl.signal.aborted) return 0;
    console.error(c.red("error:"), err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (!res.ok || !res.body) {
    process.off("SIGINT", onSigint);
    console.error(c.red("error:"), `log stream HTTP ${res.status}`);
    return 1;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line ("\n\n").
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        handleFrame(frame, asJson);
      }
    }
  } catch (err) {
    if (!ctrl.signal.aborted) {
      console.error(c.red("\nstream error:"), err instanceof Error ? err.message : String(err));
      process.off("SIGINT", onSigint);
      return 1;
    }
  }
  process.off("SIGINT", onSigint);
  return 0;
}

function handleFrame(frame: string, asJson: boolean) {
  // Each frame is one or more "key: value" lines. We only care about
  // `event:` and `data:` keys; everything else (comments starting with
  // ":", retry instructions, id) is ignored.
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (event === "end") return;
  if (event === "error") {
    console.error(c.red("stream error:"), dataLines.join("\n"));
    return;
  }
  const data = dataLines.join("\n");
  if (!data) return;
  if (asJson) {
    // Pass-through; one JSON object per line preserves grep-friendliness.
    console.log(data);
    return;
  }
  try {
    printLogLine(JSON.parse(data) as FlyLogLine);
  } catch {
    // not parseable JSON — emit raw so nothing is silently dropped
    console.log(data);
  }
}

function printLogLine(line: FlyLogLine) {
  const ts = line.timestamp ? c.dim(formatTs(line.timestamp)) : "";
  const inst = line.instance ? c.dim(`[${line.instance.slice(0, 6)}]`) : "";
  const level = colorLevel(line.level);
  const msg = (line.message ?? "").trimEnd();
  // ts level [inst] message
  const prefix = [ts, level, inst].filter(Boolean).join(" ");
  if (prefix) {
    console.log(`${prefix}  ${msg}`);
  } else {
    console.log(msg);
  }
}

function formatTs(ts: string): string {
  // flyctl emits RFC3339 — trim to HH:MM:SS in the local TZ for readability.
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().slice(11, 19);
}

function colorLevel(level: string | undefined): string {
  if (!level) return "";
  const l = level.toLowerCase();
  if (l === "error" || l === "fatal") return c.red(l.padEnd(5));
  if (l === "warn" || l === "warning") return c.yellow(l.padEnd(5));
  if (l === "info") return c.cyan(l.padEnd(5));
  return c.dim(l.padEnd(5));
}
