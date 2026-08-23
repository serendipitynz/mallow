---
id: TASK-25
title: Stop an image map navigating the rendered frame away
status: To Do
assignee: []
created_date: '2026-08-23 22:17'
updated_date: '2026-08-23 22:17'
labels:
  - bug
milestone: m-2
dependencies: []
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An `<area href>` inside an `<img usemap>` navigates the rendered frame to the app's own URL on all three WebViews, which blanks the rendered view with no way back inside it - the failure decision-10 removed for `<a>` and listed for `<area>` as unmeasured. TASK-23's round 3 measured it (2026-08-24, one built probe run per engine, `_sandbox/handoff/task-23/task-23-rev3-*.md`).

It reaches the same end by a different route on each branch, so neither half of decision-10 covers it and one fix will not do both.

Where the frame runs no parent-registered listener (WKWebView, WebKitGTK), `neutralizeAppOriginLinks` does select `area[href]` and does set both attributes on it. `tabindex="-1"` works - the genuine keyboard arms navigated nothing on any engine. `pointer-events: none` does not: the region belongs to the `<img usemap>` rather than to the area, and the click reached the area and navigated anyway. Measured twice on WKWebView under correctly-labelled arms, and on WebKitGTK.

Where listeners do run (WebView2), the pass is never applied - and `HtmlView`'s click handler matches `closest('a[href]')`, which an `<area>` is not, so nothing calls `preventDefault` and the click navigates. The click counters, alive on that engine, recorded `area-link=2` against exactly two navigations to the area's own destination.

decision-10's reason for keeping the `href` does not carry over to `<area>`, which is worth saying because it is what makes the two halves different rather than one problem in two places: `<a>` keeps its `href` so `:link` still matches and the document keeps its own styling, and an `<area>` has no rendered box at all, so nothing about it is styled and nothing is lost by removing it. The listener branch is separately a one-selector question.

Rare in what this view opens, which is why decision-10 made it a probe case rather than a blocker; it is now measured rather than expected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An <area href> clicked for real inside a rendered document does not navigate the frame, on all three WebViews
- [ ] #2 The branch where parent-registered listeners run is covered as well as the branch where they do not, since the click reaches the frame by a different route on each and neither of decision-10's halves covers both
- [ ] #3 The keyboard path stays closed, which tabindex=-1 already does - the fix must not be a rewrite that drops it
- [ ] #4 The probe's neutralized area-click arm is re-run on all three WebViews and navigates nothing
<!-- AC:END -->
