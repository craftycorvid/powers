# powers

A thin, personal Claude Code plugin for a disciplined dev workflow:
**brainstorm → committed spec → test-first implementation in worktrees →
adversarial review → hard verify gate.**

## What's in the box

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
- **`code-reviewer` agent** — read-only (Read/Grep/Glob, haiku), reviews a
  diff against its spec for correctness, scope creep, and missing tests.
- **verify gate** — a `SubagentStop` hook. Blocks a finishing subagent if it
  changed source without tests (`VERIFY_LEVEL=tdd`) or if the repo's verify
  command fails.
- **`setup` skill** — `/powers:setup` rolls a repo out: detects test/build
  commands, asks for `VERIFY_LEVEL`, generates CLAUDE.md + verify.sh, commits.
- **`approve` shortcut** — `/powers:approve` after reviewing a brainstormed
  spec: counts as explicit approval, commits the spec, enters plan mode.
  User-invoked only.
- **`ship` shortcut** — `/powers:ship` when the branch's work is done: opens
  the PR, requests + waits for Copilot's review, fixes what's relevant, states
  why the rest was skipped. User-invoked only.

## Install

The repo is its own marketplace:

```
/plugin marketplace add craftycorvid/powers
/plugin install powers@powers
```

## Per-repo rollout

Run `/powers:setup` in the repo. It detects the project's test/build commands,
asks which `VERIFY_LEVEL` you want (`tdd` strict / `build` relaxed), generates
`CLAUDE.md` and `scripts/verify.sh` from the templates, runs verify.sh to
prove it works, and commits both. It never overwrites existing files — on an
already-configured repo it only offers what's missing.

Manual fallback (what setup automates):

1. `CLAUDE.md` — copy `templates/CLAUDE.md.template`, fill in invariants,
   commands, pointers, and the `VERIFY_LEVEL=` line.
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

## How is this different from superpowers?

The design rule: lean on Claude Code's native primitives instead of rebuilding
them. Deliberately absent, and what covers it instead:

| Not built                          | Native feature that covers it               |
| ---------------------------------- | ------------------------------------------- |
| Worktree management skill          | `isolation: worktree` agent frontmatter     |
| Plan orchestrator / task sequencer | Plan Mode + subagent dispatch               |
| Session-start skill index hook     | Skill auto-routing from descriptions        |
| Multi-harness compatibility layer  | This runs in Claude Code, period            |
| Review-loop orchestration          | One `code-reviewer` agent; native iteration |
