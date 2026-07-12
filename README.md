# powers

A thin, personal Claude Code plugin for a disciplined dev workflow:
**brainstorm → committed spec → test-first implementation in worktrees →
adversarial review → hard verify gate.**

The design rule: lean on Claude Code's native primitives instead of rebuilding
them. Deliberately absent, and what covers it instead:

| Not built | Native feature that covers it |
|---|---|
| Worktree management skill | `isolation: worktree` agent frontmatter |
| Plan orchestrator / task sequencer | Plan Mode + subagent dispatch |
| Session-start skill index hook | Skill auto-routing from descriptions |
| Multi-harness compatibility layer | This runs in Claude Code, period |
| Review-loop orchestration | One `code-reviewer` agent; native iteration |

## What's in the box

- **`brainstorming` skill** — Socratic refinement of a rough idea into a spec
  at `docs/specs/YYYY-MM-DD-<slug>.md`, committed (`spec: <slug>`) before any
  code. Adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).
- **`tdd` skill** — failing test first, for features and bug fixes. The Iron
  Law: no production code without a failing test that demands it.
- **`implementer` agent** — one task per dispatch, test-first, in an isolated
  worktree, commits before finishing. Stops and reports on spec ambiguity.
- **`code-reviewer` agent** — read-only (Read/Grep/Glob, haiku), reviews a
  diff against its spec for correctness, scope creep, and missing tests.
- **verify gate** — a `SubagentStop` hook. Blocks a finishing subagent if it
  changed source without tests (`VERIFY_LEVEL=tdd`) or if the repo's verify
  command fails.

## Install

The repo is its own marketplace:

```
/plugin marketplace add corvid/powers        # or a local path to this repo
/plugin install powers@powers
```

## Per-repo rollout (3 files)

1. `CLAUDE.md` — copy `templates/CLAUDE.md.template`, fill in invariants,
   commands, pointers. Set `VERIFY_LEVEL=tdd` (strict, default) or `build`
   (gate only requires the verify command to pass).
2. `scripts/verify.sh` — copy `templates/verify.sh.template`, point it at the
   repo's real test command. Non-zero exit blocks subagents from finishing.
   (Without it the gate falls back to auto-detection — package.json test
   script, Cargo.toml, gradlew — and warns loudly if it finds nothing.)
3. `docs/specs/` — created automatically by the first brainstorm.

## Overriding per repo

- A repo-local skill at `.claude/skills/<name>/` shadows the plugin skill of
  the same name — copy, edit, done.
- `CLAUDE.md` instructions beat skill guidance on conflict; it's the
  repo's constitution. `VERIFY_LEVEL=build` is the built-in relaxation.
- Uninstall entirely: `/plugin uninstall powers@powers`.
