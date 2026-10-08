# powers

A thin, personal plugin for a disciplined dev workflow, running in both
Claude Code and OpenCode:
**brainstorm → committed spec → test-first implementation in worktrees →
adversarial review → hard verify gate.**

## What's in the box

- **`design` skill** — Socratic refinement of a new-project idea into a
  living design doc at `docs/DESIGN.md`: high-level architecture plus a
  phased plan with per-phase status, committed (`design: <name>`) before any
  code. Phases get brainstormed into specs when their turn comes.
- **`brainstorming` skill** — Socratic refinement of a rough idea into a spec
  at `docs/specs/YYYY-MM-DD-<slug>.md`, committed (`spec: <slug>`) before any
  code. Adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).
- **`tdd` skill** — failing test first, for features and bug fixes. The Iron
  Law: no production code without a failing test that demands it.
- **`systematic-debugging` skill** — root cause before fixes: one hypothesis
  at a time, no symptom patches, a three-strikes circuit breaker, then hand
  off to the tdd bug flow. Adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).
- **`implementer` agent** — one task per dispatch, test-first, in an isolated
  worktree, commits before finishing. Stops and reports on spec ambiguity.
- **`code-reviewer` agent** — read-only, small/cheap model (haiku in Claude
  Code), reviews a diff against its spec for correctness, scope creep, and
  missing tests.
- **verify gate** — a `SubagentStop` hook (Claude Code) / subagent-completion
  hook (OpenCode). Blocks a finishing subagent if it changed source without
  tests (`VERIFY_LEVEL=tdd`) or if the repo's verify command fails.
- **`setup` skill** — `/powers:setup` rolls a repo out: detects test/build
  commands, asks for `VERIFY_LEVEL`, generates AGENTS.md and/or CLAUDE.md plus
  verify.sh, commits.
- **`approve` shortcut** — `/powers:approve` after reviewing a pending spec
  or design doc: counts as explicit approval and commits it; a spec then
  continues into plan mode. User-invoked only.
- **`ship` shortcut** — `/powers:ship` when the branch's work is done: opens
  the PR, requests + waits for Copilot's review, fixes what's relevant, states
  why the rest was skipped. User-invoked only.

## Install

### Claude Code

The repo is its own marketplace:

```
/plugin marketplace add craftycorvid/powers
/plugin install powers@powers
```

### OpenCode

Add the plugin:

```
opencode plugin add github:craftycorvid/powers
```

The plugin registers the skills, the `/powers/approve`, `/powers/ship`, and
`/powers/setup` commands, and the verify gate from this repo's `skills/` and
`scripts/`. The `implementer` and `code-reviewer` agents are installed as
global files by `/powers/setup`, because OpenCode plugins cannot register
agents themselves.

## Per-repo rollout

Run `/powers:setup` (Claude Code) or `/powers/setup` (OpenCode) in the repo. It
detects the project's test/build commands,
asks which `VERIFY_LEVEL` you want (`tdd` strict / `build` relaxed), generates
`CLAUDE.md` (Claude Code) and/or `AGENTS.md` (OpenCode) and `scripts/verify.sh`
from the templates, runs verify.sh to prove it works, and commits them. If both
harnesses are in use it writes both instruction files with identical content.
It never overwrites existing files — on an already-configured repo it only
offers what's missing.

Manual fallback (what setup automates):

1. `CLAUDE.md` / `AGENTS.md` — copy the matching template from `templates/`,
   fill in invariants, commands, pointers, and the `VERIFY_LEVEL=` line.
   Claude Code reads `CLAUDE.md`; OpenCode reads `AGENTS.md`.
2. `scripts/verify.sh` — copy `templates/verify.sh.template`, point it at the
   repo's real test command. Non-zero exit blocks subagents from finishing.
   (Without it the gate falls back to auto-detection — package.json test
   script, Cargo.toml, gradlew — and warns loudly if it finds nothing.)
   It must be safe to run in a fresh checkout — worktree agents start with no
   deps installed; see the bootstrap guard in the template.
3. `docs/specs/` — created automatically by the first brainstorm.

## Overriding per repo

- A repo-local skill at `.claude/skills/<name>/` shadows the plugin skill of
  the same name — copy, edit, done.
- `CLAUDE.md` instructions beat skill guidance on conflict; it's the
  repo's constitution. `VERIFY_LEVEL=build` is the built-in relaxation.
- Uninstall entirely: `/plugin uninstall powers@powers`.

## OpenCode differences

Same skills, same discipline, different harness plumbing:

- The verify gate runs as a plugin hook on **subagent completion** rather than
  Claude Code's `SubagentStop`, with the same `BLOCKED` semantics — a failing
  gate fails the parent's subagent call and the model can redispatch.
- Skills and commands are registered by the plugin directly from the same
  `skills/*/SKILL.md` files; nothing is duplicated.
- Commands are `/powers/approve`, `/powers/ship`, and `/powers/setup`
  (slash, not colon).
- Agents install to `~/.config/opencode/agents/` via `/powers/setup`, since
  plugins cannot register agents.
- The `implementer` creates its own git worktree, moves its session into it
  (`session_move`), and stays there — the gate inspects the worktree on
  completion; the dispatcher merges and cleans up.

## How is this different from superpowers?

The design rule: lean on Claude Code's native primitives instead of rebuilding
them. Deliberately absent, and what covers it instead:

| Not built                          | Native feature that covers it               |
| ---------------------------------- | ------------------------------------------- |
| Worktree management skill          | `isolation: worktree` agent frontmatter     |
| Plan orchestrator / task sequencer | Plan Mode + subagent dispatch               |
| Session-start skill index hook     | Skill auto-routing from descriptions        |
| Multi-harness compatibility layer  | Native plugin for both Claude Code and OpenCode |
| Review-loop orchestration          | One `code-reviewer` agent; native iteration |
