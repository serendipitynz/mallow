---
id: TASK-12.2
title: Create windows and hand each one its initial location
status: To Do
assignee: []
created_date: '2026-08-02 21:13'
updated_date: '2026-08-02 22:39'
labels:
  - feature
dependencies:
  - TASK-12.1
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The mechanism a second window exists by: creating it, telling it where to open, and giving it a size and position. Restoring the set of windows that were open at quit is TASK-12.7; several choices here exist only because of it and are marked as such.

## open_window

A Rust command `open_window(location, label)` that builds one window with `WebviewWindowBuilder` and `WebviewUrl::App("index.html")`. `location` is the initial location and may be absent, which opens an empty window - which is what New Window does. It does not duplicate the focused window's folder; a window opened to compare against something is opened on a different folder, and Open Recent is one click away. `label` is normally absent - the command allocates one - and is passed explicitly only by the restore path in TASK-12.7, which has to put a window back under the label its geometry and its session entry are filed under. Settle the signature here: discovering the label parameter in TASK-12.7 means changing this command after it has been reviewed.

**Labels reuse the lowest free slot.** A created window takes the lowest `w<n>` no live window is using. The builder only rejects a label that is currently in use (tauri-2.11.3 `src/manager/window.rs:70-72`), so reusing the slot of a closed window is legal. A monotonic counter would be simpler, and is wrong here for two reasons that both come from TASK-12.7: the window-state file and the restored session are both keyed by label, so a counter that climbs forever leaves them growing with every window ever opened, and a restored window could not be handed back the geometry it had. With slot reuse both stay bounded by the number of windows open at once. The consequence to accept and comment: a new window inherits the remembered geometry of whichever window last held that slot.

There is no `main`. TASK-12.7 sets `"create": false` on the configured window so every window, including the launch one, is created here - see that task for why the alternative collides. Two consequences land in this task:

- The builder has no label setter, but the fields do not have to be copied by hand: `WindowConfig` derives `Clone` and its `label` is a public field (tauri-utils-2.9.3 `src/config.rs:1913-1920`), and `from_config` takes a reference (tauri-2.11.3 `src/webview/webview_window.rs:150`). Clone `app.config().app.windows[0]`, overwrite `label`, and build from that. Enumerating fields instead (width, height, minWidth, minHeight, title) happens to match `src-tauri/tauri.conf.json:13-19` today and silently stops matching the first time someone adds one - and title is the one that bites, since the builder's default is the application name while `src/lib/tauri.ts:8-12` only sets a title once a document is open.
- The capability window list from TASK-12.1 must cover the created labels; nothing is labelled `main` any more.

## Handing over the initial location

`open_window` writes label → initial location into a map in app state; the frontend calls `take_window_init` once at mount, which removes and returns the entry. This is settled, not a choice to make during implementation - the umbrella task's vocabulary defines the initial location in terms of `take_window_init`, so switching to the rejected alternative would break the shared vocabulary.

The rejected alternative and why: a query string (`WebviewUrl::App("index.html?folder=<encoded>".into())`, read from `location.search`) survives a WebView reload, but puts arbitrary filesystem paths through URL encoding, leaves them visible in the address the WebView loaded, and gets awkward now that the payload is a pair rather than a single path. The trade-off taken has to be stated in the code comment: after a devtools reload the entry is already consumed, so the window comes back empty rather than reopening.

The created window then runs what `openFolder` in `src/App.tsx:51-62` runs - `allowMediaDir` awaited before `openTree`, then `startWatch` - and, when the initial location carries a file, the `expandPaths` + select sequence the restore effect already uses at `src/App.tsx:127-130`. Opening at mount is itself a change of what the window displays, so it reports into the restored session like any other (TASK-12.7 states that rule as a predicate over the change, precisely so this path is not missed).

## Geometry stays per label

tauri-plugin-window-state 2.4.1 saves geometry per label and restores runtime-created windows automatically in its `on_window_ready` hook (`src/lib.rs:407-431`). Keep that per-label behaviour: TASK-12.7 needs each restored window to come back at its own size and position, and the slot-reuse labels above are what keeps the state file from growing without bound. Do **not** collapse labels with the plugin's `map_label` (`src/lib.rs:377`) - it would give every window one shared geometry, which is exactly what a restored set must not have.

**Cascading a new window cannot be conditioned on "this slot has no remembered geometry", because that condition is not observable and stops being true almost immediately.** `WindowStateCache` and `WindowState` are private (`src/lib.rs:76`, `:109`); the public surface is `AppHandleExt::save_window_state` and `WindowExt::restore_state` only. Worse, the plugin inserts a default state for every tracked label at window-ready (`src/lib.rs:437-445`) and writes the whole cache out at `RunEvent::Exit` (`:501-504`), so any slot used once has an entry forever after - a naive check would cascade only on a slot's first ever use, and every later window would land exactly on top of whatever last occupied that slot.

Pick one and record it:

- Compare the created window's outer position with the spawner's after the plugin has restored it, and offset only on a collision. Observable, needs no plugin internals, and also catches two different slots that happen to share a position. "After" needs pinning down: the plugin restores in `on_window_ready`, which tauri dispatches through `Window::run_on_main_thread` (tauri-2.11.3 `src/manager/window.rs:113-118`), and that runs inline only when the caller is already on the main thread (tauri-runtime-wry-2.11.3 `src/lib.rs:239-248`). From a synchronous command that holds, so `build()` returns with the geometry restored; from anywhere else the comparison would read the pre-restore position. Either state that `open_window` is a synchronous command, or hang the comparison off the first `Moved`.
- Read `.window-state.json` directly (the plugin exposes its filename) and decide before creating. More precise, but couples mallow to the plugin's file format.

## Closing the last window

Tauri exits the app when the last window closes. On macOS the platform convention is to stay alive with only the menu bar. Keep the current exit behaviour - a menu-bar-only state needs New Window to work with no window focused, which complicates the menu-event routing in TASK-12.4 - and record the choice rather than leaving it implicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 open_window(location, label) is settled with both parameters: it allocates the lowest free w<n> when no label is given, and accepts one for the restore path
- [ ] #2 A created window carries the width, height, minimum sizes and title from the configured window, so it is indistinguishable from a configured one before a document is opened
- [ ] #3 A window created with an initial location opens it at mount: media scope granted before the tree opens, tree opened, watch started, and the file selected when the location carries one
- [ ] #4 take_window_init is the handover mechanism; its consumed-on-reload behaviour and the slot-reuse geometry consequence are stated in code comments
- [ ] #5 Window geometry stays keyed per label; map_label is not used, and the window-state file stays bounded by the number of windows open at once
- [ ] #6 The cascade rule is one of the two recorded options and does not depend on asking the plugin whether a slot has remembered geometry; a new window never lands exactly on top of its spawner
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 Three windows opened in sequence each land visible and distinct; closing the middle one and opening another reuses its slot rather than allocating a new one
<!-- DOD:END -->
