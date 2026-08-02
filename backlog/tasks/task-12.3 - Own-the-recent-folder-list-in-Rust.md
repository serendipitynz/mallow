---
id: TASK-12.3
title: Own the recent-folder list in Rust
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
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

So: `record_recent(path)` and `list_recent()` as Rust commands, mutating settings.json through tauri-plugin-store's Rust API, with the submenu rebuild happening inside `record_recent`. The frontend calls `record_recent` wherever it currently calls `saveSetting('lastFolder', dir)`.

TASK-12.7 puts the restored session under the same ownership for the same reason, so whichever of the two lands first sets the pattern the other follows.

**Verify before building on it**: that `StoreExt::store("settings.json")` in Rust and `load('settings.json')` in `src/lib/settings.ts` resolve to the same in-process store. If they do not, the frontend's `autoSave: true` write of an unrelated key could clobber `recentFolders`, and the ownership split has to move (either the whole settings file goes to Rust, or `recentFolders` gets its own file).

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
- [ ] #2 record_recent and list_recent exist as Rust commands, and the frontend records a folder wherever it currently saves lastFolder
- [ ] #3 Recording an already-listed folder moves it to the front instead of duplicating it, and the oldest entry is dropped at the cap
- [ ] #4 Ordering, dedupe and cap live in a pure function with cargo test coverage; case-insensitive filesystems are handled by a stated decision, not by silent normalisation
- [ ] #5 Entries whose path no longer exists are dropped from the list and the store at submenu build time, and nowhere else
- [ ] #6 Whether the Rust store handle and the frontend's load('settings.json') share one instance has been verified, and the ownership split reflects the answer
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 cargo check and cargo test pass; pnpm build and pnpm test pass
- [ ] #2 Opening folders from two windows in turn produces one correctly ordered list with no lost entries
<!-- DOD:END -->
