---
id: TASK-3
title: Add a CSV/TSV table view
status: Done
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-16 11:23'
labels:
  - feature
milestone: m-0
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
- [x] #1 csv and tsv files open in the table view by default, with a toggle to the source view
- [x] #2 Parser unit tests cover quoted fields containing the delimiter, embedded newlines, doubled quotes, CRLF line endings and ragged rows
- [x] #3 A file above the row cap renders without stalling and reports how many rows were omitted
- [x] #4 A file with few rows but a column count above the cap renders without stalling and reports how many columns or cells were omitted
- [x] #5 New i18n keys are added to both the ja and en dictionaries
- [x] #6 A file that is not valid UTF-8, such as a CP932 CSV exported by Excel, produces a message naming the cause rather than a raw decoding error
- [x] #7 pnpm build, pnpm test, cargo check and cargo test all pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Caps and UI: decision-7 (four constants in `src/lib/delimited.ts`, truncation
rather than a reveal control, the omitted counts stated above the table).

PR #28, merged `2f52c46`. Reviewer: Claude Code CLI under the bot account, three
rounds — [P2] unbounded cell text plus three [P3] in round 1, two [P3] raised on
the fix in round 2, APPROVED in round 3.

AC #3 and #4 were left unchecked at PR time because their "renders without
stalling" half is a WebView property this environment cannot observe. Checked on
2026-08-16 after the user ran the visual pass over `_sandbox/samples/`: the table
renders and performance is fine on their machine.

AC #1 was checked without the screen, on the same basis TASK-2 used: the mapping
is unit-tested on both sides (`file_kind_maps_table_extensions`, and
`kindFromName` mirrors it), widening `FileKind` makes `tsc` demand the
`ViewerBody` route, and `TableView` opens in table mode with the toggle rendered
unconditionally. The visual pass has since confirmed it.

AC #6 needed no code of its own: `read_file` selects the `ReadError` before any
kind is looked at, and `readErrorInvalidUtf8` already names CP932 (decision-5).

Measurements behind the cap values, for anyone revisiting them: at the source
view's 256 KiB byte cap Shiki emits 69,300 elements in 0.37 s under Node, which
decision-6 accepted; 20,000 cells is under a third of that element count. The
parser is linear and far cheaper — 14 MiB of CSV in 70 ms, one record of
2,000,000 fields in 38 ms.

The fourth cap, `TABLE_MAX_CELL_CHARS`, came out of the review: the other three
bound how many cells exist, not how much text one holds, and an unterminated
quote is a single field running to the end of the file.

No csv/tsv Shiki grammar is loaded for the source half. Shiki bundles both, but
they are ten-column "rainbow" grammars whose scopes the GitHub themes mostly
have no colour for, so they would tint a few columns and leave the rest plain.
<!-- SECTION:NOTES:END -->
