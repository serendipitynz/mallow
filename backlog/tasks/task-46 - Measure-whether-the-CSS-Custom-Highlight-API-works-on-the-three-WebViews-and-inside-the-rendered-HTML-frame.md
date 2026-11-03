---
id: TASK-46
title: >-
  Measure whether the CSS Custom Highlight API works on the three WebViews and
  inside the rendered HTML frame
status: To Do
assignee: []
created_date: '2026-11-03 19:23'
labels:
  - feature
dependencies: []
references:
  - src/probe/link-checks.ts
  - src/components/HtmlView.tsx
  - src/components/MarkdownView.tsx
  - >-
    backlog/decisions/decision-9 -
    Keep-the-srcdoc-frame-and-accept-that-http-s-links-are-inert-where-it-runs-no-parent-listeners.md
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spike, prerequisite for TASK-47 (find text in the open document). The find feature is to paint its matches with the CSS Custom Highlight API (`CSS.highlights` + `::highlight()`) rather than by wrapping them in `<mark>`, because writing into the DOM is exactly what two views must not have done to them: `MarkdownView` writes the article's HTML only when its enhancements re-run (TASK-29's invariant), and `HtmlView`'s `MutationObserver` turns any write into the frame into a restart of the height measurement, which throws the reader to the top. A highlight registers ranges and paints them without a single DOM mutation.

The API is Safari 17.2+ / Chromium 105+ on paper. What has not been observed is whether it works on this project's three WebViews as shipped — WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux (the Ubuntu 24.04 runner's version in particular) — and whether the parent can use it inside the rendered HTML view's frame, which is `srcdoc` with `sandbox="allow-same-origin"` and no `allow-scripts`. decision-9 is the reason not to assume the second: parent-registered listeners on that document run on WebView2 and on neither WebKit engine, so "the parent can drive the frame" is not one property.

Measure in a built app (`pnpm tauri build --debug --no-bundle`), not `pnpm tauri dev`, since the frame's CSP is absent in dev. The measurement belongs in `src/probe/` beside `link-checks.ts`, so it can be re-run. Whether a highlight *paints* is a visual fact — a counter can say a Highlight was registered, not that it drew — so each paint check needs a screenshot, and each needs a positive control in the parent document first so a missing API cannot pass as a frame-specific failure.

Also record, on Windows, whether `Ctrl+F` opens WebView2's own find UI when the app does not consume the chord. The find task consumes it regardless (the `Ctrl+P` rule), so this is recorded for the reason and does not gate anything.

If any WebView lacks the API, the fallback is decided with the owner before TASK-47 starts, rather than worked around inside it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The WebView version is recorded per platform, since support is version-dependent
- [ ] #2 On each platform, a Highlight registered in the parent document paints its ::highlight() style (the positive control), shown by a screenshot
- [ ] #3 On each platform, a Highlight whose range spans several text nodes across inline elements (e.g. foo<strong>bar</strong>) paints as one continuous match
- [ ] #4 On each platform, the parent registers a Highlight on the rendered HTML view's frame document (srcdoc, allow-same-origin, no allow-scripts), with its ::highlight() rule placed during the load pass, and whether it paints is recorded
- [ ] #5 Registering and clearing highlights in the frame is shown to produce no MutationObserver record, so it cannot trigger HtmlView's restart
- [ ] #6 On Windows, whether Ctrl+F opens WebView2's own find UI when the app does not consume it is recorded
- [ ] #7 The check lives in src/probe/ so it can be re-run, and the findings, with each platform's outcome, are recorded on this task
<!-- AC:END -->
