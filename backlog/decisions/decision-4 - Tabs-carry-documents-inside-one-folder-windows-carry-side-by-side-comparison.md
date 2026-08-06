---
id: decision-4
title: Tabs carry documents inside one folder; windows carry side-by-side comparison
date: '2026-08-05 21:40'
status: accepted
---
## Context

TASK-12 turns mallow into a multi-window viewer, and states its motivation as
comparison: "today one window shows one folder, so two folders cannot be looked at
side by side." Its Out of scope line lists "Tabs inside a window."

The question this decision answers is whether a tab strip in a single window is an
*alternative* to that — selectable by a setting, so a user who does not want extra
windows gets the same benefit inside one.

**It is not an alternative, and the reason is definitional.** *Side-by-side
comparison* means two documents visible at once with no switching gesture in
between. A tab shows one document at a time. What VS Code and Zed use for
comparison is not the tab strip but the split pane, and both applications ship
tabs **and** multiple windows rather than choosing between them. VS Code's
`window.openFoldersInNewWindow` is not a "windows or tabs" switch either; it
selects where a newly opened *folder* lands.

So the two features answer two different complaints, and only one of them is
recorded anywhere:

- *Two folders cannot be compared* — TASK-12, unchanged by this decision.
- *Reading one document loses the previous one.* Selecting a second file in the
  tree replaces what is on screen (`src/App.tsx` sets a single `selected`, and
  `Viewer` remounts on `key={file.path}`), so returning to the first document
  means finding it in the tree again. Nothing in the backlog covers this.

## Vocabulary (fixed before the design; TASK-13 and its subtasks use these words for these things)

- **document tab** - the tab item representing one file, kept open, inside the one
  folder its window has open. It holds a file path; the folder belongs to the
  window, not to the tab.
- **location tab** - the rejected alternative: a tab item holding a folder root
  *and* a selected file, so switching tabs also switches the explorer tree. Named
  here only so the rejection has a referent.
- **tab set** - a window's ordered list of tab items together with which one is
  active. Its order is the **strip order**, left to right, and that is the order the
  restored session stores `files` in - TASK-13.1 and TASK-13.4 both lean on that
  equation. It is
  subordinate to the window's folder: changing the folder empties it.
- **tab store** - the hook owning the tab set and the tab view state record, from
  which `App` distributes to the Explorer, the Toolbar, the strip and the viewer. It
  takes over the state `src/App.tsx` holds today as a single selection, and follows
  `src/hooks/useFileTree.ts`, which centralises tree state the same way. It is
  deliberately **not** described as the component that renders the strip: the active
  tab is also what `Explorer`'s `selectedPath` (`src/App.tsx:227`) and `Toolbar`'s
  `selected` (`:241`) need, and state living inside a strip-and-body component
  cannot reach its own siblings.
- **provisional tab** - a tab in the state of being replaceable by the next plain
  click in the tree; at most one per window. VS Code shows this as its italic
  preview tab. It can exist **only** under `openFileIn: 'reuseTab'`; `'newTab'`
  never puts a tab in that state.
- **committed tab** - a tab in the state of not being replaced by any later
  file-open.
- **explicit gesture** - a double-click on a tree row, a double-click on a
  provisional tab, or `CmdOrCtrl+Enter` on a focused tree row. What they have in
  common is the end state they produce, not the operation they perform: the file's
  tab exists and is committed. TASK-13.1 owns the assignment.
- **tab view state** - what is preserved per tab across a switch away and back:
  the view-mode selection its file kind offers, and the scroll position. Which
  kinds offer what is TASK-13.2's to enumerate.
- **`openFileIn`** - the settings.json key holding the default destination of a
  file chosen in the tree. `'reuseTab'` makes the provisional tab that
  destination - created if absent, its content replaced if present. `'newTab'`
  opens a committed tab every time and never creates a provisional one.

## Decision

**1. A tab is a document tab. Windows keep the folder.** One window opens one
folder, as today; its tabs are files inside that folder. The location tab is
rejected: it would make the tab strip a second window manager, and it forces two
refactors that the document tab does not need — `src-tauri/src/watch.rs` would
have to hold several watchers per window (TASK-12.1 plans one per window label,
which stays correct under this decision), and `src/hooks/useFileTree.ts`, a single
instance with a single root, would have to become a per-folder cache.

**2. Side-by-side comparison stays with TASK-12.** Tabs do not substitute for it,
and TASK-12 is not descoped or deferred by this decision. A split pane inside one
window is a third thing, and out of scope for both.

**3. The setting selects a default destination, not a mode.** `openFileIn` decides
where a file chosen in the tree goes. The rejected shape is a mode switch that makes
the tab strip appear or vanish: under a `'window'` mode the user would be unable to
keep two documents open at all, and under a `'tab'` mode unable to open a second
window — the second of those would let a setting revoke TASK-12's whole reason for
existing.

**3a. The explicit gesture means one thing at both values: the file's tab ends up
committed.** Stating it as an end state rather than as "open a committed tab" is
deliberate — the gesture has to work on a tab that already exists (promoting the
provisional tab the user just clicked into is the *common* case), and an
open-shaped rule is shadowed by the already-open rule that necessarily runs first.
It is also *not* "the opposite of the setting". Under `'reuseTab'` it is the
opposite, which is the point; under `'newTab'` it lands on the same result as a
plain click, and there is deliberately **no** gesture for making a tab
provisional there. A
user who chose `'newTab'` asked not to have a tab replaced under them, so a gesture
that hands one back is a feature nobody wants — and defining a "demote to
provisional" operation to reach it would double the state machine for it. The
consequence to accept: the two destinations are not symmetrically reachable, and
saying they are is what an earlier draft of this decision got wrong.

**4. `'reuseTab'` is the default**, so an existing install behaves as close to
today as tabs allow until the user asks for something else.

**5. No New Tab command.** A tab exists because a file was opened; there is no
empty document to put in a fresh one. `CmdOrCtrl+T` and a File > New Tab item are
therefore not added — which also removes the question of what destination a
menu-created tab would have.

**6. Tabs are not a mode of the window; they are always present.** With
`'reuseTab'` a window simply tends to have one tab. The strip is not conditionally
rendered on a setting, because that would put two layouts under test for every
later viewer change.

**7. The tab set is subordinate to the window's folder, and changing the folder
empties it.** Decision 1 keeps one folder per window, so a tab whose file is not
under the window's folder cannot exist. Both existing ways the folder changes -
the picker at `src/App.tsx:51-62`, which already clears the selection at `:54`, and
TASK-12.5's Open Recent replacing it in place - therefore close every tab. The
alternative, keeping tabs across a folder change, would either resurrect the
location tab through the back door or leave tabs pointing outside the tree that
shows them.

## Consequences

- **`CmdOrCtrl+W` has to be reassigned, and TASK-12.4 assigns it first.** That task
  gives `CmdOrCtrl+W` to Close Window. Once tabs exist the expected binding is
  Close Tab, with Close Window on `CmdOrCtrl+Shift+W`. Whichever of TASK-12.4 and
  TASK-13 lands second owns the reconciliation; both record it so it is not
  discovered as a conflict.
- **Closing a tab never closes the window.** The rule is about what the gesture
  targets: a tab close targets a tab, so the window stays on its folder and falls
  back to the `viewer--empty` placeholder it already shows before anything is opened
  - identically for the strip's close control, a middle-click and `CmdOrCtrl+W`, so
  no gesture is a special case. With no tabs open the chord does nothing and File >
  Close Tab is disabled. A window here *is* an open folder with a live tree and
  watch, not a document, so throwing that away as a side effect of closing a
  document would be the expensive mistake; browsers close the window because their
  window has nothing else in it, and Close Window on `CmdOrCtrl+Shift+W` plus the
  titlebar control are how a window closes here.

  **An earlier draft let the chord fall through to closing the window once no tabs
  were left**, which is VS Code's behaviour. It is dropped because it cannot be
  built without picking one of two defects: a File > Close Tab item left enabled
  with no tabs, whose label then lies about what it does, or an item correctly
  disabled, which takes its accelerator with it and makes the fall-through
  unreachable from the keyboard anyway.
- **The restored session grows a list where it had a scalar.** TASK-12.7 replaces
  `lastFolder` / `lastFile` with a `windows` key, and its entry is amended here from
  `{ label, folder, file }` to `{ label, folder, files, active }`, `files` ordered.
  An install that upgrades through both features then migrates its settings once
  rather than twice — TASK-12.7 already carries a one-time migration of
  `lastFolder` / `lastFile` and of `.window-state.json`'s `main` entry, and a second
  round of that is worth avoiding for the cost of one shape decision taken now.
- **The handover into a window has to be widened with it.** The saved entry is only
  half of the loop: a restored window learns its content through TASK-12.2's
  `take_window_init`, whose payload TASK-12's vocabulary fixes as a folder plus one
  file. Widening the stored shape while leaving that payload single-file leaves the
  restore path with no way to receive the tab set. So the *initial location* grows
  the same list, and TASK-12's vocabulary entry says so; the mechanism itself
  (deposit in app state, taken exactly once at mount) is unchanged, which is what
  TASK-12.2 declared settled.
- **A tab is far cheaper than a window, and that asymmetry is the reason to have
  both.** TASK-12.7 records that each window carries its own Shiki WASM highlighter
  and mermaid instance in its own WebView. Tabs in one window share those
  singletons (`src/lib/shiki.ts`), so "twenty documents open" is realistic as tabs
  and not as windows. Conversely a window is what gives genuine simultaneity, which
  no number of tabs provides.
- **Preserving tab view state has to work independently of whether an inactive
  tab's DOM is kept.** `src/lib/scroll.ts` already captures and restores a scroll
  position by heading anchor for live reload; capturing on deactivate and restoring
  on activate through that same code makes correctness independent of the retention
  policy, leaving DOM retention as a pure re-render-cost optimisation. Deciding it
  the other way round — "keep every tab mounted, so the browser preserves scroll"
  — bakes an unverified engine behaviour (whether `scrollTop` survives the chosen
  hiding mechanism on WKWebView, WebView2 and WebKitGTK) into the feature's
  correctness.

  **The framing holds only once two things are handled, and both are rules rather
  than tuning choices.** First, a retained media tab keeps its `<video>` element
  alive (`src/components/MediaView.tsx` renders it with `controls`), and a hidden
  video that was playing goes on playing and sounding - so deactivating pauses it.
  Second, heading slugs are unique per document and every heading lookup in the app
  is document-wide (`src/lib/scroll.ts`, `src/components/Outline.tsx`, plus
  `MarkdownView`'s fragment-link path by omission), so two
  retained markdown tabs sharing a slug would corrupt each other's scroll restore
  and Outline - lookups therefore resolve against the tab's own container, which is
  the seam TASK-8 creates. Both are in TASK-13.2. Without the second one the
  retention constant could not exceed zero for markdown at all, so it is not a
  detail of the optimisation but a condition on it.
- **Two open files can share a name**, since a folder tree commonly holds several
  `README.md`. A tab label that is only the file name is ambiguous; disambiguating
  with the immediate parent directory name is what VS Code does and what TASK-13
  specifies.
- **The tab label and the window title are computed differently, deliberately.**
  `src/lib/title.ts` prefers a Markdown front-matter `title` over the file name for
  the window title. Tab labels stay file names — a front-matter title is arbitrarily
  long and the strip has no room — so the same document can read as two different
  names in two places. Stated here rather than filed as a bug later.
- **`openFileIn` must not be read once at mount.** TASK-12.8 makes settings changed
  in one window reach every window; a value read once at mount would leave other
  windows on the old default until relaunch. It is cheap to include, so it is
  included rather than listed as a limitation.
- TASK-12's Out of scope line ("Tabs inside a window") is now inaccurate as a
  permanent statement and is amended to point here.
