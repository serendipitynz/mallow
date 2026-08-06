---
id: TASK-13.1
title: 'Build the tab set, the strip and the open/close gestures'
status: To Do
assignee: []
created_date: '2026-08-05 21:46'
labels:
  - feature
dependencies: []
parent_task_id: TASK-13
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The tab set, the strip that shows it, and the gestures that open and close tabs. Everything a user sees of this feature except the setting (TASK-13.3) and the state that survives a switch (TASK-13.2).

## The tab set replaces the single selection

`src/App.tsx:26` holds `const [selected, setSelected] = useState<FileEntry | null>(null)` and `selectFile` (`:46-49`) writes it. That becomes the tab set - an ordered list plus which tab is active - owned by the tab store, with `selected` *derived* from the active tab rather than stored beside it. Two sources of truth for "what is on screen" is how they drift apart.

Deriving it strands the two other things that hang off `selected` today, and both need a named successor rather than being noticed during implementation:

- `selectFile` also writes `saveSetting('lastFile', …)` (`:48`). A derived value cannot carry a write, and the tab set is what needs persisting anyway - TASK-13.4 owns that. Until it lands, keep persisting the active tab's path where this window already persists it, which depends on the landing order: `lastFile` while that key still exists, or `report_window_content(folder, activePath)` once TASK-12.7 has replaced it (that task deletes the key, so writing to it would be writing to nothing). This is the one point where TASK-13.1 meets TASK-12.
- `openFolder` clears the selection (`:54`). Its successor is the folder rule below, not a `setSelected(null)` equivalent.

A tab holds the whole `FileEntry`, not just the path: `Viewer` routes on `kind` (`src/components/Viewer.tsx:113-130`) and the label needs `name`. `fileEntryFromPath` (`src/lib/file.ts`) already synthesizes one from a bare path, which is what TASK-13.4's restore path needs.

Keep the derivation honest about what stays single: `Explorer`'s `selectedPath` prop highlights exactly one row and should keep highlighting only the active tab, as VS Code does. Do not turn it into a set.

## Changing the window's folder empties the tab set

Decision-4's decision 7: one folder per window means a tab whose file is not under that folder cannot exist. Both ways the folder changes close every tab - the picker at `src/App.tsx:51-62` (which is where `setSelected(null)` lives today) and, when it lands, TASK-12.5's Open Recent replacing the folder in place. TASK-12.5's criteria say "selection clears"; with tabs that reads as "the tab set empties", and that task's implementer needs to find the rule here rather than infer it.

## Which tab an open lands in

`openFileIn` itself belongs to TASK-13.3. Until that lands the value comes from a module constant set to `'reuseTab'` - the same default - so **implement both branches from the start** and exercise this task's criteria by switching that constant. Waiting for the setting would leave the `'newTab'` half unwritten and unverified.

The rules, in the order they are tested:

1. **The file is already open** - activate that tab, and if the open was an explicit gesture and that tab is provisional, promote it. There are never two tabs of one file.

   **The promotion clause is what keeps rule 4 reachable, and leaving it out is the trap.** The common sequence is a plain click into the provisional tab followed by "actually, keep this" - a double-click or `CmdOrCtrl+Enter` on the same row. The file is open by then, so rule 1 matches first and a rule 4 phrased as "open a committed tab" never runs. That is why decision-4 defines the explicit gesture by its end state (the file's tab is committed) rather than by an open operation.
2. **Plain click, `openFileIn` is `'reuseTab'`** - replace the provisional tab's content in place, keeping its position in the strip; create it immediately after the active tab if there is none, the same position rule 3 uses. Either way that tab becomes the active one - worth stating because `selected` is now derived from the active tab, so this is also what moves the Explorer highlight and the viewer body.
3. **Plain click, `openFileIn` is `'newTab'`** - open a committed tab immediately after the active tab, which is where VS Code puts it (its `workbench.editor.openPositioning` default). Appending at the end instead scatters related documents; pick one and comment it.
4. **Explicit gesture, file not open** - open it as a committed tab. **Not "the opposite of the setting"**: under `'newTab'` that would mean making the tab provisional, which decision-4's rule 3a rules out (and which would need a demote operation that exists nowhere). So under `'reuseTab'` the gesture is the opposite of the default, and under `'newTab'` it lands on the same end state as a plain click - deliberately redundant rather than defined into a second state machine.

The explicit gesture is a **double-click on the tree row**, a double-click on a provisional tab itself (VS Code's gesture for the same thing), or the keyboard route below. `FileTree` has no context menu today and adding one is a larger surface than this task needs.

**Keyboard users need a path to it too, and the obvious place to put it does not work.** The tree rows are `<button>`s activated by `onClick` (`src/components/FileTree.tsx:80-97`), so Enter produces a plain click and nothing else - a keyboard-only user could never commit a tab. The gesture is `CmdOrCtrl+Enter` on a focused row, but the roving-navigation handler in `src/components/Explorer.tsx:20-46` cannot host it: it walks the DOM's `.tree__row` buttons (`:22-23`) and there is no route from a focused button back to its `FileEntry` - the entry lives only in `FileTree`'s closure, and the button carries no `data-path`. Pick one and write it down: put the key check on the row button's own `onKeyDown`, where the entry is in scope, or give the button a `data-path` the roving handler can resolve. If you take the `data-path` route, `:21`'s early return for anything but the four arrow keys has to change with it; on the row's own `onKeyDown` the key is handled before the container sees it, so that guard can stay.

Call `preventDefault()` on that keydown. A `<button>` synthesises a click from Enter, and whether it still does so with a modifier held has not been measured here - so do not depend on either answer. Suppressing the default makes the sequence deterministic instead of relying on rule 1 to absorb a click that may or may not arrive.

**Under `'reuseTab'` a double-click needs no timing code, and this is worth knowing before someone writes some.** The DOM fires `click`, `click`, `dblclick`: the first click opens the file into the provisional tab, the second is absorbed by rule 1 (the file is already open, so it re-activates the same tab), and the `dblclick` reaches rule 1 again - this time as an explicit gesture, so the promotion clause fires. The end state is identical to having detected the double-click up front, so there is nothing to debounce, as long as promotion is a separate operation from opening. Under `'newTab'` the same sequence is inert after the first click, since the tab is already committed.

## The strip

- Sits **inside the viewer column**, above the body - not as a full-width header under the toolbar, which would run across the Explorer as well and land on the wrong side when `explorerSide` is `'right'`. Its styles go in `src/styles/app.scss` beside the existing `.toolbar` rules rather than a new partial, matching where the toolbar already lives.
- Renders nothing when the tab set is empty; the empty viewer keeps today's `viewer--empty` placeholder (`src/styles/app.scss`). This is not the setting-gated layout decision-4 rules out - there is simply nothing to draw, and it is reachable in exactly three ways: before anything is opened, right after the folder changed, and after the last tab was closed.
- Overflows by scrolling horizontally (`overflow-x`), with no dropdown - the strip must never wrap to a second row, since a growing header would push the viewer down. Check it under a narrow window on each platform's WebView.
- A provisional tab is visually distinct from a committed one; italics is what VS Code uses and costs nothing.
- Each tab has a close control, and middle-click (`auxclick`, `button === 1`) closes too. Suppress the default on that event and on the switching chords: a middle-click over a horizontally scrollable strip triggers autoscroll on Windows and a primary-selection paste on X11, and `Ctrl+Tab` is a focus-traversal chord. Same standard as the Enter case below - do not leave a default to fight the handler.
- Labels, `title` attributes and aria labels need keys in **both** the `ja` and `en` dictionaries in `src/lib/i18n.tsx`.
- Any icon comes from Lucide copied into `src/components/icons.tsx`, per AGENTS.md - no `lucide-react`.

## Two open files can share a name

A folder tree commonly holds several `README.md`, so a label that is only the file name is ambiguous. Disambiguate with the immediate parent directory name, and only for the names that actually collide among the open tabs - a rule that changes labels as tabs open and close, so compute it from the tab set rather than caching it on the tab.

`src/lib/path.ts` has `basename` but no `dirname`. Add one there rather than inlining a regex at the call site: it is the module that already understands both separator styles, drive letters and UNC prefixes, and it has unit tests (`src/lib/path.test.ts`) the new helper belongs in. The label rule itself is pure and testable, so keep it out of the component.

## Closing

Closing the active tab activates its right neighbour, falling back to the left one when it was last - **the browser behaviour, and deliberately not VS Code's**: its `workbench.editor.focusRecentEditorAfterClose` defaults to true, so focus goes to the most recently used editor instead. Same ground as strip-order cycling below - where focus lands should be predictable from the screen. Closing an inactive tab leaves the active one alone.

**Closing a tab never closes the window**, so the last one leaves it open on its folder showing the empty placeholder. Every gesture behaves the same way - the close control, a middle-click and `CmdOrCtrl+W` - so none is a special case, and with no tabs open the chord does nothing (decision-4 records why the VS Code-style fall-through was dropped). A window in mallow is an open folder with a live tree and watch, not a document, so it does not evaporate as a side effect of closing a document.

`CmdOrCtrl+W` itself is TASK-13.3, together with the Close Window reassignment it forces.

## Switching by keyboard

`CmdOrCtrl+1` .. `CmdOrCtrl+8` select the nth tab and `CmdOrCtrl+9` selects the last one, **as browsers do** - not as VS Code does, whose `CmdOrCtrl+1` focuses the first editor *group* rather than selecting a tab. (VS Code puts "open the nth editor" on a different chord; which one is not worth asserting here, because the point is only that `CmdOrCtrl+N` is not it.) `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle **in strip order**, the browser rule, rather than VS Code's most-recently-used order, on one ground: strip order is what the user can see, so the next tab is predictable from the screen. Not on the ground that an MRU order would be extra bookkeeping - TASK-13.2's retention policy keeps a most-recently-active order anyway, so that argument would be false here. The existing global handler at `src/App.tsx:185-194` (which owns `CmdOrCtrl+,`) is where these belong.

**Verify `Ctrl+Tab` actually reaches the WebView** on each platform before relying on it - it is a focus-traversal chord the host may consume - and if it does not, say so rather than shipping a dead binding.

## The window title has to have exactly one owner

`src/components/Viewer.tsx` calls `setWindowTitle` from its own effect (`:32`, `:41`, `:48`, `:53`), using `documentTitle` from `src/lib/title.ts`, which prefers a Markdown front-matter `title` over the file name. With several tabs that effect would run in whichever bodies are mounted and the last one to finish reading would win.

Give the title one owner: `Viewer` reports its resolved document title upward, and `App` sets the window title from the **active** tab's reported title. The title still needs the file's content to resolve front-matter, which is why it cannot simply be computed from the tab set.

Tab labels deliberately do **not** use `documentTitle` (decision-4): a front-matter title is arbitrarily long and the strip has no room, so the same document can read as two different names in the tab and in the window title.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The tab store owns the tab set as an ordered list plus an active tab, and the single selection App.tsx holds today is derived from it rather than stored beside it
- [ ] #2 The two other things hanging off that selection have named successors: the lastFile write and openFolder's clear
- [ ] #3 Opening a file that is already open activates its tab instead of duplicating it
- [ ] #4 A plain click follows openFileIn, the newly opened or replaced tab becomes active, and where a new tab is inserted - provisional or committed - is decided and commented
- [ ] #5 After an explicit gesture the file's tab is committed at both setting values, whether the tab already existed or not, and no demote-to-provisional operation exists
- [ ] #6 Double-clicking a tree row whose file is already open in the provisional tab promotes that tab rather than doing nothing
- [ ] #7 CmdOrCtrl+Enter on a focused tree row reaches the same end state; where the key check lives is stated, since Explorer's roving handler cannot resolve a focused row back to its FileEntry
- [ ] #8 That keydown calls preventDefault() rather than depending on whether a modifier-held Enter still synthesises a click, which is unmeasured
- [ ] #9 Promotion is a separate operation from opening, so the click-click-dblclick sequence needs no timing code, and a comment says why
- [ ] #10 Changing the window's folder empties the tab set, through the picker and through TASK-12.5's in-place replace when that exists
- [ ] #11 Closing a tab never closes the window: the last one leaves it open on its folder showing the empty placeholder, identically for the close control, middle-click and the chord
- [ ] #12 Closing the active tab activates the right neighbour, falling back to the left - not the most recently used tab; closing an inactive tab does not change the active one
- [ ] #13 Middle-click closes a tab, with the event default suppressed so it does not autoscroll the strip on Windows or paste the primary selection on X11
- [ ] #14 Every new label, title and aria string has a key in both the ja and en dictionaries
- [ ] #15 Tab labels disambiguate colliding file names with the immediate parent directory name, computed from the tab set by a pure function with unit tests
- [ ] #16 lib/path gains a dirname helper covered by src/lib/path.test.ts, rather than a regex inlined at the call site
- [ ] #17 A provisional tab is visually distinct from a committed one
- [ ] #18 The strip sits inside the viewer column, so it does not span the Explorer at either explorerSide value
- [ ] #19 At the window's minimum width (640) with eight tabs open, the strip stays a single row and scrolls horizontally instead of wrapping
- [ ] #20 The strip's presence and layout are identical at both openFileIn values
- [ ] #21 CmdOrCtrl+1..8 select the nth tab, CmdOrCtrl+9 the last, and Ctrl+Tab / Ctrl+Shift+Tab cycle forwards and backwards in strip order with the default focus traversal suppressed - or they are recorded as consumed by the host on the platforms where they are
- [ ] #22 The native window title has exactly one owner: Viewer reports its resolved document title and App applies the active tab's, so mounted inactive bodies cannot overwrite it
- [ ] #23 Explorer still highlights exactly one row, the active tab
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build and pnpm test pass
- [ ] #2 Three documents open at once; closing, reopening and switching them by mouse and keyboard behaves as the criteria describe
- [ ] #3 No new production dependency was added
<!-- DOD:END -->
