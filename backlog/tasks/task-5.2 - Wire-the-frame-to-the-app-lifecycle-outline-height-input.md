---
id: TASK-5.2
title: 'Wire the frame to the app: lifecycle, outline, height, input'
status: To Do
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-08-18 01:18'
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
- [ ] #1 Ids, the measured height and any parent-side wiring are all re-established after the frame reloads, and scroll position is preserved across a live reload
- [ ] #2 Headings that already carry an id keep it, generated slugs do not collide, and the document's own fragment links still resolve
- [ ] #3 The outline lists the document's headings, clicking one scrolls to it, and the active-heading highlight tracks the parent scroller
- [ ] #4 Frame height converges on a document whose body depends on viewport height, within a bounded number of measurements and a maximum height
- [ ] #5 Height is re-measured after images and details elements change the layout, driven by an observer rather than by a listener inside the frame (decision-9)
- [ ] #6 Where the frame runs parent-registered listeners, fragment links scroll the parent scroller, http(s) links open the OS browser and never navigate the app WebView, and every other scheme is inert. Where it does not, an http(s) link is inert, what a '#' link does is observed rather than assumed, and the platform difference is detected at runtime rather than read off a platform name (decision-9)
- [ ] #7 After clicking an outline entry, arrow keys, Space, PageDown, Home and End still scroll the document
- [ ] #8 pnpm build and pnpm test pass
- [ ] #9 Height is re-measured when the frame's width changes: window resize, Explorer splitter drag, and outline open/close
- [ ] #10 The measurement-pass cap resets on a width change rather than exhausting itself and leaving the height stale
- [ ] #11 Content taller than the maximum frame height falls back to the capped source view, and the frame never becomes a second scroll region
<!-- AC:END -->
