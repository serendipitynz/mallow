---
id: TASK-3
title: Add a CSV/TSV table view
status: To Do
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-07-30 10:27'
labels:
  - feature
dependencies:
  - TASK-9
  - TASK-10
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the file kind csv (csv/tsv) with a table-source toggle mirroring the chrome ConfigView already uses.

Write the delimiter parser by hand as a pure module under src/lib/ (RFC 4180 quoting rules, roughly 40 lines, no dependency).

Cap what gets rendered, and state the truncation in the UI. There is no virtualized list in this codebase, so an unbounded table will stall the WebView. A row cap alone is not enough: a file well under 10 MiB can hold a single row with millions of delimiters, which passes a 5000-row cap and still emits millions of cells. Bound rows AND either columns or total cells. Do not add a virtualization dependency for this.

Match the existing precedent rather than inventing against it: src/lib/config-tree.ts exports BRANCH_INITIAL / BRANCH_STEP / nextVisibleCount with tests, and ConfigTree reveals more on demand instead of truncating outright. Either reuse that shape for the table or record why a hard cap is right here.

Encoding: CSV exported by Excel in Japan is usually CP932, which read_file cannot decode. TASK-10 makes that error branchable; this task turns it into a message that names the cause. See decision-2 on encoding scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 csv and tsv files open in the table view by default, with a toggle to the source view
- [ ] #2 Parser unit tests cover quoted fields containing the delimiter, embedded newlines, doubled quotes, CRLF line endings and ragged rows
- [ ] #3 A file above the row cap renders without stalling and reports how many rows were omitted
- [ ] #4 A file with few rows but a column count above the cap renders without stalling and reports how many columns or cells were omitted
- [ ] #5 New i18n keys are added to both the ja and en dictionaries
- [ ] #6 A file that is not valid UTF-8, such as a CP932 CSV exported by Excel, produces a message naming the cause rather than a raw decoding error
- [ ] #7 pnpm build, pnpm test, cargo check and cargo test all pass
<!-- AC:END -->
