---
name: brainstorming
description: >-
  Turn a rough idea into a committed spec before any code is written. Use when
  the user describes a new feature, a significant change, or says "I want X"
  without a concrete design. Do NOT use for small fixes, typos, refactors, or
  questions — those need no spec.
---

<!--
  Adapted from the "brainstorming" skill in obra/superpowers
  (https://github.com/obra/superpowers), MIT licensed. Socratic core retained;
  visual companion, task checklist, and Superpowers pipeline handoffs removed.
-->

# Brainstorming Ideas Into Specs

Turn an idea into a spec through dialogue, then commit the spec to git. The
spec — not the conversation — is the contract implementation works against.

<HARD-GATE>
Do NOT write production code, scaffold anything, or dispatch implementer
agents until the spec file is written, the user has READ IT and explicitly
approved it, and it is committed.

Spec approval is its own stop point. Approval of a plan, a proposal, or a
conversation that _mentions_ the spec is NOT approval of the spec — only an
explicit yes to the finished spec file counts. If you are operating under an
approved Plan-Mode plan that includes writing this spec: write the spec,
present it, then END YOUR TURN and wait. The plan resumes only after the
spec itself is approved.

No project is "too simple" — a simple project just gets a short spec.
</HARD-GATE>

## Process

**1. Understand the context.** Look at the project first: files, docs, recent
commits. If `docs/DESIGN.md` exists, read it — the spec must fit its
architecture and current phase, and a feature that conflicts with it means a
design-doc edit (and commit), not a silent divergence. If the request spans
multiple independent subsystems, say so before refining details — help
decompose it, then brainstorm the first piece; each piece gets its own spec.

**2. Ask questions — one at a time.** One question per message, never a
batch. Prefer multiple choice when the options are enumerable. Focus on
purpose, constraints, and success criteria. Stop asking when you could write
the spec without guessing.

**3. Propose 2–3 approaches.** Present them conversationally with tradeoffs,
leading with your recommendation and why. Apply YAGNI ruthlessly: strip
anything not needed for the stated goal from every option, and say what you
stripped.

**4. Present the design in sections.** Each section short enough to review in
one read (a few sentences to ~200 words). Ask after each section whether it's
right so far; revise before moving on. Cover what the spec will cover — no
more.

## The Spec

Write the approved design to `docs/specs/YYYY-MM-DD-<slug>.md` in the host
repo, with exactly these sections:

- **Problem statement** — what's broken or missing, for whom.
- **Approach** — the chosen design, plus each rejected alternative with the
  reason it lost.
- **Scope boundaries** — explicit non-goals. What this deliberately does not do.
- **Acceptance criteria** — checkable statements that define "done".
- **Open questions** — anything unresolved, so it's visible rather than buried.

Self-review the file before showing it: any TBDs or placeholders? Sections
that contradict each other? A requirement readable two ways? Fix inline.

Ask the user to review the spec file. When they approve, **commit it on the
current branch** with message `spec: <slug>`. This commit must exist before
any implementation starts. (`/powers:approve` is the fast path: it counts as
explicit approval and continues into commit + plan mode.)

## The Spec Is Versioned

If scope changes during implementation — something cut, added, or reinterpreted
— edit the spec and commit the edit. A scope change that lives only in chat
history is a scope change that didn't happen.
