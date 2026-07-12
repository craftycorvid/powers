---
name: systematic-debugging
description: >-
  Root-cause debugging discipline. Use when something is broken, crashing, or
  behaving unexpectedly; when a previously-passing test starts failing; when
  behavior differs between environments (works locally, fails on device/CI/
  server); or whenever the cause isn't already obvious from the error message.
  Do NOT use when the error states the cause (missing import, typo, lint/type
  error, wrong path), when the fix is a self-evident one-liner, or for new
  code that simply doesn't work yet — that's the tdd loop, not debugging.
---

<!--
  Adapted from the "systematic-debugging" skill in obra/superpowers
  (https://github.com/obra/superpowers), MIT licensed.

  Trigger sanity check — SHOULD fire:
    "the export worked yesterday and now returns an empty file"
    "works on my machine but 500s on staging"
    "this test started failing after the rebase and I don't see why"
    "the app crashes on the device but not in the simulator"
  Should NOT fire:
    "fix this typo in the README"
    "ImportError: No module named requests"
    "eslint says this variable is unused"
    "my new parser doesn't handle nested arrays yet"
-->

# Systematic Debugging

Guessing at fixes wastes time and plants new bugs. Find the mechanism first.

## Investigate Before Modifying

No production-code edits until the root cause is identified. Investigation
means all of these, not a subset:

- **Read the complete actual error output** — the full trace, not a paraphrase
  or the first line. Error text is evidence; summaries of it are not.
- **Reproduce reliably.** If you can't trigger it on demand, gather more data
  before theorizing.
- **Check recent changes.** `git log` / `git diff` against last-known-good is
  evidence — bugs that appeared have a commit that introduced them.
- **Trace the failing path in the real code** — open the files and follow the
  call chain. Never debug from memory of how the code probably works.

## One Hypothesis at a Time

State the hypothesis explicitly ("X because Y"). Design the smallest probe
that confirms or kills it — a log line, a targeted test, a REPL check. Run
it, record the result, then form the next hypothesis. Never change multiple
variables in one step: a fix you can't attribute is a fix you can't trust.

## Root Cause, Not Symptom

A fix must explain *why* the failure happened. Defensive additions — null
checks, try/catch, optional chaining, retries, sleeps — are forbidden as
fixes unless the investigation shows the absence of that guard IS the root
cause. If a change would make the symptom disappear without explaining the
mechanism, it's a symptom patch: reject it and keep investigating.

## Circuit Breaker: Three Strikes

If 3 fix attempts have failed, STOP — you are guessing, and desperation
patches are worse than no fix. Re-read the failing code paths end to end,
question your architectural assumptions out loud, then report findings and
remaining hypotheses to the user. Do not attempt a fourth patch.

## When Root Cause Is Found

Hand off to the **tdd** skill's bug flow: encode the reproduction as a
failing test, fix the cause, watch it go green, sweep for sibling defects.
This skill ends where the failing test begins.

## Context Hygiene (Optional)

When the investigation means reading many files or long traces, consider
dispatching a read-only agent (the code-reviewer agent, or an inline
read-only task) to trace the path and report a summary — dead-end
exploration stays out of the main session. Per-bug judgment, not ceremony.
