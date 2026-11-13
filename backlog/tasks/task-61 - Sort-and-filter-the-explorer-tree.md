---
id: TASK-61
title: Sort and filter the explorer tree
status: To Do
assignee: []
created_date: '2026-11-13 23:05'
labels:
  - feature
dependencies: []
references:
  - src-tauri/src/commands.rs
  - src/hooks/useFileTree.ts
  - src/components/Explorer.tsx
priority: low
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The explorer lists a folder's entries in one fixed order — directories first, then files, each group case-insensitively by name (`read_dir_tree` in `commands.rs`) — and shows every entry of a supported kind. A folder with many documents offers no way to narrow it or to bring the latest edits to the top (requested 2026-11-14 while using v0.14.0).

What was asked for: **sorting** by name, by kind, by creation date and by modification date, and **filtering**.

To settle at the start:
- **What filtering means**: a text filter on names (matching inside collapsed folders or only in loaded ones — the tree is lazy, so a match in a folder never expanded is not known without reading it), a filter by kind (Markdown only, config only, …), or both.
- **Where sorting happens and what it needs**: the tree's entries carry no dates today, so creation and modification times have to come from `read_dir_tree`. Creation time is not available on every Linux filesystem (`Metadata::created` errors there), so its absence needs a defined place in the order.
- **Whether the choice is per window, per folder or app-wide**, and whether it is a preference that propagates (`settings.rs`) like the explorer's width and side.
- **Where the control sits** and how it reads from the keyboard: the explorer header has the folder name only, and a new control there follows snz-design (doc-9 for menus and segmented controls; check the adoption record for mallow first). Directories-first stays or becomes part of the choice.
- How the live watch (`fs:change`) and `useFileTree.refresh` keep the chosen order and filter when entries change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 What filtering means, where the sort and filter state lives and whether it propagates are settled and written in the task
- [ ] #2 The tree can be sorted by name, kind, creation date and modification date, with entries lacking a creation time placed by a stated rule
- [ ] #3 The tree can be filtered as settled, and the live watch keeps the order and the filter when entries change
- [ ] #4 The control follows snz-design and is fully usable from the keyboard
<!-- AC:END -->
