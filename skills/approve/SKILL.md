---
name: approve
description: >-
  Shortcut for "Approved — commit it and continue." Invoke after reviewing
  the document just presented: a spec (from brainstorming) or a design doc
  (from design). Counts as the explicit approval those hard-gates wait for.
disable-model-invocation: true
---

# Document Approved

The user has read the document just presented — a spec or a design doc — and
approves it as written. This invocation **is** the explicit approval the
presenting skill's hard-gate requires; no further confirmation needed.

**Guard first.** If no document is awaiting approval in this conversation —
no brainstorm or design session happened, or the document was already
approved and committed — say so and stop. Approval of nothing is nothing.

**Commit the document** on the current branch: `spec: <slug>` for a spec,
`design: <project-name>` for a design doc. If the file is already committed
and unchanged since, skip the commit rather than creating an empty one.

Then continue by document type:

- **Spec → enter plan mode** and plan the implementation. The spec is the
  contract: plan tasks should map to its acceptance criteria, and its scope
  boundaries bound the plan. Nothing in the plan may widen the spec — if
  planning surfaces a scope problem, that's a spec edit (and commit) first.
- **Design doc → stop.** The design skill's job ends at the committed
  DESIGN.md; what happens next is the user's call.

Approval covers exactly the document as it stands at invocation. If the user
attached changes to this invocation, that's not approval yet — apply the
changes, re-present the document, and wait.
