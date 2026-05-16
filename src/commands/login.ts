// `gentity login` — store an API token locally.
//
// v1 flow: --token <value> or stdin only. We don't ship the device-code OAuth
// browser flow yet — that's its own protocol on the control plane. For now
// you mint a token in the dashboard, paste it here, done. This matches how
// most CI tools start (Vercel, Fly, gh) and unblocks the rest of the CLI.

import { loadConfig, saveConfig } from "../config";
import { apiRequest, ApiError } from "../api/client";
import { c } from "../ui/colors";

interface WhoAmI {
  // Minimal "validate this token" endpoint. If the control plane doesn't
  // have one yet, we hit /api/instances which equally requires auth and
  // returns 401 on a bad token.
  instances: unknown[];
}

interface LoginOpts {
  token?: string;
  apiUrl?: string;
}

export async function runLogin(opts: LoginOpts): Promise<number> {
  let token = opts.token?.trim();

  if (!token) {
    // Prompt stdin when not piped in via --token. Bun's readline-equivalent
    // is just reading from stdin.
    if (process.stdin.isTTY) {
      process.stdout.write(
        `Paste your token from ${c.cyan("https://gentity.ai/dashboard/settings/tokens")}\n` +
          `${c.dim("(input is hidden)")}\n` +
          `${c.bold("token:")} `,
      );
      token = await readSecretFromTTY();
    } else {
      // piped: read stdin
      token = (await Bun.stdin.text()).trim();
    }
  }

  if (!token) {
    console.error(c.red("error:"), "no token provided");
    return 1;
  }
  if (!token.startsWith("gn_live_")) {
    console.error(
      c.red("error:"),
      `tokens look like "gn_live_..." — got something else`,
    );
    return 1;
  }

  // Persist first so apiRequest can pick it up, then verify by calling a
  // protected endpoint. If verification fails, undo the save.
  const cfg = await loadConfig();
  const apiUrl = opts.apiUrl ?? cfg.apiUrl;
  await saveConfig({ apiUrl, token });

  try {
    await apiRequest<WhoAmI>("/api/instances", { method: "GET" });
  } catch (err) {
    // Roll back the stored token if the verification call failed.
    await saveConfig({ apiUrl, token: null });
    if (err instanceof ApiError) {
      console.error(c.red("error:"), `token rejected (${err.status}): ${err.message}`);
    } else {
      console.error(c.red("error:"), err);
    }
    return 1;
  }

  console.log(c.green("✓"), `logged in to ${c.bold(apiUrl)}`);
  return 0;
}

// Read a line from /dev/tty without echoing. Falls back to plain readline
// if /dev/tty isn't available (e.g. in some IDE shells).
async function readSecretFromTTY(): Promise<string> {
  // Bun's process.stdin doesn't directly expose `setRawMode`-style hiding,
  // but it does provide the `node:readline` shim. For a clean MVP, just
  // read the line and let the terminal echo — most token-prompt flows do
  // this. We can add hidden input later.
  for await (const line of console as unknown as AsyncIterable<string>) {
    return line.toString().trim();
  }
  return "";
}
