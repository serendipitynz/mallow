---
id: TASK-50
title: >-
  Give the explorer's rows a context menu with Open in and the two copy-path
  entries
status: To Do
assignee: []
created_date: '2026-11-11 01:29'
labels:
  - feature
dependencies: []
references:
  - src/components/FileTree.tsx
  - src/components/Explorer.tsx
  - src/components/OpenWith.tsx
  - src/hooks/useMenu.ts
  - src-tauri/src/editors.rs
priority: medium
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every way to act on a file outside mallow — open it in a detected editor, hand it to the OS default app, reveal it in Finder / Explorer / the file manager — is reached from the toolbar's Open menu (`OpenWith`), and only for the file already selected. A reader working in the explorer has to select a row first and then travel to the toolbar, and there is no way at all to copy a file's path. This task adds a context menu on the explorer's rows.

The menu carries:
- **Open** with a submenu holding exactly what `OpenWith` offers today: one entry per detected editor, the OS default app, and Reveal in Finder / Explorer / the file manager. It is the same list built from the same `detectEditors` answer, not a second list that can drift from the toolbar's.
- **Copy path** — the absolute path, as the tree holds it.
- **Copy relative path** — the path relative to the folder the window has open, separated the way the platform separates paths.

The row the menu acts on is the row it was opened on, not the selected file; opening the menu does not change the selection or open the file.

To settle at the start:
- Native popup (`Menu.popup()` from `@tauri-apps/api/menu`, which needs `core:menu:default` checked against `core:default`) or a DOM menu built on `useMenu`. The native one gives each platform's own look and submenu behaviour; the DOM one follows snz-design doc-9 §6.11 and stays inside the app's palette. Whichever is chosen, the menu labels follow the app's ja / en, unlike the native menu bar's English-only labels.
- What a directory row offers: both copy entries apply as they are; Reveal applies; whether an editor entry is offered depends on whether `open_in_editor` hands a folder to every detected editor correctly, which has to be read in `editors.rs` rather than assumed.
- Whether the toolbar's Open menu gains the two copy entries too, so the selected file can be copied without the explorer.

The menu is reachable from the keyboard on a focused row (the ContextMenu key and Shift+F10), and Escape returns the focus to that row. The WebView's own context menu does not appear over a row.

Out of scope: a context menu inside the viewers, and file operations (rename, delete, new file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Right-clicking a row in the explorer opens a menu with Open (a submenu), Copy path and Copy relative path, acting on that row, without changing the selection
- [ ] #2 The Open submenu lists the same editors, default-app entry and reveal entry the toolbar's Open menu lists, from the same detectEditors answer
- [ ] #3 Copy path puts the absolute path on the clipboard; Copy relative path puts the path relative to the window's open folder, using the platform's separator
- [ ] #4 The menu opens from the keyboard on a focused row (ContextMenu key, Shift+F10), and Escape returns the focus to the row
- [ ] #5 Every label reaches the reader in both ja and en
- [ ] #6 What a directory row offers is settled and written down in the task, and each entry it shows works
- [ ] #7 pnpm lint, pnpm build and pnpm test pass, and any new pure logic (the relative path) is unit-tested
<!-- AC:END -->
