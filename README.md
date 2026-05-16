# `gentity`

> Spin up isolated AI agent compute from your terminal.

`gentity` is the official CLI for [Gentity](https://gentity.ai) — provision
[Hermes](https://hermes-agent.nousresearch.com), [OpenClaw](https://www.openclaw.com),
[Claude Code](https://code.claude.com), [Aider](https://aider.chat), and
[browser-use](https://browser-use.com) instances on isolated Fly Machines,
each with its own persistent volume and its own browser-accessible workspace.

```bash
$ gentity compute create --agent claude-code --model claude-sonnet-4-5
:: Provisioning isolated microVM in iad…
:: Attaching persistent volume…
✓ Agent cl-x7k2m9 ready in 8.3s
  Open https://cl-x7k2m9.gentity.ai
```

## Install

### macOS / Linux (recommended)

```bash
curl -fsSL https://gentity.ai/install.sh | bash
```

This downloads the right binary for your OS/arch into `/usr/local/bin/gentity`.

### Homebrew (macOS / Linux)

```bash
brew install gentityapp/tap/gentity
```

### Build from source

You need [Bun](https://bun.sh) 1.3+ installed.

```bash
git clone https://github.com/gentityapp/cli.git
cd cli
bun install
bun run build
./dist/gentity --help
```

## Quick start

1. Mint an API token in the dashboard:
   [https://gentity.ai/dashboard/settings/tokens](https://gentity.ai/dashboard/settings/tokens)
2. Save it:
   ```bash
   gentity login --token gn_live_...
   ```
3. Create an instance:
   ```bash
   gentity compute create \
     --agent claude-code \
     --model claude-sonnet-4-5
   ```
4. List, open, stop, destroy as needed:
   ```bash
   gentity compute list
   gentity compute open cl-x7k2m9
   gentity compute stop cl-x7k2m9
   gentity compute delete cl-x7k2m9
   ```

## Commands

| Command | What |
|---|---|
| `gentity login` | Save your API token (`--token` or stdin) |
| `gentity logout` | Clear the saved token |
| `gentity compute create` | Provision a new agent instance |
| `gentity compute list` | List your instances (`--json` for piping) |
| `gentity compute start <id>` | Resume a stopped instance |
| `gentity compute stop <id>` | Stop a running instance (volume kept) |
| `gentity compute delete <id>` | Destroy machine + volume |
| `gentity compute open <id>` | Open the workspace in your browser |

Run `gentity --help` or `gentity compute --help` for full flag listings.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `GENTITY_TOKEN` | — | Override the saved token (handy in CI) |
| `GENTITY_API_URL` | `https://gentity.ai` | Point at a non-prod control plane |
| `ANTHROPIC_API_KEY` etc. | — | Used by `compute create` when `--api-key` is omitted |
| `NO_COLOR` | — | Disable ANSI color output |

## CI usage

In GitHub Actions, GitLab CI, etc.:

```yaml
- name: Install gentity
  run: curl -fsSL https://gentity.ai/install.sh | bash

- name: Spin up a Claude Code reviewer for this PR
  env:
    GENTITY_TOKEN: ${{ secrets.GENTITY_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    gentity compute create \
      --agent claude-code \
      --model claude-sonnet-4-5 \
      --name "pr-${{ github.event.pull_request.number }}" \
      --detach
```

## Where things live

- Config file: `~/.config/gentity/config.json` (chmod 600, holds the token)
- Override via env: `GENTITY_TOKEN`, `GENTITY_API_URL`

## License

[MIT](LICENSE).
