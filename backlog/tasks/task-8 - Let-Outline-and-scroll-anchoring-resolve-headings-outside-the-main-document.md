---
id: TASK-8
title: Let Outline and scroll anchoring resolve headings outside the main document
status: To Do
assignee: []
created_date: '2026-07-30 09:26'
updated_date: '2026-07-30 10:46'
labels:
  - feature
dependencies:
  - TASK-7
priority: high
ordinal: 800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor, prerequisite for TASK-5.2.

Outline.tsx:29,57 and lib/scroll.ts:14,27 look headings up with document.getElementById. That call crosses neither an iframe boundary nor a shadow boundary, so a viewer whose headings do not live directly in the app document cannot reuse either module.

Swapping in a lookup root is necessary but not sufficient, on two counts.

Coordinates: Outline.tsx:26-31 drives its scroll spy by comparing el.getBoundingClientRect().top against container.getBoundingClientRect().top, and lib/scroll.ts computes anchor offsets the same way. Rects taken inside an iframe are relative to that frame's viewport, not the parent's, so the comparison is wrong by the frame's own offset unless converted. The same applies to the anchor offset after a reload, when the notice bar or frame position may have moved.

Scroll mechanism: Outline.tsx:60 currently calls el.scrollIntoView({ block: 'start' }). Whether that scrolls the *parent* when el is inside a frame is what TASK-7 records. Name the mechanism this task implements - scrollIntoView, or an explicit parent scrollTop computed from the converted offset - rather than leaving it to whatever the WebView happens to do. Note also that Outline.go focuses the target (Outline.tsx:61-62), which is what moves focus into the frame and creates the keyboard-scrolling problem TASK-5.2 handles.

Give both modules a way to receive the lookup root and the coordinate conversion, defaulting to current behavior so MarkdownView is unaffected.

While doing it: the Heading type lives in lib/markdown. Generalising these modules leaves a markdown-specific type dependency in code that is no longer markdown-specific - move it or record why it stays.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Outline resolves and scrolls to headings through an injected lookup root
- [ ] #2 MarkdownView keeps its current behavior with no call-site change beyond passing the default
- [ ] #3 pnpm build and pnpm test pass
- [ ] #4 The Heading type dependency is either moved out of lib/markdown or its staying is justified in a comment
- [ ] #5 The scroll mechanism is named explicitly and matches what TASK-7 recorded
- [ ] #6 The coordinate conversion is a pure function with unit tests over a given frame offset; observing it against a real iframe belongs to TASK-5.2
<!-- AC:END -->
