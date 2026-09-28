---
id: TASK-40.6
title: >-
  Shared design: bring the settings modal and the update dialog to the shared
  modal spec
status: To Do
assignee: []
created_date: '2026-09-28 03:59'
labels:
  - design
dependencies:
  - TASK-40.1
  - TASK-40.2
references:
  - ../snz-design
  - src/components/SettingsModal.tsx
  - src/components/UpdateDialog.tsx
  - src/styles/app.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on TASK-40.1 and after TASK-40.2 (which adds the colour-family choice to the settings modal). Neither modal moves focus in on open, traps it, or returns it on close, and the whole surface scrolls with its heading. The update dialog removes its × at the stages that cannot be closed, and its indeterminate progress stops under reduced motion (snz-design doc-13 §4 and §10). The settings' segmented controls still have the pre-TASK-29 form. snz_studio made the same move for its modals in its TASK-61 (fixed heading, scrolling body); snz-design TASK-30 set the action area's alignment and order.

snz-design references: doc-9 §6.6 (modal), §6.12 (segmented control, as revised by snz-design TASK-29), §5.1 and §5.3; doc-8 §6.7.1 (progress); doc-16 §6.3 (focus rings inside a scroll box); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both modals move focus in on open, trap it and return it on close; Escape and the overlay click still close, and the update dialog over the settings modal still leaves the settings inert (doc-9 §6.6)
- [ ] #2 When a modal is taller than the window, the heading and × stay and only the body scrolls, and a focused control is neither hidden behind the fixed areas nor clipped by the scroll box (doc-9 §6.6, doc-16 §6.3); no horizontal scroll at 360px wide or on a short window
- [ ] #3 The action area follows the alignment and order of doc-9 §6.6
- [ ] #4 The settings' segmented controls take the form of doc-9 §6.12: one Tab stop per group, arrows move without choosing, and the chosen surface slides, cross-fading under reduced motion
- [ ] #5 At the update stages that cannot be closed, the × is handled per doc-9 §6.6 (removed, or disabled with a reason) and the choice is recorded; the indeterminate progress slows rather than stops under reduced motion (doc-8 §6.7.1)
- [ ] #6 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [ ] #7 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
