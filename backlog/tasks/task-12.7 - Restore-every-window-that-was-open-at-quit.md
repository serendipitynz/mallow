---
id: TASK-12.7
title: Restore every window that was open at quit
status: To Do
assignee: []
created_date: '2026-08-02 21:24'
updated_date: '2026-08-03 01:16'
labels:
  - feature
dependencies:
  - TASK-12.2
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 15500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relaunch reproduces the set of windows that were open at quit, each on its own folder, document, size and position. Required from the moment multiple windows exist (see decision 2 in TASK-12): a second window that evaporates on quit makes the user rebuild the comparison by hand every session.

Geometry is already handled - tauri-plugin-window-state restores it per label, and TASK-12.2 keeps labels per slot so a restored window gets its own back. What this task adds is the content half: which windows existed, and what each was showing.

## The restored session

A `windows` key in settings.json: one entry per window, `{ label, folder, file }`, ordered least-recently-focused first so the last entry is the window to focus after restore. It replaces `lastFolder` / `lastFile` entirely rather than sitting beside them - two sources of truth for "where was I" is how they drift apart.

Rust owns it, for the same reason TASK-12.3 gives Rust the recent list: several windows read-modify-writing one array from JS lose entries, and the sequence is three unsynchronised steps on the JS side. Keep the live set in app state as a label-keyed map and write it out as an ordered list.

**The rule for reporting is a predicate, not a call site**: whenever a window's displayed folder or selected file changes, that window calls `report_window_content(folder, file)`. Today that is `src/App.tsx:48` and `:55-56`, which is also where TASK-12.3 records the folder as recent - both calls belong there, they record different facts, and neither task may drop the other's write. But TASK-12.5 adds a second way for a window's folder to change (Open Recent replacing it in place) and TASK-12.2 adds a third (a window opening its initial location at mount). Anchoring the rule to today's line numbers instead of to the named command is how those two get missed, and the symptom is subtle: replace the folder via Open Recent, quit, and the restored window comes back on the folder it had before.

Focus order comes from `WindowEvent::Focused(true)` - the event carries a bool, and reordering on the `false` edge would invert the order: a window moves to the end when it gains focus.

## Quitting: the ordering was checked, and the obvious design does not work

A window's destroy handler cannot tell why it is being destroyed, so the tempting rule is "set a flag on `RunEvent::ExitRequested`, and drop my entry only while the flag is false". Every quit path contradicts it:

- **Closing the last window** (the only way to quit on Windows and Linux without a menu item) - `ExitRequested` is emitted *inside* the handling of `TaoWindowEvent::Destroyed`, once the window map has gone empty (tauri-runtime-wry-2.11.3 `src/lib.rs:4310-4316`), while the per-window event listeners run *before* that match (same file `:4270-4289`). The last window's destroy handler always sees the flag false, so the restored session would be emptied on every quit.
- **macOS ⌘Q** - the predefined Quit item sends `terminate:` (muda-0.19.3 `src/platform_impl/macos/mod.rs`), reaching tao's `applicationWillTerminate` → `AppState::exit()` → `Event::LoopDestroyed` (tao-0.35.3 `src/platform_impl/macos/app_delegate.rs:131-135`), which tauri turns into `RunEvent::Exit` only (tauri-runtime-wry-2.11.3 `src/lib.rs:4185-4186`). No `ExitRequested`, no per-window destroy.
- **Windows File > Exit**, the item TASK-12.4 adds - the predefined Quit calls `PostQuitMessage(0)`, tao's message loop returns 0 and runs `loop_destroyed()` (tao-0.35.3 `src/platform_impl/windows/event_loop.rs:256-284`), so again `RunEvent::Exit` alone.
- **`AppHandle::exit()`**, which the Linux Exit item needs (see TASK-12.4) - emits `ExitRequested` and sets the control flow to exit (tauri-runtime-wry-2.11.3 `src/lib.rs:4354-4366`); the windows are torn down without their destroy handlers being called either.

So the criterion is the window count, and there is no flag:

**The last-window rule: on `WindowEvent::Destroyed`, drop the entry only if another window is still alive.** The last window's entry survives, which is the quit case, and nothing depends on event ordering. That name is the umbrella task's vocabulary - use it in code comments and in the documentation TASK-12.6 writes, so this does not become three different phrases for one rule.

Two details that decide whether this works:

- **Count with the dying window already gone.** By the time a `Builder::on_window_event` handler runs, tauri has already removed the window from its map: the handlers are runtime-level per-window listeners (tauri-2.11.3 `src/manager/window.rs:98-102`) which fire at tauri-runtime-wry-2.11.3 `src/lib.rs:4282-4286`, *after* the `callback(RunEvent::WindowEvent)` at `:4278` in which `on_event_loop_event` calls `manager.on_window_close(label)` (tauri-2.11.3 `src/app.rs:2542-2547`). The test is therefore "the map is not empty", not "the map holds more than one" - the naive version is off by one and never drops anything.
- **Enumerate with the stable API.** `Manager::get_focused_window` / `windows()` / `get_window()` are behind the `unstable` cargo feature (tauri-2.11.3 `src/lib.rs:541-560`), which this project does not enable and which tauri warns can break in a minor release. `webview_windows()` and `get_webview_window()` (`:576`, `:588`) are not gated. Use those here, in TASK-12.4's focus resolution and in TASK-12.5's "is this folder already open" check.

**Flush the live set on `RunEvent::Exit`, and save the store synchronously in the same handler.** The flush is what covers the three paths above that emit no destroy events. Writing it through the store is not enough on its own: tauri-plugin-store saves every store in its own `RunEvent::Exit` handler (tauri-plugin-store-2.4.3 `src/lib.rs:448-459`), and plugin `on_event` handlers run *before* the app's `run` callback (tauri-2.11.3 `src/app.rs:2645-2648`, called from `:1429-1430`), so the plugin's save has already happened by the time this code writes. `autoSave` will not rescue it either - it is a debounce, and the process exits first. Call `Store::save()` synchronously after writing, or keep the restored session in its own file. Receiving `RunEvent::Exit` at all is a change of shape: `src-tauri/src/lib.rs:85` ends with `.run(tauri::generate_context!())` and no callback, so this becomes `.build(ctx)?.run(|handle, event| …)` - keep the existing failure message when the build fails.

**Decide how often the live set reaches disk, not just when it is flushed.** Holding it in memory until Exit means a crash or a force-quit loses the whole session, which is a regression from today: `saveSetting('lastFolder', …)` reaches disk through the store's 100 ms auto-save (tauri-plugin-store-2.4.3 `src/store.rs:68`), so today's single folder survives a crash. Writing through on every report keeps that property at the cost of more small writes; the Exit flush then only covers the paths that emit no destroy events.

## Restoring at launch: create every window ourselves

The saved set cannot be poured into the window tauri.conf.json declares. Its label is fixed at `main`, and nothing guarantees the saved set contains a `main` entry - close `main`, keep `w1`, quit, and it does not. Applying `w1`'s content to `main` hands it `main`'s remembered geometry, which defeats the point of this task, and any entry that *is* labelled `main` would then collide: `WebviewWindowBuilder` rejects a label already in use (tauri-2.11.3 `src/manager/window.rs:70-72`).

So set `"create": false` on the window in tauri.conf.json and create every window in `setup`, restored or not. The config still declares the window - `App::setup` simply skips creating it (`src/app.rs:2524`, filtering on `w.create`, a field that defaults to true in tauri-utils-2.9.3 `src/config.rs:1935-1936`) - so it stays the single place the default size lives. The label then has to come from somewhere other than the config, which TASK-12.2 handles by cloning the `WindowConfig` and overwriting its public `label` field before calling `from_config`. With `main` gone, the capability window list TASK-12.1 widened can drop it and keep only the `w*` glob - do that here, not there, or the windows that exist between the two tasks lose their permissions.

Restore then means: create one window per entry, in saved order, with its label and initial location. Creating them least-recently-focused first also settles focus for free - the window-state plugin calls `show()` + `set_focus()` while restoring each window (tauri-plugin-window-state-2.4.1 `src/lib.rs:262-265`), so the last one created ends up focused. The `Focused` events this generates rewrite the focus order during restore, harmlessly: they arrive in the same order the entries were saved in.

Cases to settle rather than discover:

- Empty or absent `windows` - one empty window, which is what a first launch already does.
- A window that was open on no folder at all - decide whether it comes back. Restoring it keeps the window count honest; dropping it avoids a blank window nobody asked for. Either is defensible; pick one.
- A folder in an entry no longer exists - open that window empty rather than dropping it, so the window count is preserved and the user sees which one lost its folder. Its file entry goes with it.
- A file no longer exists but its folder does - open the folder with nothing selected. `src/App.tsx:119-130` already validates both halves with `pathExists`; keep that check, now per entry.
- The saved set is large - cap the number of restored windows, say what the cap is, and drop from the front (least recently focused). It is not only about surprise: every window carries its own Shiki WASM highlighter and mermaid instance in its own WebView, so the cost of a restored window is not small.

## Migrating the existing setting

An installed copy has `lastFolder` / `lastFile` and no `windows`. On first launch after the change, seed a single-entry restored session from the pair, then delete both keys so nothing reads them again. Without that step, everyone with mallow already installed loses their open folder on the upgrade - a small loss, but an avoidable one.

**The geometry needs the same migration, and it is the more visible loss.** `.window-state.json` is keyed by label (tauri-plugin-window-state-2.4.1 `src/lib.rs:109`), every existing install has its size and position filed under `main`, and after `"create": false` nothing is ever labelled `main` again - so without a migration the first launch after the upgrade resizes and repositions every existing user's window. The entry does not even go away: the plugin loads the whole cache at setup (`:397`) and writes it back at `RunEvent::Exit` (`:502-504`) whether or not any window claims the label, so a dead `main` key would persist forever and quietly falsify TASK-12.2's claim that per-slot labels keep the file bounded by the number of windows open at once.

So rename the `main` entry to the label of the first restored window, in the same one-time migration as the settings keys. The cost to accept and state in the code comment: this reads and rewrites another plugin's state file, so it is coupled to that file's format - acceptable for a migration that runs once and can be dropped later, not a pattern to reuse.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 settings.json holds a windows key with one entry per open window (label, folder, file), ordered least-recently-focused first; it is owned and written by Rust, and lastFolder / lastFile are gone
- [ ] #2 An entry is dropped on destroy only when the window map is non-empty at that point (the dying window is already removed), and window enumeration uses webview_windows() rather than the unstable Manager::get_focused_window family
- [ ] #3 RunEvent::Exit flushes the live set and calls Store::save() synchronously, since the store plugin's own Exit save has already run by then and autoSave's debounce never fires
- [ ] #4 tauri.conf.json sets create: false, every window is created in setup with its own label, and the capability window list drops main
- [ ] #5 Launch creates one window per saved entry in saved order with its label and initial location, leaving the last one focused
- [ ] #6 A missing folder yields an empty window rather than a dropped one; a missing file yields its folder with nothing selected; an absent windows key yields one empty window; whether a folder-less window is restored is decided and stated
- [ ] #7 The number of restored windows is capped, dropping from the least-recently-focused end, and the cap is stated with its per-window cost (a Shiki WASM highlighter and a mermaid instance per WebView)
- [ ] #8 An existing lastFolder / lastFile pair is migrated into a single-entry windows list on first launch and both keys are then deleted
- [ ] #9 How often the live set reaches disk is decided and stated, so a crash does not lose more than today's single-folder behaviour does
- [ ] #10 report_window_content(folder, file) exists and is called whenever a window's displayed folder or file changes — the folder picker, a handed-over or restored initial location, and TASK-12.5's Open Recent replace — and focus changes reorder the entries
- [ ] #11 The one-time migration also renames the main entry in .window-state.json to the first restored window's label, so an existing install keeps its size and position and no dead label is left behind
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 The Windows and Linux quit path (closing the last window) is exercised, or explicitly recorded as unverified with the reason
- [ ] #3 Closing one window while others are open and then quitting restores one fewer window
- [ ] #4 On macOS, Cmd+Q with three windows restores three; closing them one at a time down to the last restores one
<!-- DOD:END -->
