---
id: TASK-13.4
title: Restore the open tab set on relaunch
status: To Do
assignee: []
created_date: '2026-08-05 21:48'
labels:
  - feature
dependencies:
  - TASK-13.1
  - TASK-12.7
parent_task_id: TASK-13
priority: high
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the open tab set back on relaunch. The storage shape is already there - TASK-12.7 settled the restored session entry as `{ label, folder, files, active }` with `files` as a list precisely so this task fills it instead of migrating the settings file a second time (decision-4).

## What this task adds

- **Widen the report.** `report_window_content(folder, file)` becomes the tab-set form, carrying the ordered open paths and which one is active. That is a Rust signature change against a stored shape that already accommodates it, which is why TASK-12.7 deliberately left it single-file.
- **Report on tab churn.** TASK-12.7 states its rule as a predicate over the change, not a call site: whenever a window's displayed content changes, it reports. Opening a tab, closing one and activating a different one are all such changes. Tab churn is more frequent than folder churn, so confirm it rides the disk-write frequency TASK-12.7 settled (its AC #9) rather than adding a second policy. Do not call that policy write-through here: TASK-12.7 has not decided between writing on every report and coalescing, and naming it would presuppose the answer.
- **Widen the handover, which is the half an earlier draft of this task left blank.** Writing the tab set is useless if the restored window cannot receive it. A window learns what to open through TASK-12.2's `take_window_init`, and TASK-12's vocabulary fixes that payload as a folder plus **one** file - so the *initial location* grows the same list and active marker, and TASK-12's vocabulary entry now says so. The mechanism is untouched (deposited by the creating side, taken exactly once at mount), which is what TASK-12.2 declared settled; only the payload widens. Do **not** solve this by having the frontend read the `windows` key directly: TASK-12.3 and TASK-12.7 put that key under Rust ownership precisely to keep several windows from read-modify-writing it from JS.
- **Restore at mount.** Rebuild each tab with `fileEntryFromPath` (`src/lib/file.ts`), which is what the current restore path at `src/App.tsx:119-130` already uses for the single file.

## If this lands before TASK-12.7

The frontmatter declares TASK-12.7 as a dependency, which is the intended order rather than a gate - decision-4 keeps tabs a sibling of TASK-12, and a tab set that evaporates on quit would make this feature feel unfinished on its own. So the fallback: replace today's frontend-owned `lastFile` with `lastFiles` plus `lastActive` in `src/lib/settings.ts`, restoring from those with the same validation and cap rules below. The key is written from **two** sites, not one - `selectFile` (`src/App.tsx:48`) and `openFolder` clearing it (`:56`) - and leaving either behind is how the two-sources-of-truth state this task refuses gets created anyway. Single-window means the JS read-modify-write hazard that forces Rust ownership in TASK-12.7 does not exist yet.

**In this order the payload widening changes hands.** There is no `take_window_init` to widen yet - TASK-12.2 introduces it - so TASK-12.7 must introduce the initial location already carrying the list plus the active marker, because the frontend it hands to has a tab set by then. Without that, the migration faithfully lifts `lastFiles` into `files` and then the restore path hands over one file and the tab set is lost at the last step - the same loss TASK-12.7's migration exists to prevent, arriving by a different route. That task records it too.

That costs TASK-12.7 one extra branch in a migration it already has to write - seed from whichever keys the install carries, and delete all of them - and that task records the branch, so the cost is not discovered later. What it must not do is leave `lastFile` in place beside the new keys: two sources of truth for the same thing is what TASK-12.7 refuses for the window set, for the same reason.

## Cases to settle rather than discover

- **A file in the list is not under the folder, or no longer exists** - drop that tab. Today's restore validates both halves with *three* conditions, not one: `s.lastFile && isInside(s.lastFolder, s.lastFile) && pathExists(s.lastFile)` (`src/App.tsx:127`). Keep all of them, now per file. The `isInside` half is the only place decision-4's decision 7 - no tab outside the window's folder - is enforced at restore, and the fallback below makes it matter more, not less: `lastFolder` and `lastFiles` are separate writes, so a crash between them can leave a folder and a file list that disagree. Unlike a missing *folder*, which TASK-12.7 restores as an empty window to keep the window count honest, a missing file has nothing to show and no reason to hold a slot.
- **`active` names a path that was dropped, or is absent** - activate the last remaining tab. An entry with `files` non-empty and no valid active tab must not restore with nothing selected.
- **Restored tabs are all committed.** A provisional tab is a transient thing that the next plain click would replace; carrying that transience across a relaunch is a distinction without a difference. State it in a comment.
- **Only the active tab's ancestors need expanding.** `expandPaths` + select at `src/App.tsx:127-130` exists to reveal the restored file in the tree; the other tabs need no tree work at all. This is what keeps restoring many tabs cheap, and it is worth a comment so nobody "fixes" it into expanding all of them.
- **Cap the number of restored tabs**, state the cap, and express the rule in terms the saved shape can answer: **keep the first N in strip order, and always keep the active tab** (pulling it in if it falls outside those N). "Drop the oldest" is *not* available - the entry stores `files` in strip order and TASK-13.1's rule 3 inserts a new tab after the active one, so strip position does not encode when a tab was opened, and recency would have to be persisted as well. With TASK-13.2's retention policy only the active tab renders at launch, so the cap is about the read and the strip's width rather than about render cost - say which, since TASK-12.7's window cap is justified differently (a Shiki highlighter and a mermaid instance per WebView).
- **Order is preserved.** The strip comes back in the saved order, not in path or alphabetical order.
- **View state is not restored.** A restored tab opens at the top in its view's default mode: TASK-13.2's tab view state lives for the process, and persisting scroll positions and per-tab modes is a wider promise than this task makes. That matches today's behaviour for the single restored file, so it is not a regression - but it will read as one to anyone who assumes tabs come back exactly as they were, which is why TASK-13.5 lists it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 report_window_content carries the ordered open paths and the active one, against the files/active shape TASK-12.7 already stores
- [ ] #2 The initial location carries the same list and active marker, so a restored window can receive what was saved; the handover mechanism itself is unchanged and the frontend does not read the windows key directly - and if this task landed first, that widening is recorded as TASK-12.7's to introduce rather than left unowned
- [ ] #3 If TASK-12.7 has not landed, the stated fallback keys are used and lastFile is removed rather than left beside them
- [ ] #4 Opening, closing and activating a tab all report, at the disk-write frequency TASK-12.7 settled in its AC #9 - or, if that task has not landed, at a stated frequency of the fallback's own (the store's 100 ms autoSave), not a second policy beside an existing one
- [ ] #5 Relaunch brings the tabs back in saved order with the same one active
- [ ] #6 A file that no longer exists or is not under the restored folder is dropped rather than restored as an empty tab, validated per file with both pathExists and isInside
- [ ] #7 An absent or dropped active path falls back to the last remaining tab, never to nothing selected
- [ ] #8 Restored tabs are all committed, and a comment says why the provisional state is not carried across a relaunch
- [ ] #9 Only the active tab's ancestor directories are expanded, with a comment so it is not widened to all tabs
- [ ] #10 The number of restored tabs is capped by a rule the saved shape can answer - the first N in strip order, always including the active tab - and not by a recency the entry does not record
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 Quit with four tabs open on the third one and relaunch: four tabs, same order, third active
- [ ] #3 Delete one of the files while the app is closed and relaunch: that tab is gone and the rest are intact
<!-- DOD:END -->
