import { apiRequest } from "../../api/client";
import { c } from "../../ui/colors";
import { Spinner } from "../../ui/spinner";

// `gentity compute delete <id>` — destroy the Fly app + volume.
// Asks for confirmation unless --yes is passed (CI-friendly).
export async function runComputeDelete(
  id: string,
  opts: { yes?: boolean },
): Promise<number> {
  if (!opts.yes) {
    process.stdout.write(
      `${c.yellow("⚠")}  This destroys the machine and its persistent volume for ${c.bold(id)}.\n` +
        `   Type the instance id to confirm: `,
    );
    const line = await readStdinLine();
    if (line.trim() !== id) {
      console.log(c.dim("cancelled"));
      return 130;
    }
  }

  const spinner = new Spinner(`Deleting ${id}…`);
  spinner.start();
  try {
    await apiRequest<{ ok: true; warnings?: string[] }>(`/api/instances/${id}`, {
      method: "DELETE",
    });
    spinner.succeed(`deleted ${c.bold(id)}`);
    return 0;
  } catch (err) {
    spinner.fail("delete failed");
    console.error(c.red("error:"), err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function readStdinLine(): Promise<string> {
  for await (const line of console as unknown as AsyncIterable<string>) {
    return line.toString();
  }
  return "";
}
