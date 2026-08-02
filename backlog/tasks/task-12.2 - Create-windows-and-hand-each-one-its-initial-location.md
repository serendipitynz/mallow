---
id: TASK-12.2
title: Create windows and hand each one its initial location
status: To Do
assignee: []
created_date: '2026-08-02 21:13'
updated_date: '2026-08-02 21:23'
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
The mechanism a second window exists by: creating it, telling it where to open, and giving it a size and position. Restoring the set of windows that were open at quit is TASK-12.7; two choices here exist only because of it and are marked as such.

## open_window

A Rust command `open_window(location)` that builds one window with `WebviewWindowBuilder` and `WebviewUrl::App("index.html")`, sized from the same defaults as `app.windows[0]` in tauri.conf.json. `location` is the initial location and may be absent, which opens an empty window.

**Labels reuse the lowest free slot.** `main` is the launch window; a created window takes the lowest `w<n>` no live window is using. The builder only rejects a label that is currently in use, so reusing the slot of a closed window is legal. A monotonic counter would be simpler, and is wrong here for two reasons that both come from TASK-12.7: the window-state file and the restored session are both keyed by label, so a counter that climbs forever leaves them growing with every window ever opened, and a restored window could not be handed back the geometry it had. With slot reuse both stay bounded by the number of windows open at once. The consequence to accept and comment: a new window inherits the remembered geometry of whichever window last held that slot.

## Handing over the initial location

Two mechanisms, pick one and record why:

- **Query string** - `WebviewUrl::App("index.html?folder=<encoded>".into())`, read from `location.search` at mount. Survives a WebView reload, but puts arbitrary filesystem paths through URL encoding and leaves them visible in the address the WebView loaded.
- **Deposit and take (recommended)** - `open_window` writes label → initial location into a map in app state; the frontend calls `take_window_init` once at mount, which removes and returns the entry. No path encoding, and the value stays typed - which matters more now that it is a pair rather than a single path, since TASK-12.7 restores a selected file too. The trade-off is real and should be stated in the code comment: after a devtools reload the entry is already consumed, so the window comes back empty rather than reopening.

Either way the created window then runs what `openFolder` in `src/App.tsx:51-62` runs - `allowMediaDir` awaited before `openTree`, then `startWatch` - and, when the initial location carries a file, the `expandPaths` + select sequence the restore effect already uses at `src/App.tsx:127-130`.

## Geometry stays per label

tauri-plugin-window-state 2.4.1 saves geometry per label and restores runtime-created windows automatically in its `on_window_ready` hook (`src/lib.rs:409-431`). Keep that per-label behaviour: TASK-12.7 needs each restored window to come back at its own size and position, and the slot-reuse labels above are what keeps the state file from growing without bound. Do **not** collapse labels with the plugin's `map_label` (`src/lib.rs:377`) - it would give every window one shared geometry, which is exactly what a restored set must not have.

A window created with no remembered geometry for its slot must not land exactly on top of the window that spawned it, so apply a cascade offset in that case only. Because the plugin restores in `on_window_ready`, the offset has to be applied after that hook rather than on the builder, and it must not override a geometry the plugin just restored.

## Closing the last window

Tauri exits the app when the last window closes. On macOS the platform convention is to stay alive with only the menu bar. Keep the current exit behaviour - a menu-bar-only state needs New Window to work with no window focused, which complicates the menu-event routing in TASK-12.4, and it also blurs when the restored session is written in TASK-12.7 - and record the choice rather than leaving it implicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 open_window(location) builds a window whose label is the lowest w<n> not in use, sized from the configured launch-window defaults, and opens empty when no location is given
- [ ] #2 A window created with an initial location opens it at mount: media scope granted before the tree opens, tree opened, watch started, and the file selected when the location carries one
- [ ] #3 The chosen handover mechanism is implemented, and its reload behaviour and the slot-reuse consequence are stated in code comments
- [ ] #4 Window geometry stays keyed per label; map_label is not used, and the window-state file stays bounded by the number of windows open at once rather than growing per window ever created
- [ ] #5 A window whose slot has no remembered geometry is cascaded off its spawner; a window whose slot does have one is left where the plugin restored it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 Three windows opened in sequence each land visible and distinct; closing the middle one and opening another reuses its slot rather than allocating a new one
<!-- DOD:END -->
