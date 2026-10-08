---
name: setup
description: >-
  Set up the current repo for the powers workflow: generate CLAUDE.md and
  scripts/verify.sh from the plugin templates, detecting what's detectable and
  asking about the rest. Use when the user asks to set up / initialize powers
  in a repo. NOT for general project scaffolding.
allowed-tools: Read, Write, Bash(git *), Bash(chmod *)
---

# Set Up a Repo for powers

Produce the rollout files — `CLAUDE.md` (Claude Code) and/or `AGENTS.md`
(OpenCode) plus `scripts/verify.sh` — filled in for THIS repo, prove they
work, and commit them.

**Never clobber.** If `CLAUDE.md` already exists, don't overwrite it: check
what's missing (a `VERIFY_LEVEL=` line, Commands or Pointers sections) and
offer to append only that. If `scripts/verify.sh` exists, leave it as-is and
just run it (step 5). If every file the repo's harnesses need already exists
and nothing is missing, say the repo is already set up and stop.

## 1. Detect

Look before asking. From the repo, determine:

- **Name + one-liner** — package.json / Cargo.toml / pyproject.toml, else the
  directory name.
- **Test command** — package.json `test` script, `cargo test`, `./gradlew build`,
  pytest (pytest.ini / tests/ + Python), Makefile `test` target, `go test ./...`.
- **Build command**, if distinct from test.
- **Entry point** — main/bin from the manifest, or the obvious src root.
- Whether any test infrastructure exists at all — this drives the
  recommendation in step 2.

## 2. Ask

One AskUserQuestion round, not an interrogation:

- **VERIFY_LEVEL** — recommend `tdd` (strict: source changes require test
  changes); recommend `build` instead if step 1 found no test infrastructure.
- **Harnesses** — detect which are in use (see step 4): Claude Code via
  `command -v claude`, OpenCode via `command -v opencode`. If detection is
  ambiguous, ask whether the repo is used from Claude Code, OpenCode, or both.
- **Test command** — only if detection was ambiguous (multiple candidates or
  none). Skip the question when detection was clear.

Do not ask about invariants — the template's commented prompts stay in place
for the user to fill in later.

## 3. Generate

Fill the plugin templates with what steps 1–2 established and write them to
the repo:

- `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md.template` → `CLAUDE.md`
  (name, one-liner, VERIFY_LEVEL, commands, entry point; leave the Invariants
  comments untouched) — when Claude Code is in use.
- `${CLAUDE_PLUGIN_ROOT}/templates/verify.sh.template` → `scripts/verify.sh`
  with the real test command. `chmod +x scripts/verify.sh`.

## 4. OpenCode (when present)

The powers OpenCode plugin itself is installed separately — via
`opencode plugin add github:craftycorvid/powers`, or a `plugins` entry in
`opencode.json`. This step only handles the repo-local and global files the
plugin relies on.

If OpenCode is in play (detected in step 2):

- **`AGENTS.md`** — generate it from
  `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md.template`, with the same
  never-clobber rules as `CLAUDE.md`. OpenCode reads `AGENTS.md`; Claude Code
  reads `CLAUDE.md`. If both harnesses are in use, generate **both** files
  with identical content (same name, VERIFY_LEVEL, commands, entry point).
- **Global agents** — copy
  `${CLAUDE_PLUGIN_ROOT}/opencode-plugin/agents/implementer.md` and
  `code-reviewer.md` into `~/.config/opencode/agents/` (create the directory
  if missing). OpenCode plugins cannot register agents, so these must be
  installed as files. Never clobber: if a target file already exists and
  differs, report it and skip that copy.

## 5. Prove and Commit

Run `scripts/verify.sh`. Green → commit the generated files (`CLAUDE.md`,
`AGENTS.md` when generated, and `scripts/verify.sh`) on the current branch:
`chore: set up powers workflow`. Red → show the failure and ask whether to fix
the command or commit anyway; never commit a broken verify.sh silently.

If this isn't a git repo, offer `git init` first — the verify gate is a no-op
outside git, so setup without git buys nothing.
