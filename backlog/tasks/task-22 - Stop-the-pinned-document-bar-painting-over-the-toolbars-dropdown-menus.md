---
id: TASK-22
title: Stop the pinned document bar painting over the toolbar's dropdown menus
status: To Do
assignee: []
created_date: '2026-08-18 11:57'
updated_date: '2026-08-19 20:49'
labels:
  - bug
milestone: m-2
dependencies: []
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The theme picker's dropdown is sometimes drawn under the pinned document bar (.doc__bar), so the top of the menu is covered by the bar's frosted band and by whatever buttons sit in it. Reproduced on macOS with a markdown document open and with an HTML one, and it is intermittent - the same menu on the same document renders correctly on another opening.

By the numbers it should not happen: .menu__popup carries z-index 50 (src/styles/app.scss) and .doc__bar carries 5 (src/styles/markdown.scss), and .menu is position: relative with no z-index, so it opens no stacking context of its own and the two compete directly. The likely cause is .doc__bar's backdrop-filter: blur(10px), which makes the bar its own compositing layer and, on WebKit, can paint that layer above later-painted content regardless of the declared order - the ghost of the bar's content visible through the menu's top edge is consistent with that reading. That is a hypothesis, not a measurement.

Predates the HTML rendered view: .doc__bar is shared by the markdown, config, table, xml and html views, and TASK-5.1 added no stacking declaration. Found during TASK-5.1's visual round, 2026-08-18.

The obvious fix is to give the toolbar a stacking context above the bar rather than to raise the bar's z-index, since the bar has to stay above the document it pins over. Whatever is done, the intermittency is what makes this hard to close: a fix confirmed once is not confirmed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The failure is reproduced before anything is changed, and what makes it intermittent is written down rather than left as 'sometimes'
- [ ] #2 A toolbar dropdown opens above the pinned document bar in every view that has one: markdown, config, table, xml and html
- [ ] #3 The fix is stated with its mechanism in the SCSS at the declaration that carries it, so the next person does not re-derive why the z-index numbers alone were not enough
<!-- AC:END -->
