---
id: TASK-73
title: Find what the markdown view keeps resident after rendering a small document
status: To Do
assignee: []
created_date: '2026-11-23 06:07'
updated_date: '2026-11-23 06:15'
labels:
  - research
dependencies: []
priority: medium
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-70 (doc-3) measured mallow 0.15.0's memory 20 s after launching with a 23 KiB README-like document: **272 MiB footprint**, against 135–173 MiB for Marky, MD Viewer and SkimDown, with no overlap across five runs. The difference is almost all WebKit's WebContent process — **217 MiB** in mallow against 89–114 MiB — and mallow's own WebContent holds 46 MiB when the same launch opens a folder and no document, so rendering the small document costs about 170 MiB. Marky also highlights with Shiki and holds 114 MiB. With the 1 MiB Large document mallow's median is the lowest of the three Tauri/WebView apps (438 MiB against 560 and 664; one mallow run read 688, so the ranges overlap), so the cost looks fixed per first render rather than proportional to the document.

Find what that ~170 MiB is — Shiki's WASM engine, grammars or themes loaded at first highlight, the markdown pipeline, or something else the first preview pulls in — using Web Inspector's memory timeline or heap snapshots on a built app, and say which part of it is avoidable. Measure before and after with doc-2's procedure (`scripts/bench/run.mjs`), which is an outside measurement and comparable with doc-3's numbers.

Out of scope: changing anything before the cause is known; Large-document memory, whose median is already lower than the WebView peers'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The resident memory a small rendered markdown document adds to WebContent is broken down by what holds it, measured on a built app
- [ ] #2 Each avoidable part is named with its expected saving, and the change that would remove it is proposed (as this task's own change or as a follow-up task)
- [ ] #3 Any change made is measured with doc-2's procedure, five runs, against doc-3's Small footprint
<!-- AC:END -->
