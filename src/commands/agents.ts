import { apiRequest } from "../api/client";
import { c } from "../ui/colors";

interface AgentSummary {
  id: string;
  name: string;
  description: string;
  defaultMemoryMb: number;
  defaultCpus: number;
  defaultVolumeGb: number;
  models: { provider: string; name: string; label: string }[];
}

// `gentity agents` — list the agent templates the catalog offers.
// Useful for `--agent` autocompletion ("which ids exist?") and for
// "what models does Hermes support?" lookups before running create.
export async function runAgents(opts: { json?: boolean }): Promise<number> {
  // /api/catalog/agents is public (no auth needed). The CLI client adds
  // the Bearer header anyway if one is configured; the server ignores it.
  const { agents } = await apiRequest<{ agents: AgentSummary[] }>("/api/catalog/agents", {
    requireAuth: false,
  });

  if (opts.json) {
    console.log(JSON.stringify(agents, null, 2));
    return 0;
  }

  if (agents.length === 0) {
    console.log(c.dim("(catalog is empty)"));
    return 0;
  }

  for (const a of agents) {
    console.log(
      `${c.bold(a.id.padEnd(14))} ${c.dim(a.name)}  ${c.dim(
        `${a.defaultCpus}vCPU / ${a.defaultMemoryMb}MB / ${a.defaultVolumeGb}GB`,
      )}`,
    );
    console.log(`  ${c.dim(a.description)}`);
    // List up to first 4 models so the output stays readable. The full
    // list is in --json output. Most agents have 3-6 model options.
    const shown = a.models.slice(0, 4);
    for (const m of shown) {
      console.log(`  ${c.cyan(m.name.padEnd(28))} ${c.dim(m.label)}`);
    }
    if (a.models.length > shown.length) {
      console.log(c.dim(`  +${a.models.length - shown.length} more (use --json to see all)`));
    }
    console.log();
  }
  return 0;
}
