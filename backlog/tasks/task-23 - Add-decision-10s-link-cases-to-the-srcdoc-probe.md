---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: In Review
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-23 22:18'
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
- [x] #2 A link reached by keyboard and activated with Enter is measured separately, since that path is closed by tabindex=-1 and not by pointer-events
- [x] #3 An <area href> inside an <img usemap> is clicked for real, which settles whether pointer-events reaches a hit region the area does not own
- [x] #4 A <meta http-equiv=refresh> is watched on all three WebViews, rather than on the one TASK-5.1's visual round covered
- [x] #5 A mailto: and a tel: link are clicked for real, since neither decision-9's frame-src argument nor decision-10's neutralization covers an external-protocol scheme, and counts.links excludes them for exactly that reason
- [x] #6 A protocol-relative image reference is watched on all three WebViews and the answer recorded per platform, since a srcdoc document's base URL makes it tauri://host/x.png on macOS and Linux and http://host/x.png on Windows - one of which img-src carries and the other does not, so refTally counts it as nothing rather than being wrong on one of them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Six criteria, all measured on all three WebViews across three rounds. Reports in
`_sandbox/handoff/task-23/`; every run passed both positive controls. **Round 3
found a real defect, raised as TASK-25.**

## What the instrument had to learn first (rounds 1 and 2)

Round 1 answered the two automatic cases on WebView2 and otherwise exposed two
defects in the probe. The `<area>` and the relative link shared a destination, so
a navigation could not name its cause; and attribution rested on hand-recorded
fields, which came back blank. On an engine that runs no parent-registered
listener the click counters are 0 whatever happened (decision-9), so an arm in
which nothing navigated and an arm in which nothing was clicked produce identical
readings — there is nothing to fall back on there. Round 2 fixed both: the area
got its own destination, and the operator names the attempt before arming.

Round 2 then ended with the neutralized half unarmed on all three, as round 1 had.
So the section was changed a third time to state which attempts each mode still
owes, on screen and in the report: a record that lists only what was done reads as
complete either way.

**Both instrument fixes earned their keep in round 3.** Several arms there carry a
label that does not match what was evidently clicked — a navigation to the area's
own destination under an arm labelled `fragment-click` on WebKitGTK, and under
`fragment-keyboard` twice on WebView2. Only the `<area>` points at that URL, so
the destination named the cause regardless of the label, which is exactly what
splitting the two destinations was for.

## The measured answers

**AC #1.** A `#` link and a relative link each navigate the frame to the app's own
URL, on all three, with the parent scroller unmoved across every one of them:
`http://tauri.localhost/#deep-anchor` and `…/probe-app-origin-target.html` on
WebView2, `tauri://localhost#deep-anchor` and `…/probe-app-origin-target.html` on
both WebKit engines. decision-9 inferred these were inert; they are not.

**AC #2.** Measured raw and neutralized, separately from the click. Raw, the `#`
link reached by Tab and activated with Enter navigates the frame on all three.
Neutralized, it navigates on none — `tabindex="-1"` closes the keyboard path
everywhere, which is the half decision-10 was certain of and is now measured.

**AC #3, and this is the defect.** Raw, an image-map region clicked for real
navigates the frame on all three (`…/probe-area-target.html`). Neutralized, it
still does — on all three, by two different routes. Where no parent-registered
listener runs, the pass sets both attributes on the `<area>` and only
`tabindex="-1"` takes: `pointer-events: none` does not reach a hit region the area
does not own, which is the engine-dependent question decision-10 declined to
answer and listed here. Where listeners do run (WebView2, control event 10 times
against 0 on each WebKit engine), the pass is never applied and `HtmlView`'s
handler matches `closest('a[href]')`, which an `<area>` is not — so nothing
prevents it. Both are TASK-25.

**AC #4.** An app-origin `<meta http-equiv=refresh>` navigated the frame on none
of the three. decision-10 had this from one engine.

**AC #5.** Clicked for real on all three, with the OS-side half recorded by hand.
No mail or phone application was handed anything on any platform. The frame-side
reading splits: on WebView2 the frame goes to a document the parent cannot read
and shows blank, on both WebKit engines nothing observable happens at all. Note
which way that falls — WebView2 is where the app's own click handler runs and
calls `preventDefault`, so the app never reaches it there, and the engines where
nothing can `preventDefault` are the engines where the click does nothing. So a
sandboxed frame hands an external-protocol scheme to nobody, and `counts.links`
excluding them is now a measured position rather than a placeholder. **Whether to
start counting them is decision-10's to take, not this task's.**

**AC #6.** Resolved to `http://probe.invalid/…` on WebView2, where `img-src`
carries `http:` and no violation was reported, and to `tauri://probe.invalid/…` on
both WebKit engines, where it carries no `tauri:`. Neither WebKit engine reports a
violation inside a `srcdoc` frame at all — the section's own control says so — so
those two are inconclusive on the event and recorded on the resolved URL, the half
`refTally` would have to be keyed on. The split the criterion predicted is what
was measured.

## Scope

Nothing here ships in an ordinary build: the probe is behind `MALLOW_PROBE=1`. The
exception is the `neutralizeAppOriginLinks` extraction, which is
behaviour-identical and covered by `pnpm build` / `pnpm lint` / `pnpm test`. The
defect AC #3 found is measured here and fixed in TASK-25, so that fix arrives with
its own before-and-after rather than inside the task that built the instrument.
<!-- SECTION:NOTES:END -->
