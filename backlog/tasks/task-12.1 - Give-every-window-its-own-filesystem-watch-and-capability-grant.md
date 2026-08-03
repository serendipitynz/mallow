---
id: TASK-12.1
title: Give every window its own filesystem watch and capability grant
status: To Do
assignee: []
created_date: '2026-08-02 21:13'
updated_date: '2026-08-02 22:39'
labels:
  - feature
dependencies: []
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Everything in the backend that is one-per-app today and has to become one-per-window before a second window can exist. Nothing here is visible to the user; it is what stops the second window from breaking the first.

## The watcher registry

`src-tauri/src/watch.rs` holds `WatcherState(Mutex<Option<RecommendedWatcher>>)` - one handle for the whole app, replaced on every `start_watch`, with the comment "Dropping the previous watcher (if any) stops it." With two windows that is a silent regression of the first window: its tree stops refreshing and its open document stops live-reloading, with no error anywhere.

Replace it with the watcher registry, a `Mutex<HashMap<String, RecommendedWatcher>>` keyed by window label:

- `start_watch` takes the calling `tauri::Window` (Tauri injects it into commands) and inserts under `window.label()`, replacing only that window's entry.
- `stop_watch` removes only the calling window's entry.
- The emit side changes too: the closure currently captures an `AppHandle` and calls `app_handle.emit("fs:change", paths)`, which every window receives. Capture the label and use `emit_to(label, "fs:change", paths)`. Two windows on overlapping folders is a real case (a parent and its subfolder), so this is not theoretical.
- **`emit_to` on its own does not isolate anything, and this is the part that will look done while still being broken.** A listener registered with `EventTarget::Any` matches whatever the emitter filtered on - `match_any_or_filter` short-circuits on `Any` before consulting the filter (tauri-2.11.3 `src/event/listener.rs:305-311`) - and the plain `listen()` in `@tauri-apps/api` registers exactly that target (`node_modules/@tauri-apps/api/event.js:73-75`). `src/lib/watch.ts:16` uses plain `listen`, so window B keeps receiving window A's changes no matter what Rust does. The frontend half is `getCurrentWebviewWindow().listen(...)`, which registers `{ kind: 'WebviewWindow', label }` (`node_modules/@tauri-apps/api/webviewWindow.js:130-131`) and is what `filter_target` matches against an `AnyLabel` emit (tauri-2.11.3 `src/manager/mod.rs:604-611`). Per-window delivery is that pair, never one half of it.
- The pair is required for per-window events only. TASK-12.8 propagates settings changes to every window and depends on the broadcast behaviour of `Any`, so do not turn "use the window-scoped listener" into a blanket rule.
- A closed window must not leave its watcher running. Register `Builder::on_window_event` and drop the registry entry on `WindowEvent::Destroyed`. Prefer the app-level hook over per-window registration in `open_window`, so the launch window is covered by the same code path.

## The capability window list

`src-tauri/capabilities/default.json` declares `"windows": ["main"]`. Capability window entries accept glob patterns (tauri-utils-2.9.3 `src/acl/capability.rs:85` and `:150`), so widen it to `["main", "w*"]` - both, not just the new glob. TASK-12.7 eventually retires `main` (every window is created in `setup` under a `w<n>` label) and drops it from this list *there*. Narrowing to `["w*"]` now would leave the launch window with no permissions for the whole stretch between this task and that one, which is exactly the window in which this task's and TASK-12.2's own acceptance checks run - and they need the folder dialog to run at all.

Getting this wrong fails in a way a single-window smoke test cannot catch: the launch window keeps working and only the created window loses `store:default` (settings do not persist), `dialog:default` (Open… does nothing), `opener:default` (external links dead) and `core:window:allow-set-title` (the title stops tracking the document, see `src/lib/title.ts`).

## The asset-protocol scope needs no change, and here is why

`allow_media_dir` widens one app-global scope and is additive, so a folder granted by any window is readable by all of them. Two consequences worth writing down rather than rediscovering: media in a folder opened by window A renders in window B too, and a grant is not revoked when the window that asked for it closes - the scope has no removal API. Neither is a defect for a viewer that only renders files the user picked in a tree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 watch.rs keeps a watcher registry keyed by window label; start_watch and stop_watch affect only the calling window's entry
- [ ] #2 A destroyed window's watcher is dropped from the registry via an app-level WindowEvent::Destroyed hook, covering the launch window and created windows through the same code path
- [ ] #3 cargo test covers insert / replace / remove on the watcher registry
- [ ] #4 The registry is testable without a GUI: either it is generic over the handle type or the test watches a temp dir with the self-cleaning helper commands.rs already uses; the choice is stated
- [ ] #5 capabilities/default.json lists both main and the w* glob, and a created window can persist settings, open the folder dialog, open external links and set its title
- [ ] #6 fs:change is delivered per window: Rust emits with emit_to and src/lib/watch.ts listens through getCurrentWebviewWindow().listen, since a plain listen() ignores the emitter's filter
- [ ] #7 Verification of a second window's capability grant is deferred to TASK-12.2, or this task adds a throwaway window-creation path to prove it; which one is stated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 cargo check and cargo test pass in src-tauri
- [ ] #2 Two windows watching overlapping folders (a parent and its subfolder) each refresh their own tree, and closing one leaves the other's watch alive
- [ ] #3 pnpm build and pnpm test pass as well, since the listener change touches src/lib/watch.ts
<!-- DOD:END -->
