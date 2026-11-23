---
id: TASK-74
title: Find where the time to render a code-heavy markdown document goes
status: To Do
assignee: []
created_date: '2026-11-23 06:07'
labels:
  - research
dependencies: []
priority: low
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-70 (doc-3) timed, from the launch command to the last change of the window on screen, mallow 0.15.0 and three other viewers opening generated documents. On the ~200 KiB Medium document (headings, tables, code blocks) mallow was the **slowest of the four, 1,576 ms** against MD Viewer 1,477, Marky 1,304 and SkimDown 978, with no overlap across five runs; on the ~1 MiB Large document (378 code blocks) it took 3,436 ms against Marky's 2,938 and SkimDown's 1,709, though MD Viewer took 4,377. On the Small document the four were within 0.2 s of each other, so the gap grows with the document, which points at per-block work (Shiki highlighting, the markdown pipeline, the enhancements effect) rather than at launch.

Find where the time between the document's text arriving and the last change on screen goes, on a built app (Web Inspector's timeline), and say which part is avoidable — for instance highlighting blocks that are not on screen yet. Measure any change with doc-2's procedure against doc-3's Medium and Large numbers.

Out of scope: a change before the cause is known; launch time, where mallow is within the others' spread.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The render time of doc-3's Medium and Large documents is broken down by phase on a built app
- [ ] #2 Each avoidable part is named with its expected saving, and the change that would remove it is proposed (as this task's own change or as a follow-up task)
- [ ] #3 Any change made is measured with doc-2's procedure, five runs, against doc-3's Medium and Large complete times
<!-- AC:END -->
