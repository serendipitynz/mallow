---
id: TASK-40.5
title: 'Shared design: give notices, warnings and error bands the shared level icons'
status: To Do
assignee: []
created_date: '2026-09-28 03:59'
labels:
  - design
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/App.tsx
  - src/components/ErrorBanner.tsx
  - src/components/Viewer.tsx
  - src/styles/source.scss
  - src/styles/table.scss
  - src/styles/xml.scss
  - src/styles/html.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The notice bar under the toolbar (.app__notice), the notices of the source, table, XML and HTML views, the syntax error bands (ErrorBanner, .doc-error) and the viewer's loading and failure placeholders tell their level by text and colour only, with no icon (snz-design doc-13 §4 and §7.1). Colour alone does not meet WCAG 1.4.1.

snz-design references: doc-9 §6.4 (notices and their levels); doc-8 §6.7 (in progress); doc-5 §3.2 (1.4.1); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each notice, warning and error band carries the icon of its level from doc-9 §6.4, so its level is not told by colour alone
- [ ] #2 The notice bar keeps its close button and role=status, and the syntax error bands keep role=alert and stay undismissable (doc-9 §6.4)
- [ ] #3 The viewer's loading and failure placeholders follow doc-9 §6.4 and doc-8 §6.7
- [ ] #4 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [ ] #5 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
