---
id: TASK-40.3
title: >-
  Shared design: bring the explorer, its tree and the split handle to the shared
  spec
status: To Do
assignee: []
created_date: '2026-09-28 03:58'
labels:
  - design
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/Explorer.tsx
  - src/components/FileTree.tsx
  - src/components/RecentFolders.tsx
  - src/App.tsx
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. Every tree row is a button of its own, so the tree takes as many Tab stops as it has rows, and a failure to read children is told in text alone. The split handle between the explorer and the viewer changes width only by dragging (snz-design doc-13 §4 and §7.1). TASK-37 (hiding and showing the explorer) touches the same pane; whichever lands second follows the other's shape.

snz-design references: doc-9 §6.1.1 (tree), §6.3 (panel), §6.8 (navigation; the recent-folder list is its sidebar variant without a current location), §6.4 (failure level), §5.4 (empty); doc-5 §4.1 (WCAG 2.5.7, a single-pointer alternative to dragging); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The tree is one Tab stop: up and down move between rows, right and left open, close or move to the parent, Home and End reach the first and last rows, and closing a row moves focus from a descendant to that row (doc-9 §6.1.1)
- [ ] #2 Selection, hover, loading, empty and failure in the tree follow doc-9 §6.1.1, and a failure to read children carries the failure-level icon (doc-9 §6.4)
- [ ] #3 The empty window and the recent-folder list follow doc-9 §6.8 and §5.4
- [ ] #4 The explorer's width can be changed without dragging: from the keyboard on the focused handle, and with a single-pointer alternative (doc-5 §4.1)
- [ ] #5 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [ ] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
