---
id: TASK-23
title: Add decision-10's link cases to the srcdoc probe
status: In Review
assignee: []
created_date: '2026-08-19 00:19'
updated_date: '2026-08-23 07:29'
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
The instrument is built; no acceptance criterion is checked, because every one of
them is a measurement and this task delivered the thing that takes it. What
exists now, per AC:

- #1, #2, #3, #5 — one armed fixture (`appOriginLinkFixture`) carrying a `#`
  link, a relative link, `mailto:`, `tel:` and an `<area href>` inside an
  `<img usemap>`, armed in two modes. **raw** applies nothing; **neutralized**
  applies the app's own pass. Each reading is the frame's `location`, whether the
  fixture is still there, and the parent scroller's `scrollTop`, appended on
  change and accumulated across re-arms — a click that navigates destroys the
  fixture, so the targets are worked through one at a time.
- #4, #6 — automatic, no interaction: an app-origin `<meta http-equiv=refresh>`
  and a protocol-relative image reference.

Three things about the design are load-bearing rather than incidental.

**The neutralization pass is now a named function.** `neutralizeAppOriginLinks`
moved out of `HtmlView` into `lib/html-doc`, beside `navigatesAppOrigin`, and the
probe calls the same one. A copy in the probe would have measured the copy, and
the mechanism is what is under measurement here.

**The raw mode is what makes the neutralized mode mean anything.** An `<area>`
that does nothing when neutralized is only evidence if it did something when it
was not — which is the whole of AC #3, since an area has no box of its own and
the hit region belongs to the `<img usemap>`. The same pairing covers the
keyboard: `pointer-events` and `tabindex` close different paths, so the section
records `tabbableHrefs` as the machine-side expectation the hand-recorded
keyboard answer is checked against.

**The two automatic cases needed their own controls, and one of them changed a
fixture.** The app-origin meta refresh is aimed at a path that does not exist,
so "the frame navigated" is unambiguous without loading the app shell to read;
its delay is 1s rather than 0 because a zero-delay refresh can replace the
document before the parent has read it once, and a fixture that was never there
and one that navigated are the same absence. The protocol-relative image is
injected from the parent rather than authored, because an `<img>` in the initial
markup is fetched before any violation listener can exist — the trap
`networkFixture`'s `@font-face` comment already describes. Its reading is the
resolved URL (`tauri://probe.invalid/…` where the app origin is `tauri:`,
`http://probe.invalid/…` where it is `http:`) plus whether a violation was
reported; the load fails on every platform by design, so the load outcome says
nothing. Where the engine reports no violations inside a `srcdoc` frame the
check is `inconclusive` and the resolved URL is still recorded, because that half
is this platform's answer either way.

What is NOT done: the runs. This needs one built probe run per platform — macOS
(WKWebView), Windows (WebView2), Linux (WebKitGTK) — and the reports pasted back
here before any AC is checked. `src/probe/README.md` has the procedure; the new
section is documented there under "The app-origin link section (TASK-23)".
Nothing in this change ships in an ordinary build: the probe is behind
`MALLOW_PROBE=1`. The one exception is the `neutralizeAppOriginLinks` extraction,
which is behaviour-identical and covered by `pnpm build` / `pnpm lint` /
`pnpm test` (247 pass).
<!-- SECTION:NOTES:END -->
