---
id: TASK-6
title: Document the file kinds that reached v0.5.0
status: In Review
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-17 03:16'
labels:
  - documentation
milestone: m-0
dependencies:
  - TASK-1
  - TASK-2
  - TASK-3
  - TASK-4
  - TASK-9
  - TASK-10
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the docs for the file kinds that landed in v0.5.0. Scope settled 2026-08-17: TASK-1 through TASK-4 added seven kinds, but the HTML rendered view (decision-3, TASK-5.x) did not land, so the criteria that describe it moved to TASK-19 along with the dependencies on TASK-5, TASK-7 and TASK-8. Retitled to match. What stays here is everything that can be written truthfully against v0.5.0.

- README.md / README.ja.md: the supported-format list. HTML is listed as a source view with rendering called out as not implemented, so the entry does not promise a rendering that is not there. The CSV table withholds content above its caps, so the list says so rather than leaving the on-screen notice to read as a fault.
- AGENTS.md / AGENTS.ja.md: the gotchas - the file_kind and kindFromName duplication, the CSV row and cell caps, the XML error-position fallback, the skipped-highlighting threshold, and the absence of a CSP under pnpm tauri dev.
- tauri.conf.json: bundle.shortDescription and longDescription. Checked and deliberately left alone - the positioning stays "Markdown / config-file viewer", because widening it would invite the Office documents and source code decision-2 rules out.

The read_file contract (AC #3) was already brought up to date in TASK-10, across doc-1, decision-2 and AGENTS in both languages. Verify rather than rewrite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and README.ja.md list the newly supported formats, and say that HTML is shown as source rather than rendered
- [x] #2 The gotchas list in AGENTS.md and AGENTS.ja.md covers the file_kind and kindFromName duplication, the CSV row and cell caps, the XML error-position fallback, and the skipped-highlighting threshold
- [x] #3 The read_file contract is updated wherever it is documented, including the UTF-8-only wording and the move of BOM stripping into the backend
- [x] #4 The absence of a CSP under pnpm tauri dev is recorded as a gotcha in AGENTS.md and AGENTS.ja.md, since it removes the second containment layer during development
- [x] #5 The HTML-rendering criteria this task can no longer meet are carried by a task of their own, and doc-1 and decision-3 name that task rather than this one
<!-- AC:END -->
