---
id: TASK-4
title: Add an XML tree view
status: To Do
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-14 05:04'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-9
  - TASK-10
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the file kind xml (xml/plist/xsd/xsl) with a tree-source toggle, reusing the collapsible UI of ConfigTree. svg stays an image.

Parse with the DOMParser of the WebView (text/xml): no dependency, and it executes nothing.

Gotcha: DOMParser does not exist in the Vitest Node environment. Keep the DOMParser call at the component boundary, unit-test only the pure transform into the tree model, and comment why the split exists.

Gotcha: a failed text/xml parse yields a parsererror document, but there is no standard API for the error line and column, and the text format differs across WKWebView, WebView2 and WebKitGTK. Decide the policy before building the error banner: extract line and column where the engine provides them, and fall back to a banner without a line number (and no flagged line in the source view) where it does not. Do not promise a line number that cannot be produced on every platform, and do not add an XML parser dependency to get one without asking first.

Gotcha: binary plists are the norm on macOS, and read_file uses fs::read_to_string, so those fail to read at all and Viewer.tsx:86-95 surfaces the raw UTF-8 error. Advertising plist in the tree therefore advertises files that cannot open. Detect the bplist00 magic and say what it is, or drop plist from this task - decide rather than shipping a confusing error. See decision-2 on encoding scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 xml, plist, xsd and xsl files open in the tree view by default, with a toggle to the source view
- [ ] #2 Where the WebView exposes an error position, the banner shows the line number and the source view flags that line
- [ ] #3 Where it does not, the banner still appears without a line number and nothing is flagged, and that path is exercised rather than assumed
- [ ] #4 A binary plist produces a message naming the cause, not a raw UTF-8 decoding error
- [ ] #5 Unit tests cover the pure transform into the tree model
- [ ] #6 New i18n keys are added to both the ja and en dictionaries
- [ ] #7 A node count above the cap is truncated or revealed incrementally rather than rendered whole, and the omission is stated
- [ ] #8 pnpm build, pnpm test, cargo check and cargo test all pass
<!-- AC:END -->
