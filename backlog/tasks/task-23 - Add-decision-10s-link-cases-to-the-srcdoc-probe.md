---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: In Review
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-23 10:27'
labels:
  - bug
milestone: m-2
dependencies: []
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-10 asks for this and no task owned it. The probe clicked external links only, which is exactly why a '#' link's behaviour reached a user rather than a fixture: decision-9 had inferred those links were inert, TASK-5.2's visual round found the frame navigates to the app's own URL and goes blank, and the probe had nothing to say either way.

Four cases, and they are four rather than one because each is closed by a different mechanism and can therefore fail on its own. A click is stopped by pointer-events: none; keyboard activation is stopped by tabindex="-1"; an <area>'s hit region belongs to the <img usemap> rather than to the area, so whether a UA consults the area's pointer-events for it is engine-dependent and unmeasured; and a meta refresh resolves against the same base URL but was watched on one engine only.

Two more cases joined in TASK-5.3's review rounds, both because a count had to stay silent where the answer differs by platform. The first is an external-protocol scheme. counts.links was narrowed to the hrefs whose fate is settled - app-origin, which decision-10 neutralizes, and http(s), which frame-src refuses - because a mailto: is covered by neither argument and nothing has measured whether a sandboxed frame hands one to the OS. Until it is measured, the notice bar's "links do nothing" statement cannot be about it.

The second is a protocol-relative image. It resolves against the parent's base URL, so the same reference is tauri://host/x.png on macOS and Linux, which img-src does not carry, and http://host/x.png on Windows, which it does. refTally counts it as nothing rather than being wrong on one platform, and a broken image announces itself, so nothing is silently unexplained - but the count cannot become honest without the measurement.

Raised during TASK-5.3, 2026-08-19. Not in m-1: the probe is a development instrument, so nothing here changes what a v0.6.0 reader receives. The failure it would catch is real, though - if pointer-events does not reach an area's region, a mapped region clicked on WebKit blanks the rendered view, which is the failure decision-10 removed for <a>.

The instrument and how to run it are in src/probe/README.md; the existing click measurement in src/probe/Probe.tsx is the shape to follow, including its positive control (a custom event the parent dispatches), without which a click that never arrives and a listener that never runs read alike.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A real mouse click on a '#' link and on a relative link inside the frame is measured, with the parent scroller's scrollTop and the frame's location recorded as the readings
- [ ] #2 A link reached by keyboard and activated with Enter is measured separately, since that path is closed by tabindex=-1 and not by pointer-events
- [ ] #3 An <area href> inside an <img usemap> is clicked for real, which settles whether pointer-events reaches a hit region the area does not own
- [ ] #4 A <meta http-equiv=refresh> is watched on all three WebViews, rather than on the one TASK-5.1's visual round covered
- [ ] #5 A mailto: and a tel: link are clicked for real, since neither decision-9's frame-src argument nor decision-10's neutralization covers an external-protocol scheme, and counts.links excludes them for exactly that reason
- [ ] #6 A protocol-relative image reference is watched on all three WebViews and the answer recorded per platform, since a srcdoc document's base URL makes it tauri://host/x.png on macOS and Linux and http://host/x.png on Windows - one of which img-src carries and the other does not, so refTally counts it as nothing rather than being wrong on one of them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The instrument is built and has had one round on two of the three WebViews. No
acceptance criterion is ticked yet; what follows is what that round settled, what
it did not, and why the instrument changed before the next one.

## Round 1 — Windows (WebView2 151.0.0.0) and Linux (WebKitGTK, Version/60.5)

Reports in `_sandbox/handoff/task-23/`. Both runs were valid: the app-origin
script ran in the parent and a CSP was in force on each.

**Settled on both engines, machine-side:**

- **AC #1's premise reproduced.** Raw, a `#` link and a relative link each
  navigate the frame to the app's own URL and the fixture is gone —
  `http://tauri.localhost/#deep-anchor` and
  `http://tauri.localhost/probe-app-origin-target.html` on WebView2,
  `tauri://localhost#deep-anchor` and
  `tauri://localhost/probe-app-origin-target.html` on WebKitGTK. The parent
  scroller's `scrollTop` was 0 across the navigation on both, so the fragment did
  not scroll the parent either.
- **AC #4 passes on both.** An app-origin `<meta http-equiv=refresh>` did not
  navigate the frame, which extends what decision-10 had from one engine.
- **AC #6 splits exactly as predicted, and each half is recorded.**
  `//probe.invalid/protocol-relative.png` resolved to
  `http://probe.invalid/…` on WebView2, where `img-src` carries `http:` and no
  violation was reported (PASS), and to `tauri://probe.invalid/…` on WebKitGTK,
  where `img-src` carries no `tauri:`. The WebKitGTK verdict is INCONCLUSIVE
  rather than PASS because that engine reports no violation inside a `srcdoc`
  frame at all — the section's own control says so — so only the resolved URL is
  evidence there. That is the half `refTally` would have to be keyed on, and it
  is the half that is now measured.
- decision-9's listener claim held again: the parent-dispatched control event
  arrived 8 and 5 times on WebView2 and 0 and 0 times on WebKitGTK.

**Not settled, and the round could not settle them.** Every hand-recorded field
came back `(not recorded)`, so AC #2, #3 and #5 have no attribution. On WebView2
the click counters allow a correspondence — three external-protocol clicks
against exactly three readings where `contentDocument` became unreadable, and in
the neutralized arm `area-link` heard a click while the `<a>` clicks fell through
to the body and the frame then navigated — which points at `pointer-events: none`
not reaching an image-map region. **That is a correspondence between counts, not
a measurement, and it is not recorded as one.** On WebKitGTK not even that is
available: the counters are 0 by construction there. macOS has not been run.

## What changed before round 2

The round exposed two defects in the instrument, both mine, and both meaning a
re-run was needed regardless of whether the fields were filled in.

- **The `<area>` and the relative link shared a destination**, so a navigation to
  it could not name its cause — `<a>` and `<area>` both reach it, and on WebKit
  there is no counter to break the tie. The area now has `AREA_TARGET` of its
  own.
- **Attribution rested on hand-recorded fields alone.** It now rests on the arm:
  an `about to` selector names the attempt before the click, every reading is
  filed under it, and the fields keep only what the machine cannot see — whether
  an external application opened, whether the page went blank or showed an error.
  This is what makes an engine with dead listeners readable at all, since there
  an arm in which nothing navigated and an arm in which nothing was clicked
  produce the same readings.

## Still to do

One built probe run per WebView with the attempts named — macOS (WKWebView),
Windows (WebView2), Linux (WebKitGTK). AC #4 and #6 have their answers on two of
the three and need only macOS; AC #1 needs macOS and its hand-recorded outcomes;
AC #2, #3 and #5 need all three again.

Nothing here ships in an ordinary build: the probe is behind `MALLOW_PROBE=1`.
The exception is the `neutralizeAppOriginLinks` extraction, which is
behaviour-identical and covered by `pnpm build` / `pnpm lint` / `pnpm test`.
<!-- SECTION:NOTES:END -->
