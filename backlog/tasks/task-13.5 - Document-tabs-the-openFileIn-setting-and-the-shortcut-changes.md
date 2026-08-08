---
id: TASK-13.5
title: 'Document tabs, the openFileIn setting and the shortcut changes'
status: To Do
assignee: []
created_date: '2026-08-05 21:49'
labels:
  - documentation
dependencies:
  - TASK-13.2
  - TASK-13.3
  - TASK-13.4
parent_task_id: TASK-13
priority: medium
type: docs
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document tabs, the setting and the shortcut changes once the behaviour is settled, in both language versions of both documents.

- `README.md` / `README.ja.md` - several documents open at once, the gestures that open a tab (including `CmdOrCtrl+Enter` on a tree row, the keyboard route to a committed tab) and the difference the `openFileIn` setting makes, closing a tab, the keyboard shortcuts, and that the tab set comes back on relaunch. State plainly that tabs show one document at a time and that comparing two side by side is what multiple windows are for - a reader who expects a split view will otherwise read the tab strip as a broken version of one.
- `AGENTS.md` / `AGENTS.ja.md` - the Architecture entry for `App.tsx` still says "top-level state: open folder, selection, ...". Replace the single selection with the tab set and name the derivation (the active tab is the selection; the selection is not stored beside it). Add to Implementation notes:
  - The provisional/committed distinction and why a click-click-double-click sequence needs no timing code.
  - That preserving a tab's view state goes through `lib/scroll`'s anchor capture rather than relying on the engine to keep `scrollTop`, and that DOM retention is therefore a tunable cost decision and not a correctness one - with the one exception, pausing a retained video. This is the fact most likely to be undone by a later "simplification".
  - That capture must run before the container is hidden or unmounted, because a hidden container yields a *wrong* anchor rather than none.
  - That heading slugs are unique per *document* only (`lib/markdown` resets its slugger per render), so every heading lookup resolves inside the active tab's own container. Reverting any of them to `document.getElementById` silently breaks scroll restore and the Outline the moment two markdown tabs are retained - the same "most likely to be undone by a simplification" risk as the anchor rule, and the reason the retention constant can exceed zero at all.
  - The window title's single owner: `Viewer` reports its resolved document title and `App` applies the active tab's. Note alongside the existing `setWindowTitle` caveat, which already explains that `document.title` does not move a Tauri window title.
  - That tab labels are file names while the window title prefers a Markdown front-matter `title`, so one document can read as two names.
  - That tabs share the per-WebView Shiki highlighter and mermaid instance, which windows do not - the reason a tab is cheap and a window is not.
- State the behaviours users would otherwise report as bugs: changing the folder closes every tab; closing a tab never closes the window, and `CmdOrCtrl+W` does nothing once none are open; under `'newTab'` there is no gesture that opens a provisional tab, deliberately; the config tree's expansion state is not preserved across a tab switch (it is already a known follow-up for live reload); a PDF tab loses its scroll position because the frame exposes none; an unmounted video tab loses its playback position; a restored tab opens at the top in its default mode because tab view state does not outlive the process; and the restored-tab cap.
- Record `openFileIn` in whatever description of the settings file the docs carry, next to `explorerSide` and `customEmojiDir`.
- If TASK-12.6 has already documented the File menu, its `CmdOrCtrl+W` line is now wrong - Close Tab took that chord and Close Window moved to `CmdOrCtrl+Shift+W`. Fix it there rather than describing two bindings.
- Add to Known follow-ups whatever TASK-13.2 left out per file kind, and drag-to-reorder tabs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README.md and README.ja.md describe tabs, the open gestures, openFileIn, closing, the shortcuts and tab restore
- [ ] #2 Both READMEs say that tabs show one document at a time and that side-by-side comparison is what multiple windows are for
- [ ] #3 AGENTS.md and AGENTS.ja.md no longer describe App.tsx as holding a single selection
- [ ] #4 Their Implementation notes record the provisional/committed distinction, the anchor-based view-state rule with its behavioural exceptions, the capture-before-hiding invariant, the container-scoped heading lookup and why document-wide lookup breaks with two retained tabs, the window title's single owner, the label-versus-title difference and the shared Shiki/mermaid singletons
- [ ] #5 The folder-change rule, the last-tab rule and the deliberate absence of a provisional-tab gesture under 'newTab' are stated as intended behaviour
- [ ] #6 The config-tree expansion gap, the PDF scroll gap, the unmounted-video playback gap, a restored tab opening at the top in its default mode, and the restored-tab cap are stated as intended behaviour
- [ ] #7 openFileIn appears in the docs' description of the settings file
- [ ] #8 If TASK-12.6 already documented CmdOrCtrl+W as Close Window, that line is corrected rather than duplicated
- [ ] #9 Known follow-ups gains drag-to-reorder tabs and whatever TASK-13.2 left unpreserved per file kind
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Both language versions of both documents agree with the shipped behaviour
<!-- DOD:END -->
