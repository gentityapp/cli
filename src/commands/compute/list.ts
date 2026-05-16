import { apiRequest } from "../../api/client";
import { c } from "../../ui/colors";
import type { Instance } from "../../api/types";

// `gentity compute list` — table of all the caller's instances.
export async function runComputeList(opts: { json?: boolean }): Promise<number> {
  const { instances } = await apiRequest<{ instances: Instance[] }>("/api/instances");

  if (opts.json) {
    console.log(JSON.stringify(instances, null, 2));
    return 0;
  }

  if (instances.length === 0) {
    console.log(c.dim("(no instances)"));
    console.log(
      c.dim("Create one with: ") +
        c.cyan("gentity compute create --agent <id> --model <name>"),
    );
    return 0;
  }

  // Column widths sized to the longest cell in each col so the table stays
  // tight on narrow terminals. id is truncated to its first 8 chars (cuid).
  const rows = instances.map((i) => ({
    id: i.id.slice(0, 8),
    subdomain: i.subdomain,
    agent: i.agentType,
    model: i.modelName,
    status: i.status,
  }));
  const cols: (keyof (typeof rows)[number])[] = ["id", "subdomain", "agent", "model", "status"];
  const widths: Record<string, number> = {};
  for (const col of cols) {
    widths[col] = Math.max(
      col.length,
      ...rows.map((r) => String(r[col]).length),
    );
  }

  const head = cols.map((col) => col.toUpperCase().padEnd(widths[col]!)).join("  ");
  console.log(c.dim(head));
  for (const r of rows) {
    const line = cols
      .map((col) => String(r[col]).padEnd(widths[col]!))
      .join("  ");
    console.log(colorRow(line, r.status));
  }
  return 0;
}

function colorRow(line: string, status: string): string {
  switch (status) {
    case "running":
      return line;
    case "stopped":
      return c.dim(line);
    case "creating":
    case "starting":
    case "stopping":
      return c.yellow(line);
    case "error":
      return c.red(line);
    default:
      return line;
  }
}
