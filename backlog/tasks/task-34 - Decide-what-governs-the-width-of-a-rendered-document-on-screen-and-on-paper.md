---
id: TASK-34
title: 'Decide what governs the width of a rendered document, on screen and on paper'
status: To Do
assignee: []
created_date: '2026-09-16 00:38'
labels:
  - feature
milestone: m-4
dependencies: []
priority: high
type: feature
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A rendered document does not widen with the window. The reader hit it on a
9-column table (`_sandbox/samples/table-api-endpoints.md`): the table scrolls
inside the article, and making the window wider adds nothing to what is visible.

**Two caps exist and which one binds depends on the outline**, which is why
raising the one a reader would find does not reliably change anything:

| outline | what limits the article | measured |
|---|---|---|
| open | `.doc { max-width: 1180px }` minus `padding 0 32px`, minus `.doc__body`'s `gap: 3rem` and `$outline-width: 15rem` | **828px** |
| closed | `.doc .markdown-body { max-width: 53rem }`, since `.doc.is-outline-closed` collapses the grid to one column and `margin-inline: auto` centres it | **848px** |

So with the outline open the 1180px binds and 53rem never applies; with it
closed they swap. `markdown.scss:12` and `markdown.scss:552` are the two
declarations.

**This task decides, it does not implement.** TASK-35 changes the screen and
TASK-36 changes the paper, and both are downstream of the answer here. It is
listed first for the reason TASK-27 was: the answer can move what the other two
are allowed to do.

## What has to be settled

- **What the cap is for.** Written down as a reason, so a later change is judged
  against something other than a number. Prose measure is the obvious candidate
  — a paragraph running the full width of a 2560px monitor is unreadable — but
  that reason, taken alone, says nothing about a table, which has no measure.
- **Whether a wide element may exceed it.** A table is the case that raised
  this. `pre`, `img` and the rendered HTML frame are open in the same way and
  are not to be discovered one at a time.
- **Whether the cap is fixed, per window, or a preference.** A preference is
  app-wide here (TASK-12.8, TASK-33) and carries a key, a propagation and a
  place in the settings modal; a fixed value carries none of that. Do not
  introduce a per-window preference as a side effect — TASK-12 put those out of
  scope.
- **Which views the answer binds.** `.doc` is shared: `ConfigView`,
  `MermaidView`, `TableView` and `HtmlView` all use it, `config.scss` and
  `xml.scss` set 960px of their own, and `table.scss` already sets
  `max-width: none`. An answer that speaks only of markdown leaves four views in
  an unstated state.

## What must not be given up

`.doc-scroll` is the single scroll region decision-3, decision-9 and TASK-8 all
rest on. A change that makes the page scroll horizontally, or that gives a wide
element a second scroll region the outline jump has to reach through, is not a
widening — it is the defect those three went to some trouble to avoid.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The contract states which of the two caps applies in which outline state, with the measured numbers: .doc's 1180px leaves the article 828px with the outline open, and .markdown-body's 53rem (848px) is what binds once .doc.is-outline-closed collapses the grid to one column
- [ ] #2 The contract states whether the cap is a fixed value, a per-window state, or a persisted preference, and if a preference, which key holds it and how it reaches every window
- [ ] #3 The contract states whether an element wider than the cap may exceed it, and if so which elements and by what mechanism — a table is the case that motivated this, but the same question is open for pre, img and the rendered HTML frame
- [ ] #4 The contract states what the cap is for, so a later change can be judged against a reason rather than against a number
- [ ] #5 The answer is recorded as a decision under backlog/decisions, and the affected AGENTS.md / AGENTS.ja.md paragraphs are revised in the same PR with the two files carrying the same content
- [ ] #6 The decision names which views the answer binds: markdown is the one asked about, but .doc is shared by ConfigView, MermaidView, TableView and HtmlView, and config.scss and xml.scss set 960px of their own
<!-- AC:END -->
