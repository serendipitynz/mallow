---
id: TASK-13
title: Keep several documents open as tabs in one window
status: To Do
assignee: []
created_date: '2026-08-05 21:44'
updated_date: '2026-08-05 21:44'
labels:
  - feature
dependencies: []
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella for keeping several documents open at once in one window as a tab strip, the way VS Code and Zed do.

The need is the return trip: selecting a second file in the tree replaces what is on screen, so going back to the first document means finding it in the tree again. `src/App.tsx:26` holds one `selected` and `src/components/Viewer.tsx:107` remounts the body on `key={file.path}`, so nothing of the previous document survives - not its scroll position, not its preview/source choice.

**This is not TASK-12 by another route, and decision-4 records why.** A tab shows one document at a time, so no tab strip delivers the side-by-side comparison TASK-12 exists for; VS Code and Zed ship tabs *and* multiple windows, and use a split pane for comparison. The two tasks are siblings, and neither descopes the other.

## Vocabulary (fixed in decision-4; every subtask uses these words for these things)

- **document tab** - the tab item representing one file, kept open, inside the one folder its window has open. It holds a file path; the folder belongs to the window, not to the tab. A tab that also held a folder (a *location tab*) was rejected in decision-4.
- **tab set** - a window's ordered list of tab items together with which one is active. Its order is the strip order, left to right, and that is the order the restored session stores `files` in. Subordinate to the window's folder: changing the folder empties it.
- **tab store** - the hook owning the tab set and the tab view state record, from which `App` distributes to the Explorer, the Toolbar, the strip and the viewer. It takes over the state `src/App.tsx` holds today as a single selection, and follows `src/hooks/useFileTree.ts`. Not a strip-and-body component: `Explorer`'s `selectedPath` and `Toolbar`'s `selected` need the active tab too, and state inside such a component cannot reach its siblings.
- **provisional tab** - a tab in the state of being replaceable by the next plain click in the tree; at most one per window. This is VS Code's italic preview tab. It can exist only under `openFileIn: 'reuseTab'`.
- **committed tab** - a tab in the state of not being replaced by any later file-open.
- **explicit gesture** - a double-click on a tree row, a double-click on a provisional tab, or `CmdOrCtrl+Enter` on a focused tree row. Defined by the end state they produce, not the operation: the file's tab exists and is committed. TASK-13.1 owns the assignment.
- **tab view state** - what is preserved per tab across a switch away and back: the view-mode selection its file kind offers, and the scroll position. TASK-13.2 enumerates which kinds offer what.
- **openFileIn** - the settings.json key holding the default destination of a file chosen in the tree: `'reuseTab'` (the provisional tab - the default) or `'newTab'` (a committed tab every time, and no provisional tab is ever created). Per decision-4 it selects a default, not a mode.

## Behaviour

- A tab strip above the viewer, one tab per open document, always present - not conditional on a setting (decision-4).
- A plain click in the tree opens the file per `openFileIn`. After an explicit gesture the file's tab is committed, whether that meant opening it or promoting the tab a plain click had just made provisional: the opposite of the default under `'reuseTab'`, the same end state as a plain click under `'newTab'`. There is deliberately no gesture for making a tab provisional - decision-4's rule 3a states why the two destinations are not symmetrically reachable.
- Changing the window's folder closes every tab (decision-4's decision 7).
- Closing a tab activates its right neighbour, falling back to the left one. Closing a tab never closes the window - the last one leaves it open on its folder, empty.
- `CmdOrCtrl+W` closes the active tab and does nothing with no tabs open, where File > Close Tab is disabled. Close Window moves to `CmdOrCtrl+Shift+W`.
- The open tab set comes back on relaunch.

## What the current code assumes, and therefore breaks

- `src/App.tsx:26` is a single `selected`, written by `selectFile` (`:46-49`) and passed to both `Explorer` and `Viewer`. It becomes the *active* tab, derived from the tab set. `selectFile` also persists `lastFile` (`:48`), and `openFolder` clears the selection (`:54`) - the successors of both are named in TASK-13.1, since a state that is now derived cannot carry a write of its own. TASK-13.1.
- `src/components/MarkdownView.tsx` keeps `mode` in local state and `src/components/Viewer.tsx:107` keys the body on the file path, so a tab switch discards both the mode and the rendered DOM. TASK-13.2.
- `src/lib/settings.ts:5-12` has no key for the default destination and `src/App.tsx:109-136` reads settings once at mount; TASK-12.8 makes a setting change reach every window, and a once-at-mount read would leave other windows on the stale default. TASK-13.3.
- `src/lib/title.ts` computes the window title from a Markdown front-matter `title` when present. With tabs it must follow the active tab, and the tab label deliberately does *not* use that computation (decision-4). TASK-13.1.
- TASK-12.4 binds `CmdOrCtrl+W` to Close Window, and no muda predefined item can carry `CmdOrCtrl+Shift+W`: the accelerator is derived from the item type (muda-0.19.3 `src/items/predefined.rs:331-337`) and the type has no setter for it, only `set_text` (`:186-201`). TASK-13.3 owns the reconciliation, or TASK-12.4 does if it lands second.
- TASK-12.7's restored session entry already holds `files` plus `active` as a list, settled there for this task's benefit so the settings file migrates once rather than twice. TASK-13.4 fills it with more than one entry and widens `report_window_content`.

## Decisions taken here (reverse them here, not inside a subtask)

1. **Correctness of tab view state does not depend on keeping an inactive tab's DOM mounted.** Capture on deactivate and restore on activate through the existing `src/lib/scroll.ts` anchor machinery; DOM retention is then a pure re-render-cost optimisation with its own policy (TASK-13.2). Relying on the engine to preserve `scrollTop` behind whatever hiding mechanism is chosen would make correctness depend on unverified per-WebView behaviour.
2. **No New Tab command, no `CmdOrCtrl+T`.** A tab exists because a file was opened, and mallow has no empty document to put in a fresh one (decision-4).
3. **The tab strip is not gated on a setting.** With `'reuseTab'` a window simply tends to have one tab. Two conditional layouts would double the surface every later viewer change has to be checked against.

## Landing order against TASK-12

This umbrella declares no dependency on TASK-12. Only TASK-13.2 touches nothing TASK-12 owns; the other four meet it, in different ways, and none is a blocker:

- **TASK-13.1** is UI work that TASK-12 does not reach, with one exception: where the active tab's path is persisted until TASK-13.4 lands is `lastFile` or `report_window_content`, depending on whether TASK-12.7 has replaced that key. It states both.

- **TASK-13.3** reconciles with TASK-12.4 (the `CmdOrCtrl+W` chord) and TASK-12.8 (propagating the setting between windows), in both landing orders, and states which it is in.
- **TASK-13.4** persists the tab set. It declares TASK-12.7 as a dependency because that is the cheap path - the entry shape is already a list - but it also carries a fallback for shipping first, so this feature is not gated on TASK-12 landing at all. TASK-12.7's own migration section records the extra branch that fallback costs it.
- **TASK-13.5** meets TASK-12.6 at the documents themselves: whichever writes the `CmdOrCtrl+W` line second corrects the other's. Both sides record it.

The point of writing this down: "sibling feature, no dependency" is true of the *feature*, and false of the relaunch item in the Definition of Done unless the fallback exists. Do not read the empty dependency list as meaning the persistence half is free.

## No new production dependencies

The strip is a plain React component with SCSS; any icon it needs is copied into `src/components/icons.tsx` from Lucide as the existing ones are, per AGENTS.md. If something here looks like it wants a library, that is a signal to re-scope rather than to ask.

## Out of scope

A split pane inside one window (that is the only thing that gives simultaneity, and it belongs to neither this task nor TASK-12); drag-to-reorder tabs; a tab overflow dropdown - the strip scrolls horizontally instead; pinning a tab as a distinct state beyond the provisional/committed distinction; per-tab folders.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 TASK-13.1 through TASK-13.5 are all Done
- [ ] #2 Two documents from the same folder are open at once, and switching between them keeps each one's scroll position and preview/source choice
- [ ] #3 A plain click in the tree follows openFileIn, and the explicit gesture leaves the file's tab committed at either setting value, whether it had to be opened or promoted
- [ ] #4 CmdOrCtrl+W closes the active tab; closing the last tab leaves the window open on its folder, and with no tabs open the chord does nothing and File > Close Tab is disabled; Close Window is on CmdOrCtrl+Shift+W
- [ ] #5 Opening a different folder in a window closes every tab it had
- [ ] #6 Quitting with several tabs open and relaunching brings them all back with the same one active
- [ ] #7 pnpm build, pnpm test, cargo check and cargo test all pass
- [ ] #8 No new production dependency was added
<!-- DOD:END -->
