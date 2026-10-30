---
id: TASK-45
title: Put back and forward buttons in the toolbar
status: To Do
assignee: []
created_date: '2026-10-30 04:01'
labels:
  - feature
milestone: m-5
dependencies:
  - TASK-44
references:
  - src/components/Toolbar.tsx
  - src/App.tsx
  - src/components/icons.tsx
  - src/components/OpenWith.tsx
  - >-
    backlog/tasks/task-44 -
    Go-back-and-forward-through-the-files-a-window-has-shown-and-remember-how-each-was-being-read.md
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-44 gave each window a visit history, reachable from the keyboard (`Cmd+[` / `Cmd+]` on macOS, `Alt+Left` / `Alt+Right` on Windows and Linux), the mouse's side buttons and the View menu. Nothing on screen says the history exists: a reader who uses neither the chords nor the menu bar, or whose mouse has no side buttons, has no way to find it. This task adds the on-screen route — a back button and a forward button in the toolbar.

The buttons are a fourth entry to the same move, not a second implementation: they call the `go(direction)` `App` already hands the chords, the side buttons and the `menu:back` / `menu:forward` events, and they enable and disable on the same `canGoBack` / `canGoForward` that `report_history_moves` sends to the menu.

They are icon-only buttons in the sense of snz-design doc-8 §6.2, so they carry a word for the reader even though none is drawn, and where there is nowhere to go they are disabled in the way doc-8 §5.4 asks: shaped and worded, still focusable, the reason reaching the reader — the `aria-disabled` form `OpenWith`'s trigger already uses, not the `disabled` attribute. The toolbar's layout is an app-specific exception in snz-design's adoption record for mallow (doc-18), so where the pair sits is mallow's to decide; the rows for the toolbar's buttons in that record gain one when this lands, on the snz-design side.

To settle at the start: the pair's place in the toolbar (the lead group beside Open folder, where a browser puts them, is the default, and the explorer toggle's rule of sitting at the end on the explorer's side has to be kept), and the Lucide glyph (`arrow-left` / `arrow-right` or `chevron-left` / `chevron-right`).

Out of scope: a long-press or right-click list of the history entries, and showing the history anywhere else.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The toolbar carries a back button and a forward button; pressing one moves the window's visit history one step, through the same move the chords, the side buttons and the View menu use
- [ ] #2 Each button has a label that reaches the reader in both ja and en, and a tooltip that names the platform's chord (⌘[ / ⌘] on macOS, Alt+← / Alt+→ on Windows and Linux)
- [ ] #3 Where there is nowhere to go the button is disabled per snz-design doc-8 §5.4 — it keeps the focus, shows the disabled shape, and its reason in words reaches the reader — and its state agrees with the View menu's Back / Forward in every window
- [ ] #4 The icons are Lucide path data copied into components/icons.tsx, with no new dependency
- [ ] #5 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
