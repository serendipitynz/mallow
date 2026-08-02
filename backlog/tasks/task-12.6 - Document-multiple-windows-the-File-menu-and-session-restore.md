---
id: TASK-12.6
title: 'Document multiple windows, the File menu and session restore'
status: To Do
assignee: []
created_date: '2026-08-02 21:14'
updated_date: '2026-08-02 21:25'
labels:
  - documentation
dependencies:
  - TASK-12.5
  - TASK-12.7
parent_task_id: TASK-12
priority: medium
type: docs
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document multiple windows, the File menu and session restore once the behaviour is settled, in both language versions of both documents.

- `AGENTS.md` / `AGENTS.ja.md` - the Architecture section still describes `watch.rs` as "the watcher handle lives in `WatcherState`" and `lib.rs` as "(macOS only) a native app menu". Update both, and add to Implementation notes: the watcher registry with per-window `emit_to`, the capability window glob, the initial-location handover chosen in TASK-12.2 with its reload trade-off, the slot-reuse label scheme and why per-label geometry is kept, and the exiting flag that lets a destroy handler tell a close from a quit.
- `README.md` / `README.ja.md` - multiple windows, the File menu, the New Window / Open… shortcuts, the modifier gesture with its per-platform reach as TASK-12.5 leaves it, and that quitting and relaunching brings the whole window set back.
- State the behaviours users would otherwise report as bugs: a new window inherits the remembered size of whichever window last held its slot, restored windows are capped at the number TASK-12.7 settles on, and a window whose folder disappeared comes back empty rather than missing.
- Menu labels are English on every platform regardless of the app's UI language, and that is deliberate for now (TASK-12.4).
- Add translated menu labels to Known follow-ups. Also drop `lastFolder` / `lastFile` from any description of the settings file and describe the `windows` key instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AGENTS.md and AGENTS.ja.md describe the watcher registry, the capability window glob, the initial-location handover, the label slot scheme and the exiting flag; the stale 'watcher handle lives in WatcherState' and 'macOS only' lines are gone
- [ ] #2 README.md and README.ja.md list multiple windows, the File menu, the shortcuts, the modifier gesture with its per-platform reach, and window-set restore
- [ ] #3 Slot-inherited geometry, the restored-window cap and the empty-window-on-missing-folder behaviour are stated as intended; English-only menu labels are stated as deliberate
- [ ] #4 Descriptions of the settings file name the windows key, not lastFolder / lastFile
- [ ] #5 Known follow-ups gains translated menu labels
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Both language versions of both documents agree with the shipped behaviour
<!-- DOD:END -->
