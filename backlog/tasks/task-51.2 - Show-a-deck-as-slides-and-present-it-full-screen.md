---
id: TASK-51.2
title: Show a deck as slides and present it full-screen
status: To Do
assignee: []
created_date: '2026-11-11 01:30'
labels:
  - feature
dependencies:
  - TASK-51.1
references:
  - src/components/MarkdownView.tsx
  - src/components/Segmented.tsx
  - src/lib/chord.ts
  - src/hooks/useViewMemory.ts
  - src-tauri/capabilities/default.json
parent_task_id: TASK-51
priority: medium
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds the view TASK-51.1 decided on.

A `marp: true` document gains a third choice in the markdown view switch beside preview and source: Slides. It shows one slide at a time scaled to the view, with the slide number, and moves with the arrow keys, Page Up / Page Down, Space / Shift+Space, Home / End and on-screen previous / next buttons. A document without `marp: true` does not offer the choice.

Present enters a full-screen presentation of the current slide: the window goes full-screen (`core:window:allow-set-fullscreen` is not in the capability today and has to be added), the toolbar, explorer and document bar are hidden, the same keys move between slides, a click advances, and Escape leaves and puts the window back as it was.

To settle at the start: the chord that starts presenting (a browser-like F5 or Cmd+Enter / Ctrl+Enter, checked against what WebView2 binds, which lib/chord's rule says to consume rather than concede), and whether the slide reached is remembered by the view memory TASK-44 keeps per file.

What find, the outline, Print… and Export as PDF… do while Slides is shown has to be decided rather than left to fall out: the print gate is "markdown in preview", which Slides is not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A marp: true document offers Slides in the markdown view switch; other documents do not
- [ ] #2 Slides shows one slide at a time scaled to the view, with its number, and moves by the listed keys and the on-screen buttons
- [ ] #3 Present shows the current slide full-screen with the app's chrome hidden, moves by the same keys and a click, and Escape restores the window as it was
- [ ] #4 What find, the outline, Print and Export as PDF do while Slides is shown is decided and written down, and the menu's gates agree with it
- [ ] #5 Every new label reaches the reader in both ja and en
- [ ] #6 pnpm lint, pnpm build and pnpm test pass; the slide split and navigation logic are unit-tested
<!-- AC:END -->
