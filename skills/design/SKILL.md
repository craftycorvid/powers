---
name: design
description: >-
  Turn a new-project idea into a committed docs/DESIGN.md — a high-level view
  of the project and a phased plan for building it. Use when the user wants to
  start a new project ("I want to build X") and little or no code exists yet.
  NOT for features or changes inside an existing codebase — that's
  brainstorming — and not for small fixes or questions.
---

<!--
  Trigger sanity check — SHOULD fire:
    "I want to build a habit-tracker CLI" (empty repo)
    "let's start a new service that syncs my bookmarks"
    "new project: a static-site generator for recipe blogs"
  Should NOT fire:
    "add dark mode to the settings page"        (brainstorming)
    "I want export-to-CSV in the reports view"  (brainstorming)
    "fix this typo in the README"
  Explicit /powers:design also works in an existing repo, to retrofit a
  design doc onto a project that grew up without one.
-->

# Designing a New Project

Turn a project idea into a design document through dialogue, then commit it.
DESIGN.md holds the high-level view — what the project is, how it's shaped,
and the phased path to building it. It is the map the specs are drawn on.

<HARD-GATE>
Do NOT write production code, scaffold anything, or dispatch implementer
agents until docs/DESIGN.md is written, the user has READ IT and explicitly
approved it, and it is committed.

Design approval is its own stop point. Approval of a conversation that
_mentions_ the design is NOT approval of the document — only an explicit yes
to the finished DESIGN.md counts (`/powers:approve` counts). Present it, then
END YOUR TURN and wait.

No project is "too simple" — a simple project just gets a short design doc.
</HARD-GATE>

## Process

**1. Look at what exists.** An empty repo, a prototype, a README with
ambitions? Start from reality, not from the idea alone.

**2. Ask questions — one at a time.** One question per message, never a
batch. Prefer multiple choice when the options are enumerable. Focus on
purpose, users, constraints, tech preferences, and what success looks like.
Stop asking when you could write the design without guessing.

**3. Propose 2–3 architecture directions.** Present them conversationally
with tradeoffs, leading with your recommendation and why. Apply YAGNI
ruthlessly: strip anything not needed for the stated goal from every option,
and say what you stripped.

**4. Present the design in sections.** Each section short enough to review in
one read. Ask after each section whether it's right so far; revise before
moving on.

## The Document

Write the approved design to `docs/DESIGN.md`, with exactly these sections:

- **Overview** — what the project is, for whom, why it should exist.
- **Goals and non-goals** — explicit scope boundaries for the whole project.
- **Architecture** — the components and how they talk, the tech stack, and
  each key decision with the rejected alternatives and why they lost.
- **Phased plan** — ordered phases, each with a goal, deliverables, "done
  when" criteria, and a status marker (`not started` / `in progress` /
  `done`). Each phase must end with something working and demonstrable.
  Phases are milestones, not specs — when a phase's turn comes, it goes
  through brainstorming into its own committed spec.
- **Open questions** — anything unresolved, so it's visible rather than
  buried.

Self-review the file before showing it: any TBDs or placeholders? Sections
that contradict each other? A phase with no demonstrable outcome? Fix inline.

Ask the user to review the document. When they approve, **commit it on the
current branch** with message `design: <project-name>`. Then stop — what
happens next is the user's call, not a prompt.

## The Design Is Living

DESIGN.md tracks reality for the life of the project:

- When a phase's work lands, update its status marker and commit.
- When architecture or phasing changes — a component cut, a phase split, a
  decision reversed — edit the document and commit the edit. A design change
  that lives only in chat history is a design change that didn't happen.
