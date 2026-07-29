---
name: approve
description: >-
  Shortcut for "Approved. Commit the spec, then plan the implementation."
  Invoke after reviewing the spec a brainstorm produced. Counts as the
  explicit spec approval the brainstorming hard-gate waits for.
disable-model-invocation: true
---

# Spec Approved → Plan

The user has read the spec file just presented and approves it as written.
This invocation **is** the explicit approval the brainstorming hard-gate
requires — no further confirmation needed.

**Guard first.** If no spec file is awaiting approval in this conversation —
no brainstorm happened, or the spec was already approved and committed — say
so and stop. Approval of nothing is nothing.

Then:

1. **Commit the spec** on the current branch with message `spec: <slug>`,
   per the brainstorming skill. If the spec file is already committed and
   unchanged since, skip the commit rather than creating an empty one.
2. **Enter plan mode** and plan the implementation of that spec. The spec is
   the contract: plan tasks should map to its acceptance criteria, and its
   scope boundaries bound the plan. Nothing in the plan may widen the spec —
   if planning surfaces a scope problem, that's a spec edit (and commit)
   first.

Approval covers exactly the spec as it stands at invocation. If the user
attached changes to this invocation, that's not approval yet — apply the
changes, re-present the spec, and wait.
