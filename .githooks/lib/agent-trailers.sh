#!/usr/bin/env bash
#
# Single source of the forbidden agent-trailer pattern.
#
# Sourced by the commit-msg hook, the pre-push hook, the repository validator
# and the CI pull-request-body check. Keeping one copy is the point: the
# pattern used to live in three places and had already drifted.
#
# Rule: standards/GIT.md, "No agent traces".
# Fixtures: scripts/test-agent-trailers.sh.
#
# Anchored to line start on purpose. A trailer is a line; an unanchored match
# would also reject a commit or a PR body that documents this very rule in prose.
# The "Generated with" branch allows leading non-letters because the footer these
# tools emit starts with an emoji.

AGENT_TRAILER_PATTERN='(^[[:space:]]*(Co-Authored-By:.*(claude|copilot|cursor|codex|gpt|gemini|anthropic|openai|assistant|\bbot\b)|Claude-Session:|https?://(claude\.ai/code|claude\.com/claude-code)))|(^[^A-Za-z]*Generated with .*(Claude|Copilot|Cursor|Codex))'

# Reads text on stdin. Exits 0 when a forbidden trailer is present.
agent_trailers_present() {
  grep -qiE "$AGENT_TRAILER_PATTERN"
}

# Reads text on stdin. Prints the offending lines, numbered.
agent_trailers_show() {
  grep -inE "$AGENT_TRAILER_PATTERN"
}
