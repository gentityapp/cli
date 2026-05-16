#!/usr/bin/env bun
// gentity CLI entry. Minimal hand-rolled arg parser — pulls in zero deps so
// the compiled binary stays small (~50MB Bun runtime + ~50KB of our code).
// If the surface grows past ~10 commands we can switch to commander/citty.

import { runLogin } from "./commands/login";
import { runLogout } from "./commands/logout";
import { runAgents } from "./commands/agents";
import { runCompletion } from "./commands/completion";
import { runComputeList } from "./commands/compute/list";
import { runComputeCreate } from "./commands/compute/create";
import { runComputeAction } from "./commands/compute/action";
import { runComputeDelete } from "./commands/compute/delete";
import { runComputeOpen } from "./commands/compute/open";
import { runComputeLogs } from "./commands/compute/logs";
import { runComputeSsh } from "./commands/compute/ssh";
import { printHelp, printVersion } from "./commands/help";
import { ApiError } from "./api/client";
import { c } from "./ui/colors";

async function main(argv: string[]): Promise<number> {
  // Top-level flags handled before subcommand dispatch.
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    return printHelp(argv[1]);
  }
  if (argv[0] === "--version" || argv[0] === "-V" || argv[0] === "version") {
    return printVersion();
  }

  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case "login": {
      const flags = parseFlags(rest, ["token", "api-url"]);
      return runLogin({ token: flags.token, apiUrl: flags["api-url"] });
    }
    case "logout":
      return runLogout();
    case "agents": {
      const flags = parseFlags(rest, ["json"]);
      return runAgents({ json: flags.json === "true" || flags.json === "" });
    }
    case "completion": {
      // First positional arg is the shell. We accept it both as a bare
      // word ("bash") and as a -- flag ("--shell bash") so Homebrew's
      // `generate_completions_from_executable` works either way.
      const flags = parseFlags(rest, ["shell"]);
      const shell = flags.shell || rest.find((a) => !a.startsWith("-"));
      return runCompletion(shell);
    }
    case "compute":
      return await runCompute(rest);
    default:
      console.error(c.red("error:"), `unknown command "${cmd}"`);
      console.error(c.dim(`run "gentity --help" for usage`));
      return 1;
  }
}

async function runCompute(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return printHelp("compute");
  }
  const sub = argv[0];
  const rest = argv.slice(1);

  switch (sub) {
    case "create": {
      const flags = parseFlags(rest, [
        "agent",
        "model",
        "api-key",
        "name",
        "region",
        "detach",
      ]);
      if (!flags.agent || !flags.model) {
        console.error(c.red("error:"), "compute create requires --agent and --model");
        return 1;
      }
      return runComputeCreate({
        agent: flags.agent,
        model: flags.model,
        apiKey: flags["api-key"],
        name: flags.name,
        region: flags.region,
        detach: flags.detach === "true" || flags.detach === "",
      });
    }
    case "list":
    case "ls": {
      const flags = parseFlags(rest, ["json"]);
      return runComputeList({ json: flags.json === "true" || flags.json === "" });
    }
    case "start":
    case "stop":
    case "restart": {
      const id = rest.find((a) => !a.startsWith("-"));
      if (!id) {
        console.error(c.red("error:"), `compute ${sub} requires an instance id`);
        return 1;
      }
      return runComputeAction(id, sub);
    }
    case "delete":
    case "rm": {
      const flags = parseFlags(rest, ["yes"]);
      const id = rest.find((a) => !a.startsWith("-"));
      if (!id) {
        console.error(c.red("error:"), "compute delete requires an instance id");
        return 1;
      }
      return runComputeDelete(id, { yes: flags.yes === "true" || flags.yes === "" });
    }
    case "open": {
      const id = rest.find((a) => !a.startsWith("-"));
      if (!id) {
        console.error(c.red("error:"), "compute open requires an instance id");
        return 1;
      }
      return runComputeOpen(id);
    }
    case "logs": {
      const flags = parseFlags(rest, ["lines", "follow", "json"]);
      const id = rest.find((a) => !a.startsWith("-"));
      if (!id) {
        console.error(c.red("error:"), "compute logs requires an instance id");
        return 1;
      }
      const lines = flags.lines ? parseInt(flags.lines, 10) : undefined;
      return runComputeLogs(id, {
        lines: Number.isFinite(lines) ? lines : undefined,
        follow: flags.follow === "true" || flags.follow === "",
        json: flags.json === "true" || flags.json === "",
      });
    }
    case "ssh": {
      const id = rest.find((a) => !a.startsWith("-"));
      if (!id) {
        console.error(c.red("error:"), "compute ssh requires an instance id");
        return 1;
      }
      return runComputeSsh(id);
    }
    default:
      console.error(c.red("error:"), `unknown compute subcommand "${sub}"`);
      return 1;
  }
}

// Tiny --key=value / --key value parser. Returns a flat map of known flags.
// Unknown flags are silently ignored (caller is responsible for required
// checks). Boolean flags appear as "" in the result map.
function parseFlags(argv: string[], known: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    let key: string;
    let val: string | undefined;
    if (eq >= 0) {
      key = a.slice(2, eq);
      val = a.slice(eq + 1);
    } else {
      key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        val = next;
        i++;
      } else {
        val = ""; // boolean flag
      }
    }
    if (known.includes(key)) {
      out[key] = val;
    }
  }
  return out;
}

const argv = process.argv.slice(2);
main(argv)
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof ApiError) {
      console.error(c.red("error:"), err.message);
    } else if (err instanceof Error) {
      console.error(c.red("error:"), err.message);
    } else {
      console.error(c.red("error:"), err);
    }
    process.exit(1);
  });
