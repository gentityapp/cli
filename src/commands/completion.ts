import { c } from "../ui/colors";

// `gentity completion <shell>` — print a shell-completion script to stdout.
//
// Usage:
//   bash:  source <(gentity completion bash)
//   zsh:   source <(gentity completion zsh)
//   fish:  gentity completion fish | source
//
// Homebrew picks these up automatically via
//   generate_completions_from_executable(bin/"gentity", "completion")
// in the formula, which runs each subcommand and installs the output to
// the right per-shell path.
//
// For v1 the scripts are STATIC (commands, subcommands, known flags,
// known agent ids). They don't shell back into `gentity` for dynamic
// completion — we may add that for instance ids / agent catalog later,
// but the cold-start network cost on every Tab is the real reason most
// CLIs ship static lists first.

type Shell = "bash" | "zsh" | "fish";

export function runCompletion(shell: string | undefined): number {
  if (!shell) {
    console.error(c.red("error:"), "completion requires a shell: bash, zsh, or fish");
    return 1;
  }
  const s = shell as Shell;
  switch (s) {
    case "bash":
      process.stdout.write(BASH);
      return 0;
    case "zsh":
      process.stdout.write(ZSH);
      return 0;
    case "fish":
      process.stdout.write(FISH);
      return 0;
    default:
      console.error(c.red("error:"), `unsupported shell "${shell}". Try bash, zsh, or fish.`);
      return 1;
  }
}

// Keep the literal command/agent lists in one place so all three scripts
// stay in sync when we add a new subcommand. Edit here, regenerate, ship.
const TOP_COMMANDS = ["login", "logout", "agents", "compute", "completion", "help", "version"];
const COMPUTE_SUB = ["create", "list", "start", "stop", "restart", "delete", "open", "logs", "ssh"];
const KNOWN_AGENTS = ["openclaw", "hermes", "aider", "claude-code", "browser-use"];
const KNOWN_REGIONS = [
  "sjc", "lax", "sea", "iad", "ewr", "ord",
  "nrt", "hkg", "sin", "syd",
  "fra", "ams", "lhr",
];

// ────────────────────────────── bash ──────────────────────────────
const BASH = `# gentity bash completion. Source with: source <(gentity completion bash)
_gentity_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Flag value completion — runs regardless of position.
  case "$prev" in
    --agent)  COMPREPLY=( $(compgen -W "${KNOWN_AGENTS.join(" ")}" -- "$cur") ); return ;;
    --region) COMPREPLY=( $(compgen -W "${KNOWN_REGIONS.join(" ")}" -- "$cur") ); return ;;
    --shell|completion) COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") ); return ;;
  esac

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${TOP_COMMANDS.join(" ")}" -- "$cur") )
    return
  fi

  if [ "\${COMP_WORDS[1]}" = "compute" ] && [ "$COMP_CWORD" -eq 2 ]; then
    COMPREPLY=( $(compgen -W "${COMPUTE_SUB.join(" ")}" -- "$cur") )
    return
  fi

  # Suggest flags by default after the subcommand position.
  if [[ "$cur" == --* ]]; then
    COMPREPLY=( $(compgen -W "--agent --model --api-key --name --region --detach --json --yes --follow --lines --token --api-url" -- "$cur") )
    return
  fi
}
complete -F _gentity_completions gentity
`;

// ────────────────────────────── zsh ───────────────────────────────
const ZSH = `#compdef gentity
# gentity zsh completion. Source with: source <(gentity completion zsh)
# Or for persistent installs, drop in a directory on $fpath:
#   gentity completion zsh > "\${fpath[1]}/_gentity"

_gentity() {
  local context state state_descr line
  typeset -A opt_args

  local -a top_commands compute_sub agents regions shells
  top_commands=(
${TOP_COMMANDS.map((c) => `    '${c}:${zshCommandDesc(c)}'`).join("\n")}
  )
  compute_sub=(
${COMPUTE_SUB.map((c) => `    '${c}:${zshComputeDesc(c)}'`).join("\n")}
  )
  agents=(${KNOWN_AGENTS.join(" ")})
  regions=(${KNOWN_REGIONS.join(" ")})
  shells=(bash zsh fish)

  _arguments -C \\
    '1: :->cmd' \\
    '*:: :->args'

  case $state in
    cmd)
      _describe -t commands 'gentity command' top_commands
      ;;
    args)
      case $words[1] in
        compute)
          if (( CURRENT == 2 )); then
            _describe -t commands 'compute subcommand' compute_sub
          else
            _arguments \\
              '--agent[Agent type]:agent:($agents)' \\
              '--model[Model name]:model:' \\
              '--api-key[Provider API key]:key:' \\
              '--name[Instance label]:label:' \\
              '--region[Fly region]:region:($regions)' \\
              '--detach[Skip wait-for-ready]' \\
              '--lines[Log line count]:n:' \\
              '--follow[Stream logs]' \\
              '--json[JSON output]' \\
              '--yes[Skip confirmation prompts]'
          fi
          ;;
        login)
          _arguments \\
            '--token[Bearer token]:token:' \\
            '--api-url[Override API base]:url:'
          ;;
        completion)
          _values 'shell' $shells
          ;;
        agents)
          _arguments '--json[JSON output]'
          ;;
      esac
      ;;
  esac
}
compdef _gentity gentity
`;

// ────────────────────────────── fish ──────────────────────────────
const FISH = `# gentity fish completion. Source with: gentity completion fish | source
# Or for persistent installs:
#   gentity completion fish > ~/.config/fish/completions/gentity.fish

# Top-level subcommands.
${TOP_COMMANDS.map((c) => `complete -c gentity -n "__fish_use_subcommand" -a "${c}" -d "${zshCommandDesc(c)}"`).join("\n")}

# \`compute <sub>\` — only suggest after the user typed "compute" and not another subcommand.
${COMPUTE_SUB.map(
  (c) => `complete -c gentity -n "__fish_seen_subcommand_from compute; and not __fish_seen_subcommand_from ${COMPUTE_SUB.join(" ")}" -a "${c}" -d "${zshComputeDesc(c)}"`,
).join("\n")}

# Flags that take an enum value get the value list inline.
complete -c gentity -l agent  -d "Agent type"     -a "${KNOWN_AGENTS.join(" ")}" -x
complete -c gentity -l region -d "Fly region"     -a "${KNOWN_REGIONS.join(" ")}" -x
complete -c gentity -n "__fish_seen_subcommand_from completion" -a "bash zsh fish" -x

# Flags that take a free-form value.
complete -c gentity -l model    -d "Model name"        -x
complete -c gentity -l api-key  -d "Provider API key"  -x
complete -c gentity -l name     -d "Instance label"    -x
complete -c gentity -l lines    -d "Number of log lines" -x
complete -c gentity -l token    -d "Bearer token"      -x
complete -c gentity -l api-url  -d "Override API base" -x

# Boolean flags.
complete -c gentity -l detach  -d "Skip wait-for-ready"
complete -c gentity -l follow  -d "Stream logs"
complete -c gentity -l json    -d "JSON output"
complete -c gentity -l yes     -d "Skip confirmation"
`;

function zshCommandDesc(cmd: string): string {
  switch (cmd) {
    case "login":      return "Save your API token";
    case "logout":     return "Clear the saved token";
    case "agents":     return "List available agents";
    case "compute":    return "Manage agent instances";
    case "completion": return "Print a shell completion script";
    case "help":       return "Show help";
    case "version":    return "Show version";
    default:           return cmd;
  }
}
function zshComputeDesc(sub: string): string {
  switch (sub) {
    case "create":  return "Provision a new instance";
    case "list":    return "List your instances";
    case "start":   return "Resume a stopped instance";
    case "stop":    return "Stop a running instance";
    case "restart": return "Stop + start in one command";
    case "delete":  return "Destroy machine + volume";
    case "open":    return "Open workspace in browser";
    case "logs":    return "Tail or follow logs";
    case "ssh":     return "Interactive shell in the container";
    default:        return sub;
  }
}
