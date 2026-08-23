---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: In Review
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-23 12:53'
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
- [x] #1 A real mouse click on a '#' link and on a relative link inside the frame is measured, with the parent scroller's scrollTop and the frame's location recorded as the readings
- [ ] #2 A link reached by keyboard and activated with Enter is measured separately, since that path is closed by tabindex=-1 and not by pointer-events
- [ ] #3 An <area href> inside an <img usemap> is clicked for real, which settles whether pointer-events reaches a hit region the area does not own
- [x] #4 A <meta http-equiv=refresh> is watched on all three WebViews, rather than on the one TASK-5.1's visual round covered
- [ ] #5 A mailto: and a tel: link are clicked for real, since neither decision-9's frame-src argument nor decision-10's neutralization covers an external-protocol scheme, and counts.links excludes them for exactly that reason
- [x] #6 A protocol-relative image reference is watched on all three WebViews and the answer recorded per platform, since a srcdoc document's base URL makes it tauri://host/x.png on macOS and Linux and http://host/x.png on Windows - one of which img-src carries and the other does not, so refTally counts it as nothing rather than being wrong on one of them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The instrument is built and has had two rounds. AC #1, #4 and #6 are ticked on
three engines. What #2, #3 and #5 still owe is named at the end.

## Round 1 — Windows, Linux (2026-08-23)

Answered the two automatic cases on WebView2 and otherwise exposed two defects in
the instrument: the `<area>` and the relative link shared a destination, so a
navigation could not name its cause, and attribution rested on hand-recorded
fields that came back blank. On an engine that runs no parent-registered listener
the click counters are 0 whatever happened (decision-9), so an arm in which
nothing navigated and an arm in which nothing was clicked produce identical
readings. Both were fixed before round 2 — the area has its own destination, and
the operator names the attempt before arming, so every reading is filed under it.
The automatic checks were untouched by those fixes, so round 1's WebView2 answers
stand.

## Round 2 — all three engines (2026-08-23/24)

Reports in `_sandbox/handoff/task-23/`: WebView2 151.0.0.0, WKWebView (macOS),
WebKitGTK Version/60.5. All three runs valid, and every raw attempt reads
one-to-one against its arm.

**AC #1 — ticked.** A `#` link and a relative link each navigate the frame to the
app's own URL and the fixture is gone, on all three:
`http://tauri.localhost/#deep-anchor` and `…/probe-app-origin-target.html` on
WebView2, `tauri://localhost#deep-anchor` and `…/probe-app-origin-target.html` on
both WebKit engines. The parent scroller's `scrollTop` did not move across any of
those navigations, so the fragment does not scroll the parent either.
decision-10's measured behaviour, reproduced everywhere rather than on the one
engine it had.

**AC #4 — ticked.** An app-origin `<meta http-equiv=refresh>` navigated the frame
on none of the three.

**AC #6 — ticked.** Resolved to `http://probe.invalid/…` on WebView2, where
`img-src` carries `http:` and no violation was reported, and to
`tauri://probe.invalid/…` on both WebKit engines, where it carries no `tauri:`.
Neither WebKit engine reports a violation inside a `srcdoc` frame at all — the
section's own control says so — so those two are inconclusive on the event and
recorded on the resolved URL, which is the half `refTally` would have to be keyed
on. The split the criterion predicted is what was measured.

**Positive controls that AC #2 and #3 lacked now exist on all three.** An
image-map region clicked for real navigates the frame
(`…/probe-area-target.html`), and the `#` link reached by Tab and activated with
Enter navigates it too. So both mechanisms have something to close, and a
neutralized arm that does nothing will not be vacuous.

**AC #5 has a machine-side answer, and it splits — but not the half the criterion
needs.** Clicking `mailto:` or `tel:` takes WebView2's frame to a document the
parent cannot read and the fixture is gone; on both WebKit engines nothing
observable happens to the frame at all. Note which way round that falls: WebView2
runs parent-registered listeners (the control event arrived 7 times, against 0 on
each WebKit engine), so there the app's own click handler calls `preventDefault`
and the app never sees this; the engines where nothing can `preventDefault` are
the engines where the click does nothing to the frame. **Whether the OS handler
was reached is still unmeasured** — it is not visible from script, and that is the
half the notice bar's "links do nothing" claim would have to rest on.

## Still owed

- **The neutralized half, on all three engines.** Both rounds ended with it
  unarmed. Arming `fragment-click`, `relative-click`, `area-click` and
  `fragment-keyboard` under the pass closes AC #2 and AC #3, and every control
  they need is now on record. `mailto:`/`tel:` are deliberately not in that set —
  the pass does not touch a scheme the OS owns.
- **AC #5's hand-recorded half**, on all three: whether a mail or phone handler
  opened.
- After round 2 the section was changed a third time: it now states which attempts
  each mode still owes, on screen and in the report. A record listing only what was
  done reads as complete either way, which is how the same half went missing twice.

Nothing here ships in an ordinary build: the probe is behind `MALLOW_PROBE=1`. The
exception is the `neutralizeAppOriginLinks` extraction, which is
behaviour-identical and covered by `pnpm build` / `pnpm lint` / `pnpm test`.
<!-- SECTION:NOTES:END -->
