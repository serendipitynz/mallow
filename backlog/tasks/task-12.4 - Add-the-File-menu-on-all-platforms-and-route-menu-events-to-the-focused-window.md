---
id: TASK-12.4
title: Add the File menu on all platforms and route menu events to the focused window
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
labels:
  - feature
dependencies:
  - TASK-12.2
  - TASK-12.3
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The File menu the user asked for - New Window, Open…, Open Recent > - plus the two menu problems that only appear once more than one window exists.

## The menu goes to all three platforms

`src-tauri/src/lib.rs:27-70` builds the menu inside `#[cfg(target_os = "macos")]`, with the comment "Other platforms reach settings via the footer button." Drop the gate. `AppHandle::set_menu` is app-wide and assigns the menu to any window not given one explicitly (tauri-2.11.3 `src/app.rs:956-961`), so Windows and Linux windows get a menu bar in the window.

Check the result on Windows and Linux before calling it done. If the GTK or Win32 menu bar is unacceptable, the recorded fallback is: keep the native menu macOS-only and put New Window / Open… / Open Recent in the in-app toolbar on the other two platforms. That fallback shares its UI with TASK-12.5's in-app recent list, so it is cheap if it is needed.

## File submenu

- New Window - `CmdOrCtrl+N`. mallow has no "new file", so N is free.
- Open… - `CmdOrCtrl+O`, the same folder picker the toolbar button uses.
- Open Recent - submenu, rebuilt from `recentFolders` (TASK-12.3).
- separator, Clear Recent.
- Close Window - the predefined `close_window` item, `CmdOrCtrl+W`.

Menu item ids: use the folder path itself as the id for a recent entry rather than an index. Ids are arbitrary strings, and an index needs an id → path mapping kept in sync with every rebuild - a stale mapping opens the wrong folder, which is exactly the bug class worth designing out. Fixed items get `file:new-window`, `file:open`, `recent:clear`.

Rebuilding in place is supported: `Submenu::items()`, `remove_at` and `append` (tauri-2.11.3 `src/menu/submenu.rs:277-361`), so only the Open Recent submenu is touched, not the whole menu bar.

## Routing a menu event to the right window

`Builder::on_menu_event` hands the callback `(&AppHandle, MenuEvent)`, and `MenuEvent` carries only the item id (muda-0.19.3 `src/lib.rs:481-484`). On macOS one menu bar serves whichever window is focused, so the handler has to resolve the target itself with `Manager::get_focused_window` (tauri-2.11.3 `src/manager/mod.rs:644`).

This is already a latent bug: the existing handler emits `menu:settings` with `app.emit`, which broadcasts. Harmless with one window, wrong with several - every window would open its settings modal. Fix it in this change by emitting to the focused window, and use the same routing for the File items.

## Window menu on macOS

With several windows the standard macOS Window menu (Minimize, Zoom, and the list of open windows) is expected. `Submenu::set_as_windows_menu_for_nsapp` (`src/menu/submenu.rs:400`) provides it. macOS only.

## Menu labels stay English

Menu labels are built in Rust; the UI language lives in localStorage and is read by `src/lib/i18n.tsx` in the WebView. Rust has no access to it without the frontend pushing the language over and the menu being rebuilt on change. The existing "Settings…" item is already English-only, so keep the menu English here and record translated menus as a follow-up. Any in-app UI added by TASK-12.5 is not exempt: it needs keys in both the `ja` and `en` dictionaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A File submenu offers New Window (CmdOrCtrl+N), Open… (CmdOrCtrl+O), Open Recent, Clear Recent and Close Window, and the menu is built on macOS, Windows and Linux — or the macOS-only fallback is taken deliberately and recorded
- [ ] #2 The Open Recent submenu is rebuilt in place from recentFolders, and a recent entry's menu id is its path, not an index
- [ ] #3 Menu events resolve their target with get_focused_window and are emitted to that window; menu:settings no longer broadcasts to every window
- [ ] #4 macOS has a standard Window menu via set_as_windows_menu_for_nsapp
- [ ] #5 The menu bar has been looked at on Windows and on Linux, and the result is recorded in the task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 cargo check and cargo test pass; pnpm build and pnpm test pass
- [ ] #2 With two windows open, Settings… opens the modal in the focused window only, and New Window / Open… act on the focused window
<!-- DOD:END -->
