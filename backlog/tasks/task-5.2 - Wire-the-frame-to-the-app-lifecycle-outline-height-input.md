---
id: TASK-5.2
title: 'Wire the frame to the app: lifecycle, outline, height, input'
status: Done
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-08-19 03:55'
labels:
  - feature
milestone: m-1
dependencies:
  - TASK-5.1
  - TASK-7
  - TASK-8
parent_task_id: TASK-5
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Part 2 of 3 for TASK-5 (see decision-3). Makes the frame behave like part of the app rather than an island.

1. Respect the frame lifecycle, which everything else depends on: contentDocument is about:blank until the load event, and every srcdoc replacement builds a fresh document that loses ids, observers, any listeners and the measured height. The load event on the iframe ELEMENT does fire on all three WebViews (TASK-7), so it is safe to wait on. Fix the order - wait for load, assign heading ids, wire the parent-side observers and whatever click handling this platform supports, restore the scroll anchor, then measure the height - and re-run all of it on a live reload.
2. Give h1-h6 ids, but only where the element has none, and de-duplicate generated slugs. Overwriting an existing id breaks the document's own fragment links.
3. Drive the existing Outline through the lookup root and coordinate conversion TASK-8 built in lib/heading. Pass it a HeadingRoot whose node() returns the frame's contentDocument and whose frameOffset() returns the iframe element's getBoundingClientRect().top - both are called per lookup and per measurement rather than captured, which is what makes them survive a srcdoc swap replacing the document and the notice bar moving the frame. TASK-8 named scrollIntoView on the heading as the boundary-crossing mechanism (it honours the heading's own scroll-margin-top, which a parent-side scrollTop does not); the reason is at the call site in Outline's go. Do not add a second mechanism beside it.
4. Size the frame from the scrollHeight of contentDocument so the app scroller stays the only scroller. Two separate bounds are needed and they solve different problems:
   - A measurement-pass cap, because this is a feedback loop: a document with body { min-height: 200vh } grows every time the measured height is applied. Settle on the last stable value, and reset the counter on a width change rather than exhausting it and leaving the height stale.
   - A maximum height, as a backstop against pathological growth rather than a limit real documents are expected to meet. Set it high enough that ordinary long documents stay under it, and when it IS exceeded, fall back to the capped source view - the same landing spot as TASK-5.1's render complexity threshold.
   Do NOT let the frame become a second scroll region instead. That would break the single scrolling contract the rest of the design rests on: decision-3 requires fragment links to be scrolled by the parent and the app scroller to stay in charge, and both the native keyboard scrolling TASK-7 measured and TASK-8's boundary-crossing mechanism assume the frame has no scrollable viewport of its own. Nested scrolling would mean reopening decision-3, decision-9, TASK-8 and the fragment and keyboard criteria together as one contract; it is not an option to be taken locally here.
   Re-measure after a live reload, after late layout changes (images, details elements), and after anything that changes the frame's width: window resize, Explorer splitter drag, outline open/close. Late layout has to be OBSERVED, not listened for (decision-9): a load listener on the image inside the frame fired on none of the three WebViews, while a ResizeObserver on the frame's documentElement reported the image reflow and a MutationObserver reported the details toggle on all three. Polling is the backstop, not the mechanism.
5. Attach a click handler to contentDocument WHERE ONE RUNS. decision-9: a document with scripting disabled invokes no listener the parent registered on it, which is the case on both WebKit engines and not on WebView2, so link handling is a capability rather than a given. Detect it - dispatch an event into the frame's document from the parent and see whether the listener runs - rather than branching on a platform name, because a future WebKit release may move the boundary. Where the handler runs it cannot simply mirror MarkdownView's own click handler: that handler returns early for '#' links and lets native fragment navigation scroll, which does nothing here because a frame sized to its content has no scrollable viewport. Fragment links must be preventDefault-ed and scrolled by the parent; http(s) links go to the OS browser via openUrl; everything else is inert. Where it does not run, an http(s) link is inert - containment is unaffected, since frame-src is what stops the frame going anywhere - and TASK-5.3 has to say so in the notice bar. What a '#' link does there is NOT settled: decision-9 records it as inference, so observe a real click on one before the notice bar or the documentation states anything about it, and let the observation decide.
6. Do NOT forward keyboard scrolling. decision-3 assumed wheel events chain to the parent while keyboard events do not, and required forwarding; TASK-7 measured the opposite with focus genuinely inside the frame - the tabindex plus focus() in Outline's go, confirmed by the frame's activeElement - and PageDown moved the parent scroller on all three. Forwarding would have been a keydown listener, so it was never available on the two platforms it would have been needed for. Verify the behaviour still holds rather than building the mechanism.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ids, the measured height and any parent-side wiring are all re-established after the frame reloads, and scroll position is preserved across a live reload
- [x] #2 Headings that already carry an id keep it, generated slugs do not collide, and the document's own fragment links still resolve
- [x] #3 The outline lists the document's headings, clicking one scrolls to it, and the active-heading highlight tracks the parent scroller
- [x] #4 Frame height converges on a document whose body depends on viewport height, within a bounded number of measurements and a maximum height
- [x] #5 Height is re-measured after images and details elements change the layout, driven by an observer rather than by a listener inside the frame (decision-9)
- [x] #6 Where the frame runs parent-registered listeners, fragment links scroll the parent scroller, http(s) links open the OS browser and never navigate the app WebView, and every other scheme is inert. Where it does not, an http(s) link is inert, what a '#' link does is observed rather than assumed, and the platform difference is detected at runtime rather than read off a platform name (decision-9)
- [x] #7 After clicking an outline entry, arrow keys, Space, PageDown, Home and End still scroll the document
- [x] #8 pnpm build and pnpm test pass
- [x] #9 Height is re-measured when the frame's width changes: window resize, Explorer splitter drag, and outline open/close
- [x] #10 The measurement-pass cap resets on a width change rather than exhausting itself and leaving the height stale
- [x] #11 Content taller than the maximum frame height falls back to the capped source view, and the frame never becomes a second scroll region
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The visual round sent this back, and what it found

The first PR round shipped a sizing loop that read the document's height at a fixed reference height rather than at the height applied to the frame, on the reasoning that this removed decision-3's feedback loop. **It removed the convergence instead.** The frame's height *is* its document's viewport, so a height measured elsewhere is a height the document is not laid out at: applied, `90vh` inside resolves against a viewport the document never gets, the content ends up taller than the box holding it, and the frame becomes a scroll region of its own. `scrollIntoView` then scrolls inside the frame and the app scroller does not move — which is AC #11 broken and AC #3 with it, on any viewport-dependent document. Neither the automated checks nor four rounds of code review caught it; the visual round did, as "outline entries below the current position do not work".

`measure` now reads at the height currently applied, which is decision-3's loop verbatim and is what makes the converged value a **fixed point** — a height at which the document reports that height. Converging writes nothing at all, so the smooth-scroll aborts the earlier rounds fought are gone at the root as well. A shrink is invisible from a tall frame (`scrollHeight` is floored by it), so the causes that can shorten a document — a mutation, a width change — ask for a *restart*, which re-seeds the frame at the reader's viewport and carries the reader across on the heading anchor.

The same round observed what decision-9 had left open, and the inference was wrong: see decision-10.

## The two values decision-3 left open

Both were re-measured with the corrected loop; the values from the first round were derived from the wrong algorithm and do not stand. The scan runs this component's own loop over 3,118 `.html` / `.htm` files on one working machine, at the width the frame gets beside an open outline; 2,757 answered.

- **`MAX_FRAME_HEIGHT_PX` = 2,000,000.** The results are two populations with nothing between them: 2,753 documents settle below **525,753px** (median 1,369, p99 14,072, p99.9 82,877), and 4 run away to **33,554,432px** — the engine's own maximum element height, reached because the loop diverges and the engine stops it. The gap between the populations is a factor of 64, so the cap separates "renders" from "diverges" rather than picking a point on a distribution. **Those four are the only documents in the corpus that fall back to the source view** — the first round claimed none did, which was true only of the broken algorithm.
- **`MAX_MEASUREMENT_PASSES` = 32.** 2,727 documents reach their fixed point in one pass and 17 in more, the slowest in 20, so this clears the slowest by 1.6×. What it is really for is the **13 that never settle and do not diverge either**: they oscillate between two heights for all 40 passes the scan allowed, at ordinary sizes (1,440–13,840px). A document with no fixed point at any height is stopped by nothing but a budget, and the height cap never would, since it stays small while it cycles. The budget is spent in `scheduleMeasure` as well as in `measure`, so it bounds the work and not only the height.

## What else is load-bearing

- **Every parent-side write into the frame happens in the load pass, never in a handler.** Each is an attribute mutation the `MutationObserver` reports, and the measurement that schedules can abort a scroll in progress — so a write made while preparing a jump cancels that jump, on its first use only. Both the landing offset (on everything a fragment can address) and `tabindex="-1"` are assigned there for that reason. This came out of review rounds 1 and 2, the second because the fix for the first put a new write in the click path.
- **The scroll anchor is captured on every parent scroll**, not just before a reload: a `srcdoc` swap replaces the document asynchronously, so there is no moment the parent can rely on across three WebViews where the new markup is committed and the old document is still readable.
- **A heading inside the frame takes its landing offset from an inline style the parent copies onto it** — the parent's stylesheets do not reach into the frame's document. The value is still declared once in CSS (`scroll-margin-top` on `.html-frame`), so `Outline` reads it back off the heading and the jump and the spy cannot drift apart (TASK-20).
- **Heading id ownership is a DOM fact and arrives as a predicate.** An existing id is the heading's to keep only when the heading is the document's first holder of it; otherwise `getElementById` answers some other element and the outline jumps there. `lib/html-headings` stays free of the DOM, which is what keeps the rest of the rule testable under Node.

## The visual rounds

Two, both on macOS (WKWebView) in a built app - `pnpm tauri build --debug --no-bundle`, because there is no CSP under `pnpm tauri dev` on desktop and the link behaviour leans on it.

The first sent the task back with the two findings above. The second closed ten of the eleven criteria.

**AC #6 was closed in TASK-5.3's visual round (2026-08-19, Windows 11 / WebView2), which is where the paragraph below said it belonged.** A fragment link scrolled the parent scroller and an http(s) link opened the OS browser, so decision-9's interception is observed on the platform that runs it rather than only written. The paragraph is kept as the record of why it stayed open for two rounds.

**AC #6 was left unticked on purpose, and it was the only one.** Its second half - an `http(s)` link inert, a `#` link observed rather than assumed, and the platform difference detected at runtime - is fully observed: that is what the first visual round measured and what decision-10 records. Its **first** half is not, and cannot be here: "where the frame runs parent-registered listeners, fragment links scroll the parent scroller, http(s) links open the OS browser" describes WebView2, and no Windows machine was in either round. The interception code is decision-9's as written and unobserved. **TASK-5.3 needs Windows anyway** - its notice bar has to say a different thing on each side of that boundary - so the check belongs in that round.

The second round also found that `rendered-outline.html` itself fell to the source view: it stacked six `90vh` boxes, so `f(H) = 5.4H + c` has no fixed point and the height ceiling caught it. That is the specified behaviour, not a defect, and the fixture was split - `rendered-outline.html` now carries exactly one `50vh` box, which converges, and `rendered-diverges.html` is the fallback case.

## Known, accepted, and worth revisiting

**A document stacking two or more viewport-height sections has no fixed point and goes to the source view.** `f(H) = n x 0.9H + c` diverges for n >= 2, so the height ceiling catches it. In the measured corpus that is 4 documents in 2,757 (0.15%), which is decision-3's "pathological growth" as intended - but full-screen hero sections are a common way to build a page, and the corpus is one machine's saved documents rather than the open web. **`MAX_FRAME_HEIGHT_PX` may need relaxing** (2026-08-19, user: accepted for now). Raising it does not make a divergent document converge; it only moves where the fallback happens, so the real question is whether the single-scroller contract should hold for that shape at all - which is decision-3, decision-9 and TASK-8 opened together, not a constant.
<!-- SECTION:NOTES:END -->
