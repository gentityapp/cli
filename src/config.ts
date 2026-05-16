// On-disk config for the gentity CLI. Stored under XDG_CONFIG_HOME (or
// ~/.config on Mac/Linux). Contains the API token and base URL; nothing else
// goes here for now. Token file is chmod 600 to keep ssh-style permissions.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, chmodSync } from "node:fs";

const DEFAULT_API_URL = "https://gentity.ai";

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "gentity");
}

function configFile(): string {
  return join(configDir(), "config.json");
}

export interface CliConfig {
  apiUrl: string;
  token: string | null;
}

export async function loadConfig(): Promise<CliConfig> {
  const file = Bun.file(configFile());
  if (!(await file.exists())) {
    return { apiUrl: envApiUrl(), token: envToken() };
  }
  try {
    const raw = (await file.json()) as Partial<CliConfig>;
    return {
      apiUrl: envApiUrl() ?? raw.apiUrl ?? DEFAULT_API_URL,
      // Env var takes precedence — handy for CI where you don't want to
      // touch the disk config.
      token: envToken() ?? raw.token ?? null,
    };
  } catch {
    return { apiUrl: envApiUrl(), token: envToken() };
  }
}

export async function saveConfig(cfg: CliConfig): Promise<void> {
  const dir = configDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const path = configFile();
  await Bun.write(path, JSON.stringify(cfg, null, 2) + "\n");
  // chmod 600 — only the owner can read the token. Best-effort on Windows.
  try {
    chmodSync(path, 0o600);
  } catch {
    // ignore on platforms where chmod is a no-op
  }
}

function envApiUrl(): string {
  return process.env.GENTITY_API_URL ?? DEFAULT_API_URL;
}

function envToken(): string | null {
  return process.env.GENTITY_TOKEN ?? null;
}
