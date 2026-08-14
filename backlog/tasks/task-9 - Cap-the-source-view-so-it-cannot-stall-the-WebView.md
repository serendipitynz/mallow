---
id: TASK-9
title: Cap the source view so it cannot stall the WebView
status: To Do
assignee: []
created_date: '2026-07-30 10:04'
updated_date: '2026-08-14 05:03'
labels:
  - feature
milestone: m-0
dependencies: []
priority: high
ordinal: 600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prerequisite for the source-view fallbacks other tasks rely on.

SourceView.tsx:29-39 calls hl.codeToHtml on the whole file with no size or line limit. Shiki tokenizes through a WASM regex engine and emits a span per token, so a multi-megabyte file freezes the WebView - harder than rendering it would.

This matters because other tasks treat the source view as the safe fallback: TASK-5.1 falls back to it above a render complexity threshold and TASK-3 falls back to it above the table caps. Both claims are false while the source view is itself unbounded. TASK-1 also routes log and txt files here, the kinds most likely to be huge.

Above a threshold, give up highlighting rather than the file: Viewer.tsx:122-129 already renders a plain pre with class raw-view in the ViewerBody default branch, which is the natural landing spot. Dropping lang to text is NOT enough - Shiki still emits a span per line. Say in the UI that highlighting was skipped, so it does not read as a rendering bug.

There is a precedent worth matching rather than inventing against: src/lib/config-tree.ts exports BRANCH_INITIAL / BRANCH_STEP / nextVisibleCount with tests, and ConfigTree reveals more on demand instead of truncating. Decide whether the source view reveals incrementally the same way or hard-stops, and record why.

Note for whoever picks this up first: TASK-1 depends on this task, so .txt and .log are not openable yet. Reach the path with a large .md in source mode, or a large .json through the config source toggle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A multi-megabyte text file opens promptly with highlighting skipped and a message saying so
- [ ] #2 Line numbers still work in the unhighlighted path, or their absence is deliberate and stated
- [ ] #3 New i18n keys are added to both the ja and en dictionaries
- [ ] #4 pnpm build and pnpm test pass
- [ ] #5 The threshold and the highlighting-skipped render path are exported from one module so later fallbacks can target them
- [ ] #6 The chosen behaviour (incremental reveal or hard stop) is consistent with lib/config-tree or its divergence is justified
- [ ] #7 The verification path is a large JSON opened through the ConfigView source toggle, since txt and log are not available until TASK-1 and a large markdown file would measure MarkdownView instead
<!-- AC:END -->
