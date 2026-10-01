---
id: TASK-36
title: Stop a table wider than the page falling off the printed paper
status: In Review
assignee: []
created_date: '2026-09-16 00:39'
updated_date: '2026-10-01 06:31'
labels:
  - bug
milestone: m-4
dependencies:
  - TASK-34
priority: high
type: bug
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A table wider than the page loses its right-hand columns on paper. The reader
hit it on `_sandbox/samples/table-api-endpoints.md`, which is 9 columns.

**`print.scss` already sets `overflow: visible` on `.markdown-body table`
(`print.scss:119-121`), and that is not enough** — for the same reason the note
beside it gives for a `<pre>`: the element's width is still `max-content`, and
paper has no scrollbar to reach an overflow with. The `<pre>` fix
(`white-space: pre-wrap` plus `overflow-wrap: anywhere`) **does not carry
over**, because a `pre`'s width comes from its text and a table's comes from its
columns.

**This is the screen's mechanism producing a different outcome**, not a second
defect: the same three declarations that give the reader a scrollable table give
the paper a clipped one. TASK-35 is the screen half.

## What the last round of print work established, and what binds here

- **No CSS value is tuned against a truncation.** Removing `@page`'s margin,
  shrinking the type and the engine's own shrink-to-fit all "fixed" the macOS
  truncation by bringing the required page count under a stale one. A fix that
  works by making the document smaller is the failure mode, not the fix.
- **The engine shrinks the whole document to fit one over-wide element.** That
  is why code wraps in print. A table that still overflows can do the same to
  everything around it.
- **`print.scss` carries no pagination constraint at all today**, and that
  absence is a state nothing has printed against rather than a finding. The note
  there records that `table` cost a part-blank page when constraints were last
  present. Reintroducing one is allowed; doing it silently is not.
- **Nothing automated sees the paper except `scripts/paper/measure-paper.mjs`**,
  which answers only what a number can settle. If keeping this from regressing
  means the wide table joins the paper fixture, that is part of the work.

## Not to be assumed

That the answer is the same on all three platforms. Printing is refused on Linux
outright, `@page`'s margin does not reach the Linux paper (TASK-31), and macOS
and Windows paginate differently. Measure each; where they differ, write it down
rather than picking one and calling it the behaviour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A table wider than the page reaches the paper in full on all three platforms, measured on a real export rather than inferred — _sandbox/samples/table-api-endpoints.md (9 columns) is the fixture
- [x] #2 The mechanism is named in the stylesheet: overflow: visible does not help a table whose width is max-content, for the same reason it does not help a pre whose white-space is pre, and the pre fix (pre-wrap + overflow-wrap) does not carry over because a table's width comes from its columns
- [x] #3 Whatever is done does not shrink the whole document to fit — the engine's own shrink-to-fit is what one over-wide element triggers, and the last round of print work established that no CSS value is to be tuned against a truncation
- [x] #4 PDF export and the print route agree, since both run the same stylesheet through the same pipeline; where they cannot agree, the difference is written down
- [x] #5 Any pagination constraint reintroduced is noted as such: print.scss deliberately carries none today, and the note beside that absence records that table cost a part-blank page
- [x] #6 Measured against the paper checker: MALLOW_UNATTENDED=1 build plus scripts/paper/measure-paper.mjs, with the wide table added to the paper fixture if that is what it takes to keep this from regressing unseen
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Measured 2026-10-01 (PR #76).** On paper the table is laid out as a table again (`display: table; width: auto`) and its cells take `overflow-wrap: anywhere`; no pagination constraint was reintroduced.

- **Before** (macOS export, old stylesheet, fixture §12): all eight right-hand values missing *and* the whole paper shrunk to 0.45 (median word height 8.30 against 18.56). The over-wide table triggered the engine's shrink-to-fit and still lost columns 6-9.
- **After, export**: CI `paper` PASS on all three runners in both themes, type size exactly on each environment's baseline (ci-macos 21.00, ci-windows 15.45, ci-linux 33.28); this machine's macOS export PASS at 18.55.
- **After, print route**: macOS print sheet PASS in both themes, 16 pages, same text block and type size as the export. A first attempt stopped at 14 pages, which is the known stale page count of macOS's print path; switching printers in the sheet brought it to 16. Windows (`Ctrl+P` through WebView2, owner's machine): every column present, table and last section on the same pages as the CI export (13 and 15), 16mm text block on both; the difference is WebView2's own header and footer, which the print route adds and CSS cannot remove. Linux refuses printing, so its export has no print route to agree with.
- **Price and limit**: a short word in a squeezed column can split mid-word (WebKit shares the block out in proportion to each column's content width). On A4 at 16mm the narrowest layout fits up to 24 columns and loses the right-hand ones from 25 (decision-15 §2).
- Linux's text starting at x=18pt is TASK-31, not this task. Reports and PDFs: `_sandbox/handoff/task-36/`.
<!-- SECTION:NOTES:END -->
