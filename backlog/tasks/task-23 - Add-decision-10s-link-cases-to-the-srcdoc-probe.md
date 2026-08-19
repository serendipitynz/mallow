---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: To Do
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-19 00:20'
labels:
  - bug
dependencies: []
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-10 asks for this and no task owned it. The probe clicked external links only, which is exactly why a '#' link's behaviour reached a user rather than a fixture: decision-9 had inferred those links were inert, TASK-5.2's visual round found the frame navigates to the app's own URL and goes blank, and the probe had nothing to say either way.

Four cases, and they are four rather than one because each is closed by a different mechanism and can therefore fail on its own. A click is stopped by pointer-events: none; keyboard activation is stopped by tabindex="-1"; an <area>'s hit region belongs to the <img usemap> rather than to the area, so whether a UA consults the area's pointer-events for it is engine-dependent and unmeasured; and a meta refresh resolves against the same base URL but was watched on one engine only.

A fifth case joined in TASK-5.3's review round: an external-protocol scheme. counts.links was narrowed to the hrefs whose fate is settled - app-origin, which decision-10 neutralizes, and http(s), which frame-src refuses - because a mailto: is covered by neither argument and nothing has measured whether a sandboxed frame hands one to the OS. Until it is measured, the notice bar's "links do nothing" statement cannot be about it.

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
<!-- AC:END -->
