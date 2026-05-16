import { apiRequest } from "../../api/client";
import { c } from "../../ui/colors";
import { loadConfig } from "../../config";
import type { Instance } from "../../api/types";

// `gentity compute open <id>` — opens the workspace iframe URL for the
// instance in the user's default browser. On servers / non-TTY, just
// prints the URL (so it's still useful in tmux / SSH sessions).
export async function runComputeOpen(id: string): Promise<number> {
  const { instance } = await apiRequest<{ instance: Instance }>(`/api/instances/${id}`);
  const cfg = await loadConfig();
  const host = hostnameFromApi(cfg.apiUrl);
  if (!host) {
    console.error(
      c.red("error:"),
      "can't derive a workspace URL from a localhost API base.",
    );
    return 1;
  }
  const url = `https://${instance.subdomain}.${host}/`;

  if (!process.stdout.isTTY) {
    console.log(url);
    return 0;
  }

  console.log(`Opening ${c.cyan(url)}`);
  await openBrowser(url);
  return 0;
}

function hostnameFromApi(apiUrl: string): string | null {
  try {
    const u = new URL(apiUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  switch (platform) {
    case "darwin":
      cmd = "open";
      args = [url];
      break;
    case "win32":
      cmd = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      cmd = "xdg-open";
      args = [url];
  }
  try {
    // Detached spawn so we don't block on the browser process. stderr/stdout
    // ignored — the URL is already printed above for fallback.
    Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" });
  } catch {
    // Best-effort. The URL is already printed; the user can open it manually.
  }
}
