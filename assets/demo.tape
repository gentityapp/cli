# gentity CLI demo tape — produces assets/demo.gif via vhs.
#
# Re-record after a release:
#
#   # one-time setup
#   brew install vhs                       # https://github.com/charmbracelet/vhs
#
#   # ensure the gentity binary you want to demo is on PATH
#   #   - either the just-shipped Homebrew/curl install, OR
#   #   - the local ./dist/gentity from `bun run build`
#   #
#   # and that you're logged in so `compute list` returns real rows
#   # (mint a one-shot token, record, revoke).
#
#   vhs assets/demo.tape
#
# vhs spawns a headless ttyd, types the lines below into a real shell,
# and captures the resulting frames into a GIF. Sleeps between commands
# control pacing; theme + font size are picked to read on README hero
# width (≤ 1100 px, retina-friendly font).

Output assets/demo.gif

# Pick up the local build artifact when running from the repo root
# (vhs starts the embedded shell in the cwd of the vhs invocation, so
# ./dist resolves correctly when you `vhs assets/demo.tape` from the
# project root). Falls back to whatever brew / install.sh put on the
# system PATH if you'd rather demo the installed binary instead.
Env PATH "./dist:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

Set FontSize 16
Set Width 1100
Set Height 660
Set Theme "Dracula"
Set TypingSpeed 35ms
Set PlaybackSpeed 1.0

Sleep 600ms

# 1. Identify the tool.
Type "gentity --version"
Enter
Sleep 900ms

# 2. Show what agents are available (public catalog, no auth needed).
Type "gentity agents"
Enter
Sleep 5s

# 3. Clear and pivot to per-user surface.
Hide
Type "clear"
Enter
Show
Sleep 400ms

# 4. Real running instances, piped through jq. Two things at once:
# proves we're talking to a real backend, and shows the --json output
# being post-processed (the natural Unix pipe flex). We omit subdomain
# in the projection because <subdomain>.gentity.ai is the access URL
# for each instance — leaving it in a public GIF would publish those
# URLs as if they were screenshots.
Type "gentity compute list --json | jq 'map({id: .id[:8], agent: .agentType, model: .modelName, status})'"
Enter
Sleep 6s

# 5. Quick help so viewers see the full surface.
Type "gentity --help"
Enter
Sleep 6s

# Hold final frame so viewers can read.
Sleep 1500ms
