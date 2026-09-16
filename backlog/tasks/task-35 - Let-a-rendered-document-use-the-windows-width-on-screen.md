---
id: TASK-35
title: 'Let a rendered document use the window''s width, on screen'
status: To Do
assignee: []
created_date: '2026-09-16 00:38'
updated_date: '2026-09-16 00:42'
labels:
  - feature
milestone: m-4
dependencies:
  - TASK-34
priority: high
type: feature
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement TASK-34's answer on screen: a document wider than the article should
gain from a wider window.

Today it does not, and the two caps swap depending on the outline state
(TASK-34 carries the measured numbers). The reader's report was a 9-column
table — `_sandbox/samples/table-api-endpoints.md` — which scrolls inside an
article whose width does not move.

**Nothing is lost on screen**, which is what separates this from TASK-36:
`.markdown-body table` is `display: block; width: max-content; overflow: auto`,
so the whole table is reachable by scrolling it. What is limited is how much is
visible at once. On paper the same declarations lose content outright.

## Where the risk is

- **The single scroll region.** `.doc-scroll` is it (decision-3, decision-9,
  TASK-8). The table's own horizontal scroll is fine and already exists; the
  page acquiring one is not.
- **The heading jump and the scroll spy.** They cross from TypeScript into CSS
  and back through one measured value (`--doc-bar-height` → `scroll-margin-top`
  → read back off a heading). A layout change is exactly what breaks them, and
  nothing automated sees it.
- **`HtmlView` sits in the same `.doc__body` grid cell** as the markdown
  article, and its height loop re-measures at the height currently applied. A
  width change asks that loop for a restart by design, so check the frame
  converges rather than oscillating.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Widening the window widens what the reader can see of a document that is wider than the current cap, in both outline states — the failure today is that the outline-closed state is governed by a different cap than the one the reader would think to change
- [ ] #2 A table wider than the article keeps its horizontal scroll rather than forcing the page to scroll horizontally: .doc-scroll must stay the single scroll region TASK-8 and decision-3 rest on
- [ ] #3 Prose measure is not sacrificed to the table — whatever the answer, a paragraph does not become one line across a 2560px monitor
- [ ] #4 The rendered HTML frame reaches the same width as the markdown article, since both sit in the same .doc__body grid cell
- [ ] #5 The change is what TASK-34's decision says, not a number chosen here; if implementing it shows the decision cannot hold, the decision is revised rather than departed from
- [ ] #6 pnpm build and pnpm test pass, and the outline jump and scroll spy still land correctly — they read scroll-margin-top off a heading, so a layout change is exactly what can break them
<!-- AC:END -->
