---
id: TASK-12.4
title: Add the File menu on all platforms and route menu events to the focused window
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
updated_date: '2026-08-02 22:39'
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

## The menu goes to all three platforms - but not the same menu

`src-tauri/src/lib.rs:27-70` builds the menu inside `#[cfg(target_os = "macos")]`, with the comment "Other platforms reach settings via the footer button." `AppHandle::set_menu` is app-wide and assigns the menu to any window not given one explicitly (tauri-2.11.3 `src/app.rs:956-961`), so dropping the gate does give Windows and Linux windows a menu bar.

**Dropping the gate alone is wrong, though.** The menu behind it is macOS-shaped: an app submenu named "mallow" carrying About / Services / Hide / Hide Others / Show All / Quit (`src-tauri/src/lib.rs:44-56`). Those predefined items are not `cfg`-gated, so this compiles everywhere and simply produces a Windows and Linux menu bar with a "mallow" top-level menu and Services / Hide entries that mean nothing there. What is needed is a per-platform composition, not one menu with the gate removed:

- macOS - the app submenu as it is today, plus File, Edit and Window.
- Windows - no app submenu. File gets Exit at the bottom, Settings moves to File or to Edit > Preferences, and About goes under a Help submenu.
- Linux - the same shape, but with a rule rather than a list: **muda's GTK backend supports only Separator, Copy, Cut, Paste, SelectAll and About as predefined kinds** (muda-0.19.3 `src/platform_impl/gtk/mod.rs:30-49`), and anything else is skipped on append instead of failing. Every other predefined item has to be an ordinary `MenuItem` with its own handler there. That is not limited to the items this task adds: the existing Edit submenu uses `.undo().redo()` (`src-tauri/src/lib.rs:58-67`), so those two are missing on Linux today. Quit maps to `AppHandle::exit()` and Close Window to closing the focused window - resolved the same way as every other menu event, since one menu serves all windows. The failure mode is a menu entry that simply is not there, which only a look at a Linux build reveals.

Check the result on Windows and Linux before calling it done. If the GTK or Win32 menu bar is unacceptable even when correctly composed, the recorded fallback is: keep the native menu macOS-only and put New Window / Open… / Open Recent in the in-app toolbar on the other two platforms. That fallback shares its UI with TASK-12.5's in-app recent list, so it is cheap if it is needed.

## File submenu

- New Window - `CmdOrCtrl+N`. mallow has no "new file", so N is free.
- Open… - `CmdOrCtrl+O`, the same folder picker the toolbar button uses.
- Open Recent - submenu, rebuilt from `recentFolders` (TASK-12.3).
- separator, Clear Recent.
- Close Window - `CmdOrCtrl+W`; the predefined `close_window` item on macOS and Windows, an ordinary item calling `window.close()` on Linux (see above).

Menu item ids: use the folder path itself as the id for a recent entry rather than an index. Ids are arbitrary strings, and an index needs an id → path mapping kept in sync with every rebuild - a stale mapping opens the wrong folder, which is exactly the bug class worth designing out. Fixed items get `file:new-window`, `file:open`, `recent:clear`.

Rebuilding in place is supported: `Submenu::items()`, `remove_at` and `append` (tauri-2.11.3 `src/menu/submenu.rs:277-361`), so only the Open Recent submenu is touched, not the whole menu bar. The rebuild is triggered from `record_recent` and from Clear Recent; TASK-12.3 deliberately leaves the trigger here, because the submenu does not exist before this task. The same build is where a recent entry whose folder has disappeared is pruned - one prune site, as TASK-12.3 specifies.

## Routing a menu event to the right window

`Builder::on_menu_event` hands the callback `(&AppHandle, MenuEvent)`, and `MenuEvent` carries only the item id (muda-0.19.3 `src/lib.rs:481-484`). On macOS one menu bar serves whichever window is focused, so the handler has to resolve the target itself.

**Not with `Manager::get_focused_window`.** That method, along with `windows()` and `get_window()`, is behind the `unstable` cargo feature (tauri-2.11.3 `src/lib.rs:541-560`) which this project does not enable and which tauri documents as free to break in a minor release. Its implementation is a one-liner over the window map (`src/manager/mod.rs:646-651`), so do the same over the ungated `webview_windows()` (`src/lib.rs:588`): find the entry whose `is_focused()` is true. Fix the enumeration API here for the whole feature - TASK-12.5 needs it to find a window already showing a folder, and TASK-12.7 needs it to count live windows.

This is already a latent bug, and it is not behind the macOS gate: the handler at `src-tauri/src/lib.rs:15-20` is registered on every platform and emits `menu:settings` with `app.emit`, which broadcasts. Harmless with one window, wrong with several - every window would open its settings modal. Fix it in this change by emitting to the focused window, and use the same routing for the File items.

Switching Rust to `emit_to` is only half of it: `src/App.tsx:175` listens with the plain `listen('menu:settings')`, whose `EventTarget::Any` matches regardless of what the emitter filtered on. Move it to `getCurrentWebviewWindow().listen`, the same pairing TASK-12.1 establishes for `fs:change`.

## Window menu on macOS

With several windows the standard macOS Window menu is expected. `Submenu::set_as_windows_menu_for_nsapp` (`src/menu/submenu.rs:400`) registers a submenu as that menu, which is what makes AppKit append the list of open windows to it - it does not populate it otherwise. Minimize and Zoom are ordinary predefined items this task adds to that submenu itself. macOS only.

## Menu labels stay English

Menu labels are built in Rust; the UI language lives in localStorage and is read by `src/lib/i18n.tsx` in the WebView. Rust has no access to it without the frontend pushing the language over and the menu being rebuilt on change. The existing "Settings…" item is already English-only, so keep the menu English here and record translated menus as a follow-up. Any in-app UI added by TASK-12.5 is not exempt: it needs keys in both the `ja` and `en` dictionaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A File submenu offers New Window (CmdOrCtrl+N), Open… (CmdOrCtrl+O), Open Recent, Clear Recent and Close Window
- [ ] #2 The Open Recent submenu is rebuilt from record_recent and from Clear Recent, and entries whose folder no longer exists are pruned from the list and the store at that one build site
- [ ] #3 The menu bar has been looked at on Windows and on Linux and the result recorded, or the platform is explicitly recorded as unverified with the reason
- [ ] #4 A recent entry's menu id is its folder path, not an index into the list
- [ ] #5 macOS has a Window submenu registered via set_as_windows_menu_for_nsapp and carrying Minimize and Zoom of its own
- [ ] #6 The menu is composed per platform: macOS keeps its app submenu; Windows and Linux get none, with Exit under File and About under Help; on Linux Exit and Close Window are ordinary items, since muda's GTK backend silently skips those predefined kinds
- [ ] #7 Menu events resolve their target by scanning webview_windows() for the focused one — not with the unstable Manager::get_focused_window — are emitted to that window, and App.tsx listens for menu:settings through getCurrentWebviewWindow().listen
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 cargo check and cargo test pass; pnpm build and pnpm test pass
- [ ] #2 With two windows open, Settings… opens the modal in the focused window only, and New Window / Open… act on the focused window
<!-- DOD:END -->
