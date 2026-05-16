import { loadConfig, saveConfig } from "../config";
import { c } from "../ui/colors";

// `gentity logout` — clear the stored token. We keep the file (with token=null)
// so the apiUrl override stays in place if the user customized it.
export async function runLogout(): Promise<number> {
  const cfg = await loadConfig();
  if (!cfg.token) {
    console.log(c.dim("(not logged in)"));
    return 0;
  }
  await saveConfig({ apiUrl: cfg.apiUrl, token: null });
  console.log(c.green("✓"), "logged out");
  return 0;
}
