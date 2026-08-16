---
id: TASK-1
title: 'Support txt, ini, diff and sql files with a source view'
status: In Review
assignee: []
created_date: '2026-07-30 08:55'
updated_date: '2026-08-16 03:23'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-9
  - TASK-10
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the file kinds text (txt/text/log), ini (ini/conf/cfg/properties/editorconfig), diff (diff/patch) and sql (sql), all routed to the shared SourceView.

The ini, diff and sql grammars are already in the LANGS list in lib/shiki; text has no grammar and falls through the text fallback in SourceView.

Gotcha: the default branch of kindFromName in src/lib/file.ts currently returns 'markdown'. Decide whether it becomes text or stays markdown deliberately, and leave a comment explaining the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Files with each listed extension appear in the file tree
- [x] #2 Each opens in the line-numbered source view, highlighted where a grammar exists
- [x] #3 The file_kind unit tests in commands.rs cover the new extensions
- [x] #4 kindFromName mirrors file_kind and its default-branch choice is commented
- [x] #5 pnpm build, pnpm test and cargo test all pass
- [x] #6 A non-UTF-8 log or txt file reports the cause by name rather than a raw decoding error
- [x] #7 cargo check and cargo test pass
<!-- AC:END -->
