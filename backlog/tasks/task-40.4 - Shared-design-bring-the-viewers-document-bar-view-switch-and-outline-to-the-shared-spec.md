---
id: TASK-40.4
title: >-
  Shared design: bring the viewer's document bar, view switch and outline to the
  shared spec
status: To Do
assignee: []
created_date: '2026-09-28 03:59'
labels:
  - design
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/Viewer.tsx
  - src/components/Outline.tsx
  - src/components/MarkdownView.tsx
  - src/styles/markdown.scss
  - src/styles/source.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The switch between preview and source (and the other views) is a row of aria-pressed buttons in .seg, though it swaps what the same place shows, which is a tab list in the shared spec. The outline shows its current location with a line and colour but no surface, and its toggle sits in the sticky document bar outside the outline it removes (snz-design doc-13 §4 and §7.1). The document bar's behaviour from TASK-20 (heading jumps clear the bar) and TASK-22 (the bar never paints over the toolbar's menus) is kept.

snz-design references: doc-9 §6.7 (tabs), §6.8 (navigation, current location), §6.3.1 (showing and hiding a region); doc-8 §6.2 (icon-only button); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The view switches in the Markdown, config, table, XML and HTML views are read as tabs and move with the arrows inside the group (doc-9 §6.7)
- [ ] #2 The outline's current location carries the surface as well as its band and aria-current (doc-9 §6.8)
- [ ] #3 The outline toggle states whether the outline is shown, and focus has a defined destination when the outline goes away (doc-9 §6.3.1)
- [ ] #4 The document bar's icon-only buttons follow doc-8 §6.2, heading jumps still clear the sticky bar, and the bar still never covers the toolbar's menus
- [ ] #5 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [ ] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
