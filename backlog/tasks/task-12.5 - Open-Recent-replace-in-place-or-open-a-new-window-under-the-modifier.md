---
id: TASK-12.5
title: 'Open Recent: replace in place, or open a new window under the modifier'
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
updated_date: '2026-08-02 22:39'
labels:
  - feature
dependencies:
  - TASK-12.4
  - TASK-12.7
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The behaviour the user specified for Open Recent: choosing an entry replaces the focused window's folder; choosing it while the new-window modifier is held opens it in a new window instead. Split out from TASK-12.4 because the modifier half may not be deliverable on every platform and must not hold up the menu.

## Why this is not a one-liner

`muda::MenuEvent` carries only the item id (muda-0.19.3 `src/lib.rs:481-484`). Tauri exposes nothing like Electron's menu click callback, which hands the handler a modifier object - which is how VS Code implements exactly this gesture. So the modifier state cannot come from the event; it has to be asked of the OS at the moment the event arrives.

The WebView cannot supply it either. While a native menu is tracking, the WebView receives no key events, so a keydown/keyup mirror in JS is right only if the key was already down before the menu opened and goes stale the moment the user presses or releases anything with the menu open. Do not build on it.

## Spike: read the current modifier state per platform

Do macOS first (primary development platform), then decide whether the other two follow or fall back.

- macOS - `NSEvent`'s class-level `modifierFlags`, read inside the menu handler. Needs objc2 / objc2-app-kit as a direct dependency; Tauri depends on them but does not re-export them.
- Windows - `GetKeyState(VK_CONTROL)` via windows-sys.
- Linux - the GDK keyboard modifier state via gtk/gdk.

What the spike must actually answer is narrower than "can the state be read": menu events are queued through the event loop rather than dispatched at click time (tauri-2.11.3 `src/app.rs:2350-2351`, delivered at `:2588`), so the handler reads the *current* physical key state, not a snapshot of the click. Pass criterion: a user who releases the key as they click still gets a new window. If that fails, the gesture is unreliable on that platform even though the read "works".

Each is a new production dependency. Adding them was approved when TASK-12 was opened, so the ask-first rule in AGENTS.md is already satisfied; add only the ones the spike shows are actually needed, each behind the `cfg` for its platform, and report what the spike found either way.

## Fallback, which ships regardless

An in-app Open Recent list - the natural home is the empty state a window shows before a folder is opened, with the toolbar as the alternative - where a DOM click event carries `metaKey` / `ctrlKey` reliably on all three platforms. It ships whether or not the native read works, for two reasons: it is the discoverable path for users who never open the menu bar, and it is the shared UI the TASK-12.4 fallback needs if the Windows or Linux menu bar is rejected. It needs `ja` and `en` dictionary keys.

If a platform's native read fails the spike, that platform's menu entry keeps the replace-in-place behaviour and the modifier gesture lives only in the in-app list there. Document per platform what works where; do not leave a gesture that silently does nothing.

## Behaviour, both branches

- Without the modifier: the chosen folder replaces the focused window's folder. Selection clears, `allowMediaDir` is awaited before the tree opens, `startWatch` restarts for that window only, `recentFolders` moves the entry to the front, and the window reports its new content into the restored session. That last one is easy to miss: this is a second way a window's folder changes, and TASK-12.7's reporting rule is a predicate over that change, not a fixed call site.
- With the modifier: `open_window(location, label)` from TASK-12.2, with the folder as the initial location and no label; the focused window is untouched.

Edge cases to settle rather than discover:

- The chosen folder no longer exists - TASK-12.3 prunes at submenu build time, so this is the race where it vanished between build and click. Report it and prune, do not open an empty tree silently.
- The folder is already open in another window - recommend focusing that window instead of opening a second window on the same folder, which is what VS Code does. Applies to the modifier branch only. Scan `webview_windows()` for it; `Manager::windows()` and `get_focused_window` are behind the `unstable` feature this project does not enable (see TASK-12.4).
- No window is focused - only reachable if the macOS stay-alive behaviour is ever adopted (TASK-12.2 keeps the exit-on-last-close default), but the handler should still fall back to opening a new window rather than dropping the event.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Choosing it with the modifier opens a new window on the folder and leaves the focused window untouched
- [ ] #2 An in-app Open Recent list ships regardless of the spike result, reads metaKey/ctrlKey from the DOM click event, and has ja and en dictionary keys
- [ ] #3 A folder that vanished between submenu build and click is reported and pruned rather than opening an empty tree
- [ ] #4 No platform is left with a modifier gesture that silently does nothing; what works where is written down
- [ ] #5 The spike reports, per platform, whether the modifier state can be read at menu-event time and which dependency it costs; only the dependencies it justifies are added, each behind its platform cfg
- [ ] #6 Choosing a folder already open in another window focuses that window instead of opening a duplicate, in the modifier branch
- [ ] #7 Choosing a recent entry without the modifier replaces the focused window's folder — selection cleared, media scope granted before the tree opens, watch restarted for that window only, entry moved to the front of recentFolders — and the window reports its new content into the restored session
- [ ] #8 The spike's pass criterion includes a user who releases the modifier as they click, since the handler reads the current key state rather than a snapshot of the click
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 The gesture has been exercised by hand on macOS, and on each other platform either exercised or recorded as falling back to the in-app list
- [ ] #3 THIRD-PARTY-NOTICES.md is regenerated with pnpm notices, since the spike adds Rust dependencies that scripts/gen-third-party-notices.mjs collects
<!-- DOD:END -->
