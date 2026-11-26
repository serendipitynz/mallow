---
id: TASK-75
title: Show the native menu in the app's UI language
status: To Do
assignee: []
created_date: '2026-11-26T23:57:00Z'
labels:
  - feature
dependencies: []
references:
  - src-tauri/src/menu.rs
  - src/lib/i18n.tsx
  - src-tauri/src/settings.rs
  - src/lib/settings-sync.ts
  - AGENTS.md
priority: low
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The native menu bar is English whatever language the app's UI is in. Every label in `src-tauri/src/menu.rs` is an English literal — the File, Edit, View, Window and Help submenus, their items, Open Recent's "No Recent Folders" entry and the macOS-only Install / Uninstall 'mallow' Command… items — while the rest of the UI follows `lib/i18n` (ja / en). Seen again while preparing the Microsoft Store screenshots (TASK-64, 2026-11-27): the Japanese set shows `File / Edit / View / Help` above a Japanese UI.

**Why it is English today.** TASK-12.4 kept it so ("Menu labels stay English"): the menu is built in Rust, in `setup`, before any window exists, while the UI language lives in the WebView's localStorage (`lang`, falling back to the OS locale and then to Japanese). Rust cannot read that store, so translating the menu needs the language to reach Rust and the menu to be relabelled when it changes.

**To settle at the start:**
- **Where Rust learns the language at launch.** The first menu is built before any window can report anything. Candidates: move `lang` into settings.json as a store-backed preference (then `commit_setting` already orders and relays it, and Rust reads it in `setup`), with a one-time read of the localStorage value; or keep it in localStorage, build the first menu from the same OS-locale fallback in Rust, and relabel when the first window reports. The second can show the wrong language until a window mounts.
- **How a change reaches the menu.** A language change already goes out as `settings:change`; the menu side can rebuild or call `set_text` on each item. Either way ids, accelerators, enabled state (the per-window gates in `MenuState`) and the Open Recent entries must survive it.
- **Predefined items.** The macOS app menu (About, Services, Hide, Hide Others, Show All, Quit), the Edit menu's Undo / Redo / Cut / Copy / Paste / Select All, Window's Minimize / Zoom and the Help menu's About take their text from muda. Whether each platform localizes them on its own or mallow has to pass the text is unmeasured.
- **The macOS Window menu's own entries** that AppKit appends (the open windows) are the system's and are out of scope.

**Documentation.** AGENTS.md's "Known follow-ups" says the menu is English on every platform and that README states this as deliberate; README has no such sentence today, so that claim is stale either way and goes with this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Where Rust reads the UI language at launch, and how a change reaches the menu, are settled at the start and recorded in the task
- [ ] #2 With the UI language set to Japanese, every label mallow sets in the menu bar is Japanese on macOS, Windows and Linux, and with English it is English; whether the predefined items follow is measured and recorded per platform
- [ ] #3 Changing the language in Settings relabels the menu in every open window without a restart
- [ ] #4 With no stored language, the menu comes up in the same language the UI falls back to
- [ ] #5 Relabelling leaves ids, accelerators, the per-window enabled state and the Open Recent entries unchanged, and the label table per language is covered by a Rust unit test
- [ ] #6 AGENTS.md no longer describes the menu as English-only, and README says nothing that contradicts the result
<!-- AC:END -->
