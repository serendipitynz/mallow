---
id: TASK-40.2
title: >-
  Shared design: split the theme choice into a colour-family setting and a light
  / dark menu
status: To Do
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-28 05:34'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/ThemePicker.tsx
  - src/components/OpenWith.tsx
  - src/components/Toolbar.tsx
  - src/components/SettingsModal.tsx
  - src/lib/theme.ts
  - index.html
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The toolbar's ThemePicker is a value menu over all seven theme ids, and OpenWith is an action menu; neither moves focus on open, closes on Escape, or returns focus to its trigger (snz-design doc-13 §4). snz-design decided that the colour family moves to the settings modal and the toolbar button opens a value menu of the light / dark mode: Light, Dark, and following the OS (doc-13 §10, the mallow row from TASK-25).

snz-design references: doc-9 §6.11 (menu, both the action and the value variant), §6.10 (select group), §5.1 and §5.2; doc-7 §4.2, §6.2 and §6.4 ③ (theme switching and reading stored values); doc-16 §6.2 (the startup script, which index.html and lib/theme.ts both carry).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The settings modal chooses the colour family, and the toolbar button opens a value menu of Light, Dark and following the OS
- [ ] #2 In a family that has only one side (Dracula, Nord) the unavailable items are disabled and carry their reason, and the current value keeps its mark even when the stored mode points at a disabled item
- [ ] #3 Stored settings from before the split open in the same scheme, and nothing stored is rewritten until the user chooses again (doc-7 §6.2)
- [ ] #4 Both menus (OpenWith and the mode menu) move focus to the first item on open, move with the arrows and wrap at the ends, close on Escape with focus back on the trigger, close on Tab, and draw :focus-visible on their items (doc-9 §6.11)
- [ ] #5 A choice made in one window reaches every other open window, checked with two windows
- [ ] #6 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [ ] #7 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
