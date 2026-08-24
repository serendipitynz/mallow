---
id: TASK-25
title: Stop an image map navigating the rendered frame away
status: In Review
assignee: []
created_date: '2026-08-23 22:17'
updated_date: '2026-08-24 00:40'
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
- [x] #2 The branch where parent-registered listeners run is covered as well as the branch where they do not, since the click reaches the frame by a different route on each and neither of decision-10's halves covers both
- [x] #3 The keyboard path stays closed, which tabindex=-1 already does - the fix must not be a rewrite that drops it
- [ ] #4 The probe's neutralized area-click arm is re-run on all three WebViews and navigates nothing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What was changed and where

**One pass, placed before the branch, plus the count that becomes honest once it
is there.** `neutralizeAppOriginAreas` in `src/lib/html-doc.ts` removes the
`href` from every app-origin `<area href>` and writes `tabindex="-1"` on it;
`transformHtmlDocument` calls it, so the `href` is gone before the frame ever
loads. `neutralizeAppOriginLinks` now selects `a[href]` only, and `HtmlView`'s
click handler still matches `a[href]` only. `counts.links` counts
`a[href], area[href]`.

The probe's `neutralized` arm applies both passes (`src/probe/link-checks.ts`),
and gained one counter — `hrefs still on an <area>` — read after the mode is
applied. On the two WebKit engines the click counters are 0 by construction, so
without it "the region navigated nothing" and "the region was never clicked"
would rest on the declared attempt alone. Its click-attribution key now names a
target that has an id but is not a link, because an `href`-less area puts the
click on the `<img usemap>` beneath it, which keyed on links alone read as
`(not a link)` — the same entry a click that missed the map produces.

## Why the href is removed rather than the click suppressed

decision-10 rejected removing an `<a>`'s `href` because `:link` stops matching
and the document loses its own link styling. **That reason does not reach an
`<area>`**, which has no box of its own: nothing about it is styled, so nothing
is lost. With no `href` it is not a hyperlink at all, so the click falls through
to the image and the keyboard has no link to reach. `tabindex="-1"` is still
written — it is the half TASK-23 measured as working, and this replaces one
mechanism, not both (AC #3).

## Why one pass before the branch rather than one per branch

The task described two routes and called the listener branch "a one-selector
question". Both routes are closed here by removing the destination instead, and
the placement is the reason (AC #2):

1. **The probe would otherwise measure the branch the engine happens to take.**
   `src/probe/link-checks.ts` arms the app's own functions rather than a copy. A
   fix living half in the pass and half in `HtmlView`'s handler leaves the
   neutralized arm on WebView2 measuring a pass that engine never applies — a
   green record for a path that does not ship there. AC #4 asks for that arm on
   all three, so the mechanism has to be the same one on all three.
2. **It closes the keyboard path on WebView2, where nothing closed it.** The
   pass never runs there, so an app-origin `<area>` was reachable by Tab and
   activated by Enter through the same handler that missed its click.
3. **Widening `HtmlView`'s selector to `area[href]` was considered and left
   out.** With the `href` gone there is nothing left for the handler to cancel,
   and adding it would newly hand a mapped `http(s)` region to the OS browser on
   WebView2 alone — a capability rather than this fix, and one that would make
   `counts.links` wrong on a platform.

## `counts.links` and the notice bar

`area[href]` is in the count now, on the same two classes as `<a>`: the
app-origin half is settled by this pass on every engine, and the `http(s)` half
by decision-9's argument, since `frame-src` answers for the destination and not
for the element that asked. `mailto:` / `tel:` stay out, unchanged. The notice
line only appears where no parent listener runs, so the number it carries is
still one the bar can account for.

## Records updated

decision-10 gained an amendment section (its body left as written, since the
consequence it recorded is what happened). AGENTS.md and AGENTS.ja.md: the
transform's removal list now names the one attribute it drops, the link
paragraph carries the fix and why the two selectors stay narrow, and the
`counts.links` paragraph no longer excludes `area[href]`. README.md and
README.ja.md tell the reader an image map does nothing on *every* platform,
which is the one thing here that could otherwise read as a fault. `src/probe/`
README and screen text say which counter to read beside the click.

## Verification

`biome ci` 90 files, 0 errors. `vitest run` 17 files / 247 tests pass. `tsc` and
`vite build` clean. `cargo fmt --check`, `cargo check`, `cargo test` (18) pass —
no Rust changed.

**No unit test covers the new pass, by the same rule the rest of the mutate half
follows.** `lib/html-doc`'s header states the split: strings and `DocNodeLike`
are unit-tested, the mutate-and-serialize half runs against a real DOM and is
checked in the probe. A fake `querySelectorAll` would decide the very selection
under test. `navigatesAppOrigin`, the predicate this pass reads, is already
covered.

**AC #1 and AC #4 need the probe run and are not checked here** — three engines,
the `area-click` arm in both modes. AC #2 and AC #3 are structural and closed by
the code above.
<!-- SECTION:NOTES:END -->
