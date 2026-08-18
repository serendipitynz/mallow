---
id: TASK-20
title: Offset heading jumps and the scroll spy past the sticky document bar
status: Done
assignee: []
created_date: '2026-08-18 06:46'
updated_date: '2026-08-18 09:45'
labels:
  - bug
milestone: m-1
dependencies:
  - TASK-8
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bug, found during TASK-8's visual check on 2026-08-18. It predates TASK-8 - `git log -S` puts both halves in the initial commit `0c79469`, and TASK-8 changed no stylesheet - so it is not a regression from the seam.

`.doc__bar` is `position: sticky; top: 0` inside the `.doc` scroller (`styles/markdown.scss`), and every text view renders one. Its height is already a layout constant, `$doc-bar-height` in `_vars.scss` (`$doc-pad-top + 42px` = 62px), and the sticky outline and the sticky table header both offset themselves by it.

Two offsets do not. Markdown headings carry `scroll-margin-top: 1.5rem` (24px), which is what `scrollIntoView({ block: 'start' })` honours, so an Outline click lands the heading 38px behind the bar - on a heading that wraps to two lines the first line is simply not there. `Outline`'s `SPY_OFFSET_REM` is the same 1.5rem, so the spy also marks a heading current while it is still behind the bar.

Fix both from ONE inset, and take that inset from the rendered bar rather than from `$doc-bar-height`: the variable's own comment calls the 42px an approximation of the toggle row, and this is the repo's standing rule that a position needed at runtime is measured on the laid-out element, never computed from the declared CSS. `MarkdownView` renders the bar, so it is what can measure it (ref + `useLayoutEffect`, not state).

The jump half is CSS and the spy half is TypeScript, so the measured value has to reach both - a custom property on the `.doc` element for `scroll-margin-top`, and a prop for the spy. Keep `$doc-bar-height` as the CSS fallback: that is what makes a first paint before measurement land roughly right instead of at 0.

Use the same total for both, so a jumped-to heading is current on arrival rather than one pixel short of it.

Out of scope: the other three views' bars. None of them has headings, a scroll spy or fragment links, so nothing there is mispositioned, and `$doc-bar-height`'s existing two users stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An Outline click leaves the target heading fully visible below the document bar, not behind it
- [x] #2 An in-document fragment link (a Markdown [x](#slug)) lands in the same place as an Outline click
- [x] #3 The scroll spy marks a heading current only once it has cleared the bar, so the jumped-to heading is current on arrival
- [x] #4 The inset comes from the rendered bar, not from a CSS value copied into TypeScript, and one source feeds both the jump and the spy
- [x] #5 A view with no bar is unaffected, and pnpm build, pnpm test and pnpm lint pass
<!-- AC:END -->
