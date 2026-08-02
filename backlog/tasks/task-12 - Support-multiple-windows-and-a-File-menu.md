---
id: TASK-12
title: Support multiple windows and a File menu
status: To Do
assignee: []
created_date: '2026-08-02 21:13'
updated_date: '2026-08-02 22:06'
labels:
  - feature
dependencies: []
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella for turning mallow from a single-window viewer into a multi-window one, and for adding the File menu that drives it: New Window, Open…, and Open Recent.

The need is comparison: today one window shows one folder, so two folders cannot be looked at side by side.

## Vocabulary (fixed before the design; every subtask uses these words for these things)

- **open_window** - the Rust command that builds one window: `open_window(location, label)`, allocating the label itself unless the restore path supplies one.
- **initial location** - the folder a newly created or restored window opens at mount, together with the file to select inside it (the file half may be absent). The creating side deposits it, the created window takes it exactly once at mount (`take_window_init`), and later calls return null.
- **window label** - the string that identifies a window to capabilities, to the watcher registry, to the window-state plugin and to the restored session. A window takes the lowest `w<n>` not currently in use. `main` survives only until TASK-12.7, which sets `"create": false` on the configured window so every window is created the same way and then drops `main` from the capability list.
- **restored session** - the settings.json `windows` key: one entry per window open at quit, holding its label, folder and selected file, ordered least-recently-focused first. What relaunch reproduces.
- **last-window rule** - the test that decides whether a destroyed window's entry leaves the restored session: drop it only if the window map is still non-empty at that moment, so the final window's entry survives into the next launch. It replaces the flag-on-`ExitRequested` design an earlier draft used; TASK-12.7 records the four quit paths that ruled that out.
- **recentFolders** - the settings.json key holding previously opened folder paths, newest first, capped.
- **new-window modifier** - Cmd (macOS) / Ctrl (Windows, Linux) being physically held at the moment an Open Recent item is chosen. True means open in a new window instead of replacing.
- **watcher registry** - the window label → filesystem-watch-handle map that replaces today's single global watcher.

## Behaviour the user asked for

- File menu: New Window, Open…, Open Recent > (the recent folder list).
- Open Recent replaces the focused window's folder by default.
- Holding the new-window modifier while choosing a recent entry opens it in a new window instead (the VS Code behaviour).

## What the current code assumes, and therefore breaks

Each of these is single-window by construction, not by accident:

- `src-tauri/src/watch.rs:12` keeps one `Mutex<Option<RecommendedWatcher>>` for the whole app and `start_watch` replaces it, so a second window opening a folder silently stops the first window's watch. The change event is sent with `app.emit`, so every window also receives every other window's changes. TASK-12.1.
- `src-tauri/capabilities/default.json:5` grants permissions to `"windows": ["main"]` only. A window labelled `w1` would have no store, dialog, opener or set-title permission, and the failure appears only in the second window. TASK-12.1.
- `src/lib/settings.ts:6-7` holds a single `lastFolder` / `lastFile`, and `src/App.tsx:109-136` restores them at mount. Left alone, every new window would restore the same folder and every window would overwrite the pair. The pair cannot express a window set at all, so it is replaced by the restored session. TASK-12.2 and TASK-12.7.
- `src-tauri/src/lib.rs:27-70` builds the native menu under `#[cfg(target_os = "macos")]`, and separately the menu handler at `:15-20` - registered on every platform, outside that gate - broadcasts with `app.emit`, so the `menu:settings` event would open the settings modal in every window at once. TASK-12.4.
- Every preference is applied to the WebView that changed it and nowhere else: theme (`src/lib/theme.ts:57-66`), language (`src/lib/i18n.tsx:183-190`), and the store-backed settings read once at mount (`src/lib/settings.ts:27-34`, `src/App.tsx:109-136`). The Settings modal opens in any window, so changing the theme in one leaves the others on the old one. TASK-12.8.

## Decisions taken here (reverse them here, not inside a subtask)

1. **The native menu ships on all three desktop platforms, composed per platform.** `AppHandle::set_menu` is app-wide and assigns the menu to any window that was not given one explicitly (tauri-2.11.3 `src/app.rs:956-961`), so Windows and Linux windows get a real menu bar. What they must not get is today's macOS-shaped menu with the `cfg` removed - the app submenu carries About / Services / Hide / Show All, which are macOS concepts that compile everywhere and mean nothing there. TASK-12.4 owns the per-platform composition, and the fallback if a menu bar is unwanted on those platforms at all (macOS-only native menu plus in-app entries elsewhere).
2. **Relaunch reproduces the whole window set, and that is a requirement, not a nicety.** It ships with multiple windows rather than after them: a viewer whose second window evaporates on quit is worse than one that never had it, because the user has to rebuild the comparison by hand every session. TASK-12.7 owns it, and it is what forces two choices elsewhere - window labels reuse the lowest free slot instead of climbing forever, and window geometry stays per label instead of being collapsed to one shared key (both in TASK-12.2).
3. **The new-window modifier is a spike before it is a feature.** `muda::MenuEvent` carries only the item id (muda-0.19.3 `src/lib.rs:481-484`); there is no Tauri equivalent of Electron's modifier-carrying menu click. TASK-12.5 owns the per-platform investigation, and the in-app fallback ships regardless so the gesture is available on any platform where the native read does not work out.

## New production dependencies: approved

Reading the new-window modifier means asking the OS for the current keyboard state at menu-event time: objc2-app-kit on macOS, windows-sys on Windows, gtk/gdk on Linux. Tauri depends on all three but re-exports none of them, so each is a direct dependency. Adding them was approved in the conversation that opened this task, satisfying the ask-first rule in AGENTS.md. Add only what the spike in TASK-12.5 shows is actually needed, each behind the `cfg` for its platform.

## One API note that binds every subtask

Window enumeration goes through `webview_windows()` / `get_webview_window()`. The `Manager` methods that look more natural - `get_focused_window`, `windows`, `get_window` - are behind the `unstable` cargo feature (tauri-2.11.3 `src/lib.rs:541-560`), which this project does not enable and which tauri documents as free to break in a minor release. TASK-12.4 routes menu events with it, TASK-12.5 looks for a window already showing a folder, TASK-12.7 counts live windows.

## Out of scope

Tabs inside a window; a single-instance guard or OS "Open With" file handoff; per-window theme or language.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 TASK-12.1 through TASK-12.8 are all Done
- [ ] #2 Two windows show two different folders at the same time, each with its own working file tree and live reload
- [ ] #3 Quitting with three windows open on three folders and relaunching brings all three back, each on its own folder, document, size and position
- [ ] #4 The File menu (New Window / Open… / Open Recent) works on macOS, Windows and Linux, or the platform fallback recorded in TASK-12.4 is in place and documented
- [ ] #5 Choosing an Open Recent entry replaces the focused window's folder; with the new-window modifier it opens a new window, on every platform where TASK-12.5's spike says it is possible, and in the in-app list everywhere
- [ ] #6 pnpm build, pnpm test, cargo check and cargo test all pass
- [ ] #7 A preference changed in one window takes effect in every open window
<!-- DOD:END -->
