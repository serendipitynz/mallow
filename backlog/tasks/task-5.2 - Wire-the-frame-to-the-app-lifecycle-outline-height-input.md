---
id: TASK-5.2
title: 'Wire the frame to the app: lifecycle, outline, height, input'
status: To Do
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-07-31 09:40'
labels:
  - feature
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

1. Respect the frame lifecycle, which everything else depends on: contentDocument is about:blank until the load event, and every srcdoc replacement builds a fresh document that loses ids, listeners and the measured height. Fix the order - wait for load, assign heading ids, bind listeners, restore the scroll anchor, then measure the height - and re-run all of it on a live reload.
2. Give h1-h6 ids, but only where the element has none, and de-duplicate generated slugs. Overwriting an existing id breaks the document's own fragment links.
3. Drive the existing Outline through the lookup root and coordinate conversion from TASK-8. Use the scroll mechanism TASK-8 settles on; do not leave the current el.scrollIntoView({ block: 'start' }) in Outline.tsx:60 to decide by accident.
4. Size the frame from the scrollHeight of contentDocument so the app scroller stays the only scroller. Two separate bounds are needed and they solve different problems:
   - A measurement-pass cap, because this is a feedback loop: a document with body { min-height: 200vh } grows every time the measured height is applied. Settle on the last stable value, and reset the counter on a width change rather than exhausting it and leaving the height stale.
   - A maximum height, as a backstop against pathological growth rather than a limit real documents are expected to meet. Set it high enough that ordinary long documents stay under it, and when it IS exceeded, fall back to the capped source view - the same landing spot as TASK-5.1's render complexity threshold.
   Do NOT let the frame become a second scroll region instead. That would break the single scrolling contract the rest of the design rests on: decision-3 requires fragment links to be scrolled by the parent and the app scroller to stay in charge, and both the keyboard forwarding below and TASK-8's boundary-crossing mechanism assume the frame has no scrollable viewport of its own. Nested scrolling would mean reopening decision-3, TASK-8 and the fragment and keyboard criteria together as one contract; it is not an option to be taken locally here.
   Re-measure after a live reload, after late layout changes (images, details elements), and after anything that changes the frame's width: window resize, Explorer splitter drag, outline open/close.
5. Attach a click handler to contentDocument. It cannot simply mirror MarkdownView.tsx:79-93: that handler returns early for '#' links and lets native fragment navigation scroll, which does nothing here because a frame sized to its content has no scrollable viewport. Fragment links must be preventDefault-ed and scrolled by the parent; http(s) links go to the OS browser via openUrl; everything else is inert.
6. Forward keyboard scrolling. Once focus moves into the frame - which Outline.tsx:61-62 does deliberately via tabindex and focus() - arrow keys, Space, PageDown, Home and End reach a document that cannot scroll and the app scroller stays put. Wheel events chain; keyboard events do not. Forward keydown to the parent scroller, or keep focus in the parent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ids, listeners and the measured height are all re-established after the frame reloads, and scroll position is preserved across a live reload
- [ ] #2 Headings that already carry an id keep it, generated slugs do not collide, and the document's own fragment links still resolve
- [ ] #3 The outline lists the document's headings, clicking one scrolls to it, and the active-heading highlight tracks the parent scroller
- [ ] #4 Frame height converges on a document whose body depends on viewport height, within a bounded number of measurements and a maximum height
- [ ] #5 Height is re-measured after images and details elements change the layout
- [ ] #6 Fragment links scroll the parent scroller; http(s) links open the OS browser and never navigate the app WebView; every other scheme is inert
- [ ] #7 After clicking an outline entry, arrow keys, Space, PageDown, Home and End still scroll the document
- [ ] #8 pnpm build and pnpm test pass
- [ ] #9 Height is re-measured when the frame's width changes: window resize, Explorer splitter drag, and outline open/close
- [ ] #10 The measurement-pass cap resets on a width change rather than exhausting itself and leaving the height stale
- [ ] #11 Content taller than the maximum frame height falls back to the capped source view, and the frame never becomes a second scroll region
<!-- AC:END -->
