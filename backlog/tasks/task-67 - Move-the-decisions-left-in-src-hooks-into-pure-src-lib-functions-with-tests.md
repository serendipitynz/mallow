---
id: TASK-67
title: Move the decisions left in src/hooks into pure src/lib functions with tests
status: To Do
assignee: []
created_date: '2026-11-17 23:22'
labels:
  - chore
dependencies: []
references:
  - TASK-66
  - src/hooks/useUpdater.ts
  - src/hooks/useFileTree.ts
  - src/hooks/useMenu.ts
  - src/lib/update-flow.ts
  - src/lib/tree-nav.ts
  - src/lib/menu-nav.ts
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/hooks` has no tests and 0% coverage (measured 2026-11-18). The suite runs under Node with no DOM by design, so a hook cannot be tested directly without jsdom and a React renderer. Most hooks already hand their decisions to pure functions in `src/lib`, which are tested: `readsOnOpen`, `menuKeyTarget`, `contextMenuPlacement`, `advanceDownload` / `updateNotes`, `restoreScrollAnchor`. Three decisions are still written inside a hook. This task moves them into `src/lib` the same way, as pure functions with unit tests. TASK-66's mutation testing over `src/lib/**` then reaches them with no scope of its own.

**1. The update check in `useUpdater`** (`checkForUpdate` and `confirmInstall`). This is the one that matters most. Its rules live in refs and nested branches, and the comments beside them record how each one was got wrong. The rules the tests pin:
- While a check is running, a second check starts nothing. A manual press during a launch check promotes that check to manual, and shows it as checking.
- Outcomes by trigger:
  - No update: manual reports up to date, launch reports nothing.
  - An update: the check line goes back to idle, and the dialog offers the update.
  - A failure: manual reports it failed, launch reports nothing.
- Starting a check drops an offer the reader has not acted on, whatever the check then returns. Otherwise `available` outlives the handle a confirmation would act on.
- A confirmation does nothing without a pending handle, or while a check or an install is running.
- A failure after consent is reported as not installed. A relaunch failure after a successful install is reported as installed, never as failed.

The hook keeps the Tauri calls, the `Update` handle and its closing. A pure function holds the state the refs hold now and returns the next state. `advanceDownload` in `lib/update-flow` is the shape to copy, and that module is the natural home.

**2. Two choices in `useFileTree`.** `expandPaths` opens shorter paths first, so a parent is expanded before its children. `refresh` re-reads only the expanded folders whose children were already loaded. `lib/tree-nav` already holds `readsOnOpen`, which makes the same kind of choice.

**3. Where `useMenuBody` puts the focus on open.** `first`, `last`, or `current`; `current` is the item marked `aria-checked`, and falls back to the first item when none is marked. With no items, the focus goes to the popup itself. It goes beside `menuKeyTarget` in `lib/menu-nav`.

**Behaviour is unchanged.** This is a move, so no rule above changes on the way. A rule found to be wrong while it is pinned is recorded and raised with the owner, not fixed in passing.

**Out of scope.**
- Testing hooks themselves (jsdom, `@testing-library/react`).
- `useExitFade`, whose few lines are React state.
- The hooks that only wire events, lifecycles and the DOM: `useWindowEvent`, `useEditors`, `useOutlineFocusReturn`, `useViewMemory`, `useContextMenu`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The update check's rules are in a pure function in src/lib, and unit tests cover each rule in the description: the manual press during a launch check, the outcome per trigger, the superseded offer dropped at check start, a confirmation's preconditions, and a relaunch failure reported as installed
- [ ] #2 useFileTree's expand order and its refresh selection are pure functions in src/lib with unit tests
- [ ] #3 useMenuBody's focus target on open is a pure function in src/lib with unit tests, covering no checked item and an empty list
- [ ] #4 The three hooks call those functions and keep only their Tauri, React and DOM wiring, with no rule changed on the way
- [ ] #5 Checked in pnpm tauri dev: expanding and refreshing the explorer after a file change, opening each toolbar menu from the keyboard, and Check for Updates from Settings
- [ ] #6 AGENTS.md and AGENTS.ja.md describe the lib modules whose role widened
- [ ] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
