---
id: TASK-12
title: Support multiple windows and a File menu
status: To Do
assignee: []
created_date: '2026-08-02 21:13'
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

- **open_window** - the Rust command that builds one new window with a fresh window label.
- **initial location** - the folder a newly created or restored window opens at mount, together with the file to select inside it (the file half may be absent). The creating side deposits it, the created window takes it exactly once at mount (`take_window_init`), and later calls return null.
- **window label** - the string that identifies a window to capabilities, to the watcher registry, to the window-state plugin and to the restored session. `main` for the launch window; a created window takes the lowest `w<n>` not currently in use.
- **restored session** - the settings.json `windows` key: one entry per window open at quit, holding its label, folder and selected file, ordered least-recently-focused first. What relaunch reproduces.
- **exiting flag** - true from the moment `RunEvent::ExitRequested` arrives until the process ends. It is what tells a window's destroy handler whether the user closed that window (drop its entry from the restored session) or the app is quitting (keep it).
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
- `src/lib/settings.ts:6-12` holds a single `lastFolder` / `lastFile`, and `src/App.tsx:109-136` restores them at mount. Left alone, every new window would restore the same folder and every window would overwrite the pair. The pair cannot express a window set at all, so it is replaced by the restored session. TASK-12.2 and TASK-12.7.
- `src-tauri/src/lib.rs:27-70` builds the native menu under `#[cfg(target_os = "macos")]` and its menu handler broadcasts with `app.emit`, so the `menu:settings` event would open the settings modal in every window at once. TASK-12.4.

## Decisions taken here (reverse them here, not inside a subtask)

1. **The native menu ships on all three desktop platforms.** `AppHandle::set_menu` is app-wide and assigns the menu to any window that was not given one explicitly (tauri-2.11.3 `src/app.rs:956-961`), so Windows and Linux windows get a real menu bar. The alternative - macOS-only native menu plus in-app toolbar entries on Windows and Linux - is recorded in TASK-12.4 and is the fallback if the GTK or Win32 menu bar turns out to look wrong.
2. **Relaunch reproduces the whole window set, and that is a requirement, not a nicety.** It ships with multiple windows rather than after them: a viewer whose second window evaporates on quit is worse than one that never had it, because the user has to rebuild the comparison by hand every session. TASK-12.7 owns it, and it is what forces two choices elsewhere - window labels reuse the lowest free slot instead of climbing forever, and window geometry stays per label instead of being collapsed to one shared key (both in TASK-12.2).
3. **The new-window modifier is a spike before it is a feature.** `muda::MenuEvent` carries only the item id (muda-0.19.3 `src/lib.rs:481-484`); there is no Tauri equivalent of Electron's modifier-carrying menu click. TASK-12.5 owns the per-platform investigation, and the in-app fallback ships regardless so the gesture is available on any platform where the native read does not work out.

## New production dependencies: approved

Reading the new-window modifier means asking the OS for the current keyboard state at menu-event time: objc2-app-kit on macOS, windows-sys on Windows, gtk/gdk on Linux. Tauri depends on all three but re-exports none of them, so each is a direct dependency. Adding them was approved in the conversation that opened this task, satisfying the ask-first rule in AGENTS.md. Add only what the spike in TASK-12.5 shows is actually needed, each behind the `cfg` for its platform.

## Out of scope

Tabs inside a window; a single-instance guard or OS "Open With" file handoff; per-window theme or language.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 TASK-12.1 through TASK-12.7 are all Done
- [ ] #2 Two windows show two different folders at the same time, each with its own working file tree and live reload
- [ ] #3 Quitting with three windows open on three folders and relaunching brings all three back, each on its own folder, document, size and position
- [ ] #4 The File menu (New Window / Open… / Open Recent) works on macOS, Windows and Linux, or the platform fallback recorded in TASK-12.4 is in place and documented
- [ ] #5 Choosing an Open Recent entry replaces the focused window's folder; with the new-window modifier it opens a new window, on every platform where TASK-12.5's spike says it is possible, and in the in-app list everywhere
- [ ] #6 pnpm build, pnpm test, cargo check and cargo test all pass
<!-- DOD:END -->
