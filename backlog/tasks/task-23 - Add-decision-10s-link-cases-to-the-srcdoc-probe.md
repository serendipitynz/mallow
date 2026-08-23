---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: In Review
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-23 12:41'
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
- [x] #4 A <meta http-equiv=refresh> is watched on all three WebViews, rather than on the one TASK-5.1's visual round covered
- [ ] #5 A mailto: and a tel: link are clicked for real, since neither decision-9's frame-src argument nor decision-10's neutralization covers an external-protocol scheme, and counts.links excludes them for exactly that reason
- [x] #6 A protocol-relative image reference is watched on all three WebViews and the answer recorded per platform, since a srcdoc document's base URL makes it tauri://host/x.png on macOS and Linux and http://host/x.png on Windows - one of which img-src carries and the other does not, so refTally counts it as nothing rather than being wrong on one of them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The instrument is built and has had two rounds. AC #4 and #6 are ticked on three
engines; the rest are named below with what is still owed.

## Round 1 — Windows, Linux (2026-08-23)

Exposed two defects in the instrument rather than answering much: the `<area>`
and the relative link shared a destination, so a navigation could not name its
cause, and attribution rested on hand-recorded fields that came back blank. On an
engine that runs no parent-registered listener the click counters are 0 whatever
happened (decision-9), so an arm in which nothing navigated and an arm in which
nothing was clicked produce identical readings. Both were fixed before round 2:
the area has its own destination, and the operator names the attempt before
arming, so every reading is filed under it.

Round 1 did settle the two automatic cases on Windows (WebView2 151.0.0.0), and
those checks were untouched by the fixes, so they stand.

## Round 2 — macOS (WKWebView), Linux (WebKitGTK Version/60.5), 2026-08-24

Reports in `_sandbox/handoff/task-23/`. Both runs valid. Windows's round-2 report
came back empty and is still owed.

**Attribution worked.** All six raw attempts read one-to-one on both engines, and
both engines answered identically:

- `#` link clicked → the frame navigates to `tauri://localhost#deep-anchor` and
  the fixture is gone. decision-10's measured behaviour, reproduced.
- relative link clicked → `tauri://localhost/probe-app-origin-target.html`.
- **`<area>` clicked → `tauri://localhost/probe-area-target.html`.** This is AC
  #3's positive control, and it is what the shared destination had made
  unreadable in round 1: an image-map region does navigate the frame when nothing
  is applied.
- **`#` link reached by Tab and activated with Enter → it navigates.** AC #2's
  positive control: the keyboard path is live, so `tabindex="-1"` has something to
  close.
- `mailto:` and `tel:` clicked → no change on the frame side at all, on either
  engine. Not an answer to AC #5, which asks whether the OS handler was reached —
  that is not visible from script and the hand-recorded fields are still blank.
- The parent-dispatched control event arrived 0 times in every arm, confirming
  again that neither WebKit engine runs a parent-registered listener. **So
  neutralization is the branch the app actually takes on both**, which is what
  makes the gap below the important one.

**AC #4 — ticked.** An app-origin `<meta http-equiv=refresh>` did not navigate the
frame on WebView2, WKWebView or WebKitGTK. decision-10 had this from one engine
and asked for three.

**AC #6 — ticked.** The reference resolved to `http://probe.invalid/…` on
WebView2, where `img-src` carries `http:` and no violation was reported, and to
`tauri://probe.invalid/…` on WKWebView and WebKitGTK, where `img-src` carries no
`tauri:`. Both WebKit engines report no violation inside a `srcdoc` frame at all —
the section's own control says so — so those two verdicts are INCONCLUSIVE on the
event and recorded on the resolved URL, which is the half `refTally` would have to
be keyed on. The criterion asked for the answer per platform, and the split it
predicted is what was measured.

## Still owed

- **The neutralized half, on all three engines.** Rounds 1 and 2 both ended with
  it unarmed. Every raw control it needs now exists, so arming
  `fragment-click`, `relative-click`, `area-click` and `fragment-keyboard` under
  the pass closes AC #2 and AC #3. `mailto:`/`tel:` are not in that set — the pass
  does not touch a scheme the OS owns.
- **AC #5's hand-recorded half**, on all three: whether a mail or phone handler
  opened. The frame-side reading is "nothing happened", and nothing in script can
  see the rest.
- **AC #1 on Windows**, as a clean per-attempt record. Round 1 has the two
  navigations but attributes them through the click counters rather than through
  the arm, and round 2's Windows report is empty.
- A third instrument change went in after round 2: the section now states which
  attempts each mode still owes, on screen and in the report. A record that lists
  only what was done reads as complete either way, which is how the same half went
  missing twice.

Nothing here ships in an ordinary build: the probe is behind `MALLOW_PROBE=1`. The
exception is the `neutralizeAppOriginLinks` extraction, which is
behaviour-identical and covered by `pnpm build` / `pnpm lint` / `pnpm test`.
<!-- SECTION:NOTES:END -->
