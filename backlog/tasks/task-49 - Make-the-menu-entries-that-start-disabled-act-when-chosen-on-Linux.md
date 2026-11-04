---
id: TASK-49
title: Make the menu entries that start disabled act when chosen on Linux
status: To Do
assignee: []
created_date: '2026-11-04 20:47'
labels:
  - bug
milestone: m-7
dependencies: []
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On Linux, choosing Edit → Find…, Find Next or Find Previous, or View → Back or Forward, from the menu bar does nothing (owner's round, 2026-11-05, Ubuntu 24.04 on VMware Workstation 17 Player, the TASK-47 build). The same actions work from their chords on Linux (TASK-47 AC #1, #4; TASK-44 AC #2), and every entry works from the menu on macOS and Windows.

What the five entries share is not established. One shape they all have: each is built with `.enabled(false)` in `menu.rs` and enabled later by `apply_focused_gates` through `set_enabled`, while an entry enabled from the start — Toggle Explorer — has not been reported as failing. A second candidate is the routing: `emit_focused` resolves its target with `focused_window`, and whether a GTK window still reports itself focused while its menu is open is unmeasured. Neither has been checked. `Export as PDF…` starts disabled too, and whether it acts when chosen from the Linux menu is not recorded anywhere — checking it is the cheapest way to tell the two candidates apart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause is identified on Linux and recorded on this task, with what was measured
- [ ] #2 On Linux, Edit → Find…, Find Next and Find Previous and View → Back and Forward act when chosen from the menu, in a window whose view has find or whose history has somewhere to go
- [ ] #3 Every other menu entry that starts disabled (Print… is refused on Linux by design; Export as PDF…) is checked on Linux and its outcome recorded
- [ ] #4 macOS and Windows keep working from the menu
- [ ] #5 cargo fmt --check, cargo check and cargo test pass inside src-tauri/, and pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
