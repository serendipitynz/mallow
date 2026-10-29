---
id: TASK-44
title: >-
  Go back and forward through the files a window has shown, and remember how
  each was being read
status: To Do
assignee: []
created_date: '2026-10-29 21:50'
updated_date: '2026-10-29 22:22'
labels:
  - feature
milestone: m-5
dependencies: []
references:
  - src/App.tsx
  - src/components/Viewer.tsx
  - src/lib/scroll.ts
  - src/lib/chord.ts
  - src-tauri/src/menu.rs
  - backlog/tasks/task-13 - Keep-several-documents-open-as-tabs-in-one-window.md
  - >-
    backlog/decisions/decision-4 -
    Tabs-carry-documents-inside-one-folder-windows-carry-side-by-side-comparison.md
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting a second file in the tree replaces the first, and everything about the first is lost: `App` holds one `selected`, `Viewer` remounts the body on `key={file.path}`, and each view keeps its view mode in local state (`MarkdownView`'s preview / source, `HtmlView`'s rendered / source, `TableView`, `ConfigView`, `XmlView`). Going back means finding the file in the tree again and then finding the place again.

TASK-13 answers this with tabs. This task answers the same complaint with less: a back / forward history per window, and a per-file memory of how the file was being read. It is meant as a trial before tabs are built — if the return trip stops hurting, the tab strip may not be needed; if the need to keep a working set of files open remains, tabs still go ahead, and the view-state memory here is the same machinery TASK-13.2 asks for, so nothing is thrown away.

Two terms, used in this task for these things:

- **visit history** — a window's ordered list of files it has shown, with a cursor on the one on screen. Back and forward move the cursor; opening a file by any other route drops everything after the cursor and appends the file. It belongs to the window's folder: changing the folder empties it, for the reason decision-4's rule 7 empties the tab set.
- **file view state** — what is remembered per file inside one window and restored when the file is shown again, by history or by the tree alike: the view mode its kind offers, and the scroll position as a `lib/scroll` anchor (`captureScrollAnchor` / `restoreScrollAnchor`), captured when the file is replaced on screen. Restoring by anchor rather than by `scrollTop` keeps it right after the file changed on disk in between.

Out of scope: following a link to a local `.md` file (the link stays inert; a later task can make it a history entry), restoring the history across a relaunch (the restored session keeps carrying only what is on screen), and tabs themselves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Showing a file from the tree, Open Recent or a location the OS handed over appends it to the window's visit history; showing the file already on screen, a live reload, and a move by back / forward append nothing
- [ ] #2 Back and forward are reachable from the keyboard (Cmd+[ / Cmd+] on macOS, Alt+Left / Alt+Right on Windows and Linux), from the mouse's back / forward buttons, and from menu items that are disabled when there is nowhere to go
- [ ] #3 Each chord is consumed even where there is nowhere to go, so WebView2's own Alt+Left navigation never reaches the app shell
- [ ] #4 Returning to a file by history or by the tree restores its view mode and scroll position, for every kind that offers a view switch
- [ ] #5 A history entry whose file no longer exists is skipped rather than shown as an error
- [ ] #6 Changing the window's folder empties its visit history and its file view state; another window's history is untouched
- [ ] #7 The history and the view-state memory are bounded, with the limits and the reason for them stated where they are defined
- [ ] #8 The history logic is a pure module with unit tests; pnpm lint, pnpm build and pnpm test pass, and cargo check / cargo test pass if the menu changes
- [ ] #9 README describes back / forward and the chords on each platform
<!-- AC:END -->
