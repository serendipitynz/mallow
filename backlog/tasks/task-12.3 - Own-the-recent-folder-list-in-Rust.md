---
id: TASK-12.3
title: Own the recent-folder list in Rust
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
updated_date: '2026-08-02 22:39'
labels:
  - feature
dependencies: []
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The data behind Open Recent: `recentFolders` in settings.json, newest first, capped (10 is the proposed cap), holding folder paths only - mallow opens folders, not files, so a recent *file* list would be a different feature.

## Rust owns the list

Not a style preference; two things force it:

- The Open Recent submenu is built in Rust and has to be rebuilt whenever the list changes. If the frontend owned the list it would have to notify Rust after every write anyway.
- Two windows doing a read-modify-write of an array through the store from JS lose entries. The store is one instance in the Rust process, but the read, the splice and the write are three separate steps on the JS side with no lock between them.

So: `record_recent(path)` and `list_recent()` as Rust commands, mutating settings.json through tauri-plugin-store's Rust API. The frontend calls `record_recent` whenever a window starts showing a folder - through the folder picker, through a restored or handed-over initial location, or through TASK-12.5's Open Recent replace. Those are the same moments at which TASK-12.7 reports the window's content into the restored session; both calls belong together, they record different facts, and neither task may drop the other's write. Do not anchor this to `saveSetting('lastFolder', …)` in `src/App.tsx`: TASK-12.7 lands first in the planned order and removes that key.

The submenu rebuild triggered by a change is **not** part of this task even though it is the reason Rust owns the list: the submenu does not exist until TASK-12.4. Ship the list here (store ownership, the two commands, the pure ordering function) and let TASK-12.4 add the rebuild and the prune call, which is why the prune rule below is described here but verified there.

TASK-12.7 puts the restored session under the same ownership for the same reason, so whichever of the two lands first sets the pattern the other follows.

**Already answered, so do not re-investigate**: the Rust and JS handles are the same in-process store - `StoreBuilder::build_inner` returns the existing store for a path rather than making a second one (tauri-plugin-store-2.4.3 `src/store.rs:194-203`). So there is no clobbering risk. The real consequence is smaller and worth a comment: whichever side creates the store first wins on options, and the later side's options are dropped silently. Both sides ask for a 100 ms auto-save today (JS passes `autoSave: true`, the Rust default is the same, `src/store.rs:68`), so nothing diverges - but a future option set on only one side would not take effect.

## Ordering, dedupe, cap, prune

Keep these as one pure function over `Vec<String>` so they can be unit-tested without an app handle:

- Recording an existing path moves it to the front rather than adding a duplicate.
- The list is truncated to the cap after insertion, dropping the oldest.
- Comparison is on the string as the dialog returned it. macOS and Windows filesystems are case-insensitive, so two spellings of the same folder can both be listed; accept that rather than guessing at normalisation, and say so in a comment.

Pruning is separate from that function because it touches the filesystem: at submenu build time, entries whose path no longer exists are dropped from the list and from the store, so a deleted folder disappears from the menu instead of failing when chosen. One rule, one place - do not also prune on read.

## Clear Recent

A `Clear Recent` item at the bottom of the submenu, below a separator, emptying the list and rebuilding the submenu. Its menu id and placement belong to TASK-12.4; the list-side operation belongs here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 recentFolders is persisted in settings.json, newest first, capped, holding folder paths only
- [ ] #2 Recording an already-listed folder moves it to the front instead of duplicating it, and the oldest entry is dropped at the cap
- [ ] #3 Ordering, dedupe and cap live in a pure function with cargo test coverage; case-insensitive filesystems are handled by a stated decision, not by silent normalisation
- [ ] #4 record_recent and list_recent exist as Rust commands, and the frontend calls record_recent at the same App.tsx call site that reports the window's content, without removing that report
- [ ] #5 The comment records that the Rust and JS store handles are the same instance and that the later side's options are dropped — not a verification task, a recorded fact
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 cargo check and cargo test pass; pnpm build and pnpm test pass
- [ ] #2 Opening folders from two windows in turn produces one correctly ordered list with no lost entries
<!-- DOD:END -->
