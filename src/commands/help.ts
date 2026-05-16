import { c } from "../ui/colors";

const VERSION = "0.0.2";

export function printHelp(topic?: string): number {
  if (topic === "compute") {
    printComputeHelp();
    return 0;
  }
  printRootHelp();
  return 0;
}

function printRootHelp() {
  const $ = c.dim("$");
  console.log(`${c.bold("gentity")} — spin up isolated AI agent compute from your terminal

${c.bold("USAGE")}
  ${$} gentity <command> [options]

${c.bold("COMMANDS")}
  ${c.cyan("login")}              Save your API token
  ${c.cyan("logout")}             Clear the saved token
  ${c.cyan("agents")}             List available agents (catalog)
  ${c.cyan("compute create")}     Provision a new agent instance
  ${c.cyan("compute list")}       List your instances
  ${c.cyan("compute start")}      Resume a stopped instance
  ${c.cyan("compute stop")}       Stop a running instance (volume kept)
  ${c.cyan("compute restart")}    Stop + start in one command
  ${c.cyan("compute delete")}     Destroy machine + volume
  ${c.cyan("compute open")}       Open the instance's workspace in your browser
  ${c.cyan("compute logs")}       Tail (or --follow) the instance logs
  ${c.cyan("compute ssh")}        Open an interactive shell in the container

${c.bold("EXAMPLES")}
  ${$} gentity login --token gn_live_...
  ${$} gentity agents
  ${$} gentity compute create --agent claude-code --model claude-sonnet-4-5
  ${$} gentity compute list
  ${$} gentity compute open cl-x7k2m9
  ${$} gentity compute logs cl-x7k2m9 --follow
  ${$} gentity compute ssh cl-x7k2m9

${c.bold("ENVIRONMENT")}
  ${c.dim("GENTITY_TOKEN")}        Use this token instead of the saved one
  ${c.dim("GENTITY_API_URL")}      Override the API base (default: https://gentity.ai)
  ${c.dim("ANTHROPIC_API_KEY")}    Used by ${c.cyan("compute create")} when --api-key is omitted
  ${c.dim("OPENAI_API_KEY")}       Same, for OpenAI-routed agents
  ${c.dim("OPENROUTER_API_KEY")}   Same, for OpenRouter

  ${c.dim("v" + VERSION)} · ${c.dim("https://github.com/gentityapp/cli")}`);
}

function printComputeHelp() {
  const $ = c.dim("$");
  console.log(`${c.bold("gentity compute")} — manage agent instances

${c.bold("SUBCOMMANDS")}
  ${c.cyan("create")}    --agent <id> --model <name> [--api-key <key>] [--name <label>] [--region <code>] [--detach]
  ${c.cyan("list")}      [--json]
  ${c.cyan("start")}     <id>
  ${c.cyan("stop")}      <id>
  ${c.cyan("restart")}   <id>
  ${c.cyan("delete")}    <id> [--yes]
  ${c.cyan("open")}      <id>
  ${c.cyan("logs")}      <id> [--lines N] [--follow] [--json]
  ${c.cyan("ssh")}       <id>

${c.bold("EXAMPLES")}
  ${$} gentity compute create --agent claude-code --model claude-sonnet-4-5
  ${$} gentity compute create --agent openclaw   --model openrouter/auto --region nrt
  ${$} gentity compute list --json | jq '.[] | select(.status == "running")'
  ${$} gentity compute logs cl-x7k2m9 --follow
  ${$} gentity compute ssh cl-x7k2m9`);
}

export function printVersion(): number {
  console.log(`gentity ${VERSION}`);
  return 0;
}
