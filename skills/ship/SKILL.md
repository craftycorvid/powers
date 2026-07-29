---
name: ship
description: >-
  Shortcut for "Open the PR, wait for Copilot's review, then fix anything
  relevant it brings up." Invoke when the body of work on the current branch
  is done.
disable-model-invocation: true
---

# Ship: PR → Copilot Review → Fix

The work on the current branch is done. Get it into a reviewed, green PR.

## 1. Preflight

- Working tree clean — everything meant to ship is committed. Uncommitted
  changes are a stop: show them and ask whether to commit or drop.
- Verify passes (`scripts/verify.sh` or the repo's test command). Red means
  fix first, not ship anyway.

## 2. Open the PR

Push the branch and open a PR against the repo's default branch. Title from
the spec slug where one exists; body summarizes what shipped and links the
spec file. Follow the repo's PR template if it has one. If a PR for this
branch already exists, reuse it — push and continue.

## 3. Request Copilot's review

Check whether the repo auto-requests Copilot on new PRs (a pending review
request from Copilot appears immediately). If not, request it:

```
gh api --method POST repos/{owner}/{repo}/pulls/{number}/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

## 4. Wait for the review

If the environment has a PR-watch tool (e.g. `subscribe_pr_activity`),
subscribe and end the turn — the review arrives as an event. Otherwise poll
(`gh pr view --json reviews` or the reviews API) roughly every minute. After
~10 minutes with no review, report the PR URL and stop waiting — don't spin
forever.

## 5. Triage and fix

Go through every comment in Copilot's review. Each one gets exactly one of:

- **Fix** — it's a real issue in scope. Fix it test-first per the tdd skill
  and push.
- **Skip, with a stated reason** — false positive, out of scope, or contradicts
  the spec. One line each; reply on the thread only where a reply is genuinely
  useful.

Never silently ignore a comment, and never "fix" something by weakening a
test or the spec.

## 6. Report

PR URL, what was fixed (with commits), what was skipped and why, and current
CI state.
