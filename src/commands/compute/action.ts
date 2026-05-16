import { apiRequest } from "../../api/client";
import { c } from "../../ui/colors";
import { Spinner } from "../../ui/spinner";
import { resolveInstanceId } from "../../api/resolve";

// `gentity compute {start|stop|restart} <id>` — drive the Fly machine
// through a lifecycle transition. Blocks until the control plane returns
// (it already waits for Fly to confirm the state).
export async function runComputeAction(
  idOrSubdomain: string,
  action: "start" | "stop" | "restart",
): Promise<number> {
  const id = await resolveInstanceId(idOrSubdomain);
  const verb =
    action === "start" ? "Starting" : action === "stop" ? "Stopping" : "Restarting";
  const past =
    action === "start" ? "started" : action === "stop" ? "stopped" : "restarted";
  const spinner = new Spinner(`${verb} ${id}…`);
  spinner.start();
  try {
    await apiRequest<{ ok: true }>(`/api/instances/${id}/action`, {
      method: "POST",
      body: { action },
    });
    spinner.succeed(`${past} ${c.bold(id)}`);
    return 0;
  } catch (err) {
    spinner.fail(`${verb.toLowerCase()} failed`);
    console.error(c.red("error:"), err instanceof Error ? err.message : String(err));
    return 1;
  }
}
