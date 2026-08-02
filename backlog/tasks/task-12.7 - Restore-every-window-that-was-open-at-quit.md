---
id: TASK-12.7
title: Restore every window that was open at quit
status: To Do
assignee: []
created_date: '2026-08-02 21:24'
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

Reporting into it:

- A window reports its folder and selected file wherever `src/App.tsx` currently calls `saveSetting('lastFolder', …)` and `saveSetting('lastFile', …)` (`src/App.tsx:48`, `:55-56`). One command, keyed by the calling window's label.
- Focus order comes from `WindowEvent::Focused`: a focused window moves to the end of the order.

## Telling a closed window from a quitting app

A window's destroy handler cannot tell why it is being destroyed, and on quit every window is destroyed one by one - so a naive "remove my entry when I close" empties the restored session at exactly the moment it is needed.

The exiting flag is what separates the two: set it on `RunEvent::ExitRequested`, and have the destroy handler drop the window's entry only while the flag is false. TASK-12.1 already registers a destroy hook for the watcher registry; both consumers can share it, but they do not share the rule - the watcher is dropped either way, the session entry only on a deliberate close.

Verify the ordering that the whole scheme rests on: that `ExitRequested` really does arrive before the windows are destroyed, on each of the three platforms, and for each way of quitting (⌘Q, closing the last window, the OS asking the app to quit). If it does not hold somewhere, the fallback is to write the session on every change instead of at exit, and to treat a close during shutdown as a no-op by other means.

## Restoring at launch

tauri.conf.json declares one window, so `main` is created before `setup` runs. Restore therefore means: apply the first entry to `main`, and create the rest in `setup` with `open_window`, each with its label and initial location from its entry. Focus the last entry's window when they are all up.

Cases to settle rather than discover:

- Empty or absent `windows` - one empty `main`, which is what a first launch already does.
- A folder in an entry no longer exists - open that window empty rather than dropping it, so the window count is preserved and the user sees which one lost its folder. Its file entry goes with it.
- A file no longer exists but its folder does - open the folder with nothing selected. `src/App.tsx:119-130` already validates both halves with `pathExists`; keep that check, now per entry.
- The saved set is large - cap the number of restored windows, and say what the cap is. Restoring twenty windows on a launch the user did not expect is worse than restoring the first few.

## Migrating the existing setting

An installed copy has `lastFolder` / `lastFile` and no `windows`. On first launch after the change, seed a single-entry restored session from the pair, then delete both keys so nothing reads them again. Without that step, everyone with mallow already installed loses their open folder on the upgrade - a small loss, but an avoidable one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 settings.json holds a windows key with one entry per open window (label, folder, file), ordered least-recently-focused last, owned and written by Rust; lastFolder and lastFile are gone
- [ ] #2 Each window reports its folder and selected file where App.tsx currently saves lastFolder / lastFile, and focus changes reorder the entries
- [ ] #3 The exiting flag distinguishes a deliberate window close (entry dropped) from shutdown (entry kept), and the ExitRequested-before-destroy ordering has been verified on all three platforms and for each way of quitting
- [ ] #4 Launch applies the first entry to main, creates the rest with their labels and initial locations, and focuses the last entry
- [ ] #5 A missing folder yields an empty window rather than a dropped one; a missing file yields its folder with nothing selected; an absent windows key yields one empty window
- [ ] #6 The number of restored windows is capped and the cap is stated
- [ ] #7 An existing lastFolder / lastFile pair is migrated into a single-entry windows list on first launch and both keys are then deleted
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 Quitting with three windows on three folders and relaunching brings all three back with their documents, sizes and positions, on macOS and on at least one other platform
- [ ] #3 Closing one window and then quitting restores two, not three
<!-- DOD:END -->
