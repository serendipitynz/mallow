---
id: TASK-37
title: Let the explorer pane be hidden and shown
status: To Do
assignee: []
created_date: '2026-09-16 00:39'
labels:
  - feature
milestone: m-4
dependencies: []
priority: medium
type: feature
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The explorer pane cannot be hidden. On a wide document — the 9-column table that
raised TASK-34 and TASK-35 — it holds width the document could use, and a reader
who has chosen a file does not need the tree until they choose another.

`explorerWidth` and `explorerSide` are already settings (`lib/settings.ts`),
read and written through `saveSetting` and propagated to every window by
`commit_setting`. This is a third preference beside them, not a new mechanism.

**It is the other half of what makes a wide document readable**, so its effect is
measured against the same fixture as TASK-35 rather than on its own.

## What is not obvious

- **Hiding must not lose the width.** The reader's chosen `explorerWidth` has to
  survive the round trip, so "hidden" is its own state rather than a width of 0.
- **The empty state has to stay reachable.** With no folder open, the explorer is
  where `Open Folder` and the in-app Recent Folders list live. Hidden plus no
  folder must not be a dead end.
- **A chord has to be registered even where it does nothing.** `lib/print` and
  `lib/close-window` both record the same measured lesson: registering no
  handler does not make a chord inert, it concedes the chord to the platform.
- **A menu entry is a decision, not a line.** `menu.rs` composes per platform and
  has File, Edit, Window (macOS) and Help. There is no View menu, so adding one
  changes three compositions, and on Linux muda silently skips predefined kinds
  it does not support. Settle whether this gets an entry before building one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The explorer can be hidden and shown, and the document area takes the freed width — which is the other half of what makes a wide document readable, so it is measured against the same wide-table fixture as TASK-35
- [ ] #2 The state is persisted through lib/settings and propagated to every window by commit_setting, like explorerWidth and explorerSide beside it — a preference is app-wide (TASK-12.8, TASK-33) and this is not the place to introduce a per-window one
- [ ] #3 Hiding does not lose the width: showing it again restores the width the reader had set, rather than resetting to the default
- [ ] #4 There is a keyboard chord, and it is registered app-wide through lib/chord like the others — registering nothing concedes a chord to the platform, which is measured (Ctrl+P on WebView2, Ctrl+W on WebView2)
- [ ] #5 Whether it also gets a menu entry is settled explicitly: menu.rs has no View menu today, so adding one is a composition change on three platforms and a decision, not a line
- [ ] #6 The empty state still has a way back: with no folder open and the explorer hidden, Open Folder and the in-app Recent Folders list must remain reachable
- [ ] #7 Every new string is added to both the ja and en dictionaries in lib/i18n.tsx; pnpm build and pnpm test pass
<!-- AC:END -->
