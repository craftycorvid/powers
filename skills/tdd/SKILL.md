---
name: tdd
description: >-
  Test-driven development discipline. Use whenever writing or modifying
  production code — implementing a feature or fixing a bug. Not needed for
  docs, config, or pure test changes.
---

# TDD

## The Iron Law

No production code without a failing test that demands it. If production code
exists before its test, delete it and start again from the test — code written
first tends to get a test written *to pass*, which proves nothing.

## Features

1. Write the smallest failing test for the next behavior.
2. Run it. **Watch it fail for the right reason** — a failure message about
   the missing behavior, not a typo, import error, or setup problem.
3. Write the minimal production code that makes it green. Resist generality
   the test doesn't force.
4. Refactor with the test green.
5. Commit. Where practical, commit in pairs per task: `test: ...` then
   `feat: ...` — the history shows each behavior was demanded before it existed.

## Bugs

The failing test is the bug report made executable:

1. Reproduce the bug as a failing test **before touching the fix**. If you
   can't write a test that fails, you don't yet understand the bug.
2. Fix it. Watch the test go green.
3. Check for siblings: would the same test pattern catch the same mistake
   elsewhere (other call sites, other input classes, the copy-pasted twin)?
   Add those tests while the context is loaded.

## Escape Hatch

Check the host repo's CLAUDE.md for a `VERIFY_LEVEL=` line. If it says
`VERIFY_LEVEL=build`, the hard gate in that repo is only that the build/verify
passes — tests are still the right way to work, but src-without-tests won't be
blocked. Default (`VERIFY_LEVEL=tdd` or no line) means the gate enforces this
skill: source changes without accompanying test changes will be rejected.
