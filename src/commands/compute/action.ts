import { apiRequest } from "../../api/client";
import { c } from "../../ui/colors";
import { Spinner } from "../../ui/spinner";

// `gentity compute stop <id>` / `gentity compute start <id>` — issue start
// or stop. Blocks until the control plane returns (which already waits for
// Fly to confirm the state transition).
export async function runComputeAction(
  id: string,
  action: "start" | "stop",
): Promise<number> {
  const verb = action === "start" ? "Starting" : "Stopping";
  const spinner = new Spinner(`${verb} ${id}…`);
  spinner.start();
  try {
    await apiRequest<{ ok: true }>(`/api/instances/${id}/action`, {
      method: "POST",
      body: { action },
    });
    spinner.succeed(`${action === "start" ? "started" : "stopped"} ${c.bold(id)}`);
    return 0;
  } catch (err) {
    spinner.fail(`${verb.toLowerCase()} failed`);
    console.error(c.red("error:"), err instanceof Error ? err.message : String(err));
    return 1;
  }
}
