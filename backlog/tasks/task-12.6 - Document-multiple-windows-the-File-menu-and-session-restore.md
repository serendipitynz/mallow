---
id: TASK-12.6
title: 'Document multiple windows, the File menu and session restore'
status: Done
assignee: []
created_date: '2026-08-02 21:14'
updated_date: '2026-09-15 21:16'
labels:
  - documentation
milestone: m-3
dependencies:
  - TASK-12.5
  - TASK-12.7
  - TASK-12.8
parent_task_id: TASK-12
priority: medium
type: docs
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document multiple windows, the File menu and session restore once the behaviour is settled, in both language versions of both documents.

- `AGENTS.md` / `AGENTS.ja.md` - the Architecture section still describes `watch.rs` as "the watcher handle lives in `WatcherState`" and `lib.rs` as "(macOS only) a native app menu". Update both, and add to Implementation notes: the watcher registry with per-window `emit_to`, the capability window glob, the initial-location handover chosen in TASK-12.2 with its reload trade-off, the slot-reuse label scheme and why per-label geometry is kept, the `"create": false` decision that removes the `main` window, and the last-window rule with the four quit paths behind it (closing the last window, macOS ⌘Q, Windows File > Exit, `AppHandle::exit()` - only the first emits a per-window destroy, and even there `ExitRequested` fires inside it). Those facts cost real source reading to establish and will be re-derived by whoever touches this next if they are not written down.
- `README.md` / `README.ja.md` - multiple windows, the File menu, the New Window / Open… / Close Window shortcuts, the modifier gesture with its per-platform reach as TASK-12.5 leaves it, and that quitting and relaunching brings the whole window set back. Close Window is listed because TASK-13 takes its chord for Close Tab and TASK-13.5 has to correct whatever this task wrote; a shortcut that was never documented cannot be corrected. If TASK-13.5 has already landed, there is nothing to correct - document `CmdOrCtrl+Shift+W` for Close Window and `CmdOrCtrl+W` for Close Tab directly, and leave its tab material alone.
- State the behaviours users would otherwise report as bugs: a new window inherits the remembered size of whichever window last held its slot, restored windows are capped at the number TASK-12.7 settles on, and a window whose folder disappeared comes back empty rather than missing.
- Record the rule that per-window event delivery is a pair: Rust's `emit_to` plus a `getCurrentWebviewWindow().listen` on the frontend. A listener left on the default `Any` target ignores the emitter's filter entirely, so half the pair looks correct and delivers to every window. The next per-window event added to mallow will hit this otherwise.
- Record whatever TASK-12.8 chose not to propagate across windows as a known limitation, per setting.
- Menu labels are English on every platform regardless of the app's UI language, and that is deliberate for now (TASK-12.4). Note also that the menu differs by platform, so a screenshot of one is not the others.
- Add translated menu labels to Known follow-ups. Also drop `lastFolder` / `lastFile` from any description of the settings file and describe the `windows` key instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and README.ja.md list multiple windows, the File menu, the shortcuts, the modifier gesture with its per-platform reach, and window-set restore
- [x] #2 Slot-inherited geometry, the restored-window cap and the empty-window-on-missing-folder behaviour are stated as intended; English-only menu labels are stated as deliberate
- [x] #3 Descriptions of the settings file name the windows key, not lastFolder / lastFile
- [x] #4 Known follow-ups gains translated menu labels
- [x] #5 AGENTS.md and AGENTS.ja.md describe the watcher registry, the capability window glob, the initial-location handover, the label slot scheme, the create:false decision and the destroy-versus-quit rule with its event-ordering facts; the stale 'watcher handle lives in WatcherState' and 'macOS only' lines are gone
- [x] #6 Whatever TASK-12.8 does not propagate across windows is listed as a known limitation, per setting
- [x] #7 AGENTS.md records that window enumeration must use webview_windows(), because the obvious Manager methods are unstable-gated
- [x] #8 The window-state migration is documented: an existing install keeps its geometry because the main entry is renamed once, and that migration reads another plugin's state file by design
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Both language versions of both documents agree with the shipped behaviour
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #2's four statements are in AGENTS, not in README. The user cut them from README.ja.md on 2026-09-16 as too verbose for a user-facing document — the menu composition and the English labels because launching the app shows both, and the restore cap, the inherited geometry and the empty-folder case because that detail belongs with the mechanism. README now carries one pointer to AGENTS instead. AC #2 names no file, so it stays met; AC #1's list is unaffected, since the shortcuts, the modifier gesture and window-set restore are still in README.

Two claims were corrected in the same round, both of them wrong in the direction of promising more than was measured. 'Prints in the light palette whatever theme is on screen' is false: lib/mermaid.ts renders its SVG with mermaid's own dark theme and print.scss only caps its width, and Shiki's dark tokens are inline !important values the stylesheet cannot un-apply. The wording is now that a print stylesheet applies rather than the screen's theme. And macOS's truncation was observed through the print UI's PDF destination alone, never against a physical printer, so it is now written as a page count that does not match the print preview rather than as a document losing its end.
<!-- SECTION:NOTES:END -->
