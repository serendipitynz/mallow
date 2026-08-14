---
id: TASK-2
title: Add an HTML source view
status: To Do
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-14 05:03'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-10
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the file kind html (html/htm) routed to SourceView with the html grammar, which is already in the LANGS list in lib/shiki.

Ships ahead of the rendered view so HTML files are at least openable; the rendering task then only has to add the second mode and the toggle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 html and htm files appear in the tree and open highlighted in the source view
- [ ] #2 file_kind and kindFromName both map the new extensions, with tests
- [ ] #3 pnpm build, pnpm test and cargo test all pass
- [ ] #4 A non-UTF-8 HTML file, such as one saved as shift_jis, reports the cause by name rather than a raw decoding error
<!-- AC:END -->
