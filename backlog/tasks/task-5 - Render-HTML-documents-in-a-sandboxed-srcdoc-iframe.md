---
id: TASK-5
title: Render HTML documents in a sandboxed srcdoc iframe
status: Done
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-19 20:40'
labels:
  - feature
milestone: m-1
dependencies:
  - TASK-2
  - TASK-7
  - TASK-8
  - TASK-9
documentation:
  - >-
    backlog/decisions/decision-3 -
    Render-HTML-in-a-sandboxed-srcdoc-iframe-the-parent-can-reach-into.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella for the HTML rendered view, implemented per decision-3 (isolated-frame rendering: an iframe fed via srcdoc with sandbox=allow-same-origin and no allow-scripts).

Split into three subtasks because the review units are genuinely different - markup and containment, app integration, and the surfacing of limits - and because TASK-7 gates all three: if a WebView diverges, the split keeps the damage local.

- TASK-5.1 - build the frame: markup transform, sandbox, base style, toggle
- TASK-5.2 - wire it to the app: lifecycle, outline, height, input
- TASK-5.3 - surface what was disabled: notice bar, open outside mallow, window title

Prerequisites for the group: TASK-7 (WebView behavior must be confirmed before any of this is built on), TASK-8 (lookup root and coordinate conversion), TASK-9 (the capped source view that 5.1's complexity fallback lands in), TASK-2 (the HTML source view the toggle switches to).

Known and accepted across all three: CSS is a network side channel - url(https://...) in a style block or style attribute, plus remote srcset and poster, are fetched under img-src https:. That matches the existing exposure from remote images in Markdown.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 TASK-5.1, TASK-5.2 and TASK-5.3 are all Done
- [x] #2 TASK-7 has confirmed decision-3 rather than reopening it
<!-- DOD:END -->
