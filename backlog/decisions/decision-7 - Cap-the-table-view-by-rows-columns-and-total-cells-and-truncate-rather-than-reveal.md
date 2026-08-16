---
id: decision-7
title: >-
  Cap the table view by rows, columns and total cells, and truncate rather than
  reveal
date: '2026-08-16 10:35'
status: accepted
---
## Context

decision-6 bounded the source view and said explicitly that it bounded nothing
else: "every other view that expands a document into DOM — the config tree, and
the table and HTML renderers still to be built — needs its own ceiling". This is
the table's.

A CSV inside `read_file`'s 10 MiB cap can still be any shape. A row cap alone is
not enough, because one record may hold millions of delimiters and pass it; a
column cap alone is not enough, because a million short records pass that. And
satisfying both still permits their product: 5,000 records of 100 fields is half
a million cells.

There is no virtualized list here and none is being added, so every cell the
view names is a real DOM node.

## Decision

### Four caps, because they bound four different things

`src/lib/delimited.ts` owns them, as `lib/source-cap` and `lib/config-tree` own
theirs:

| Constant | Value | What it bounds |
|---|---|---|
| `TABLE_MAX_ROWS` | 5,000 | `<tr>` elements |
| `TABLE_MAX_COLUMNS` | 100 | the width of one row |
| `TABLE_MAX_CELLS` | 20,000 | their product |
| `TABLE_MAX_CELL_CHARS` | 500 | the text inside one cell |

`tableExtent` applies the first three together: columns are clamped first, then
rows are clamped to the row cap *and* to what the cell budget leaves at that
width — 5,000 rows at 4 columns or fewer, 2,000 at 10 columns, 200 at 100.

The fourth bounds something the other three do not touch. They cap how many cells
exist, not how much text any one holds, and a field may run to the end of the
file: an unterminated quote does exactly that by design, so a 10 MiB CSV whose
first byte is `"` parses to one record of one field. Every other cap is satisfied,
nothing is reported as omitted, and the view puts 10 MiB into a single wrapping
cell whose intrinsic width the engine then has to measure. A well-formed export
with a base64 or embedded-JSON column reaches the same place without any
malformation. `parseDelimited` therefore clips a kept value at
`TABLE_MAX_CELL_CHARS` and appends an ellipsis, so the cell shows that it was
clipped without the reader consulting the notice, and counts the clips so the
notice can report them. The source view's own above-cap path does not need this
because it renders one *non-wrapping* text node; a wrapping table cell is a
different trade.

The cell budget was set against what this codebase already accepts. Measured
with the bundled Shiki 4.3.0 under Node, a document at the source view's byte cap
(256 KiB of JSON, 3,850 lines) is highlighted into 69,300 `<span>` elements in
0.37 s, and decision-6 accepted that as responsive. 20,000 cells is under a third
of that element count. The margin is deliberate and is not a timing claim: Shiki's
output reaches the DOM as one `innerHTML` parse, whereas a table is built element
by element by React, so equal element counts are not equal work. The parser's own
cost is linear and small next to either — 14 MiB of CSV parses in 70 ms, and a
single record of 2,000,000 fields in 38 ms, both above what `read_file` will hand
over.

### Over the caps the table truncates; the source view is where the rest is

There is no "show more". This diverges from `lib/config-tree`, which reveals a
branch's children incrementally, and the divergence is the same one decision-6
made for the same reason: a reveal control is worth its complexity when the
hidden part is otherwise unreachable, and here it is not. Every kind routed
through this view has the source view as the other half of its toggle, and
decision-6 made that view safe at any size. Extending a table 200 rows at a time
pays the same total cost as showing the whole file and still stops short of it,
while the toggle reaches all of it in one click.

Records past the caps are counted but never built. `parseDelimited` returns the
file's true `rowCount` and `columnCount` alongside the rows it kept, so the
counts the UI reports do not depend on what was rendered, and a pathological file
costs no allocation per unrendered field.

### What was left out is stated above the table

Four i18n keys in both dictionaries — `tableTruncatedRows`,
`tableTruncatedColumns`, `tableClippedCells` and `tableTruncatedHint` — rendered
as one line above the table, and only the parts that apply. Separate counts
rather than decision-6's single message because, unlike "why is this not
coloured", the answers differ: a reader who has lost columns, one who has lost
rows and one whose cells are clipped are looking for different things. The hint
names the source view, so the message says where the rest is rather than only
what is missing.

### The first record is the header, unconditionally

Delimited formats carry no way to say whether a header row is present. Guessing
from the shape of the first record would be wrong silently on the files it got
wrong, so the first record is always rendered as the column header.

## Consequences

- A CSV can lose content in this view. That is new — every earlier view either
  showed the whole document (source) or hid only what a control could bring back
  (config tree). It is acceptable only because the toggle is one click and the
  source view is bounded, which is why the notice names it.
- The caps are the table's alone. The HTML renderer (decision-3) still needs its
  own; this decision does not give it one.
- `TABLE_MAX_COLUMNS` also decides how much of a very wide record is ever
  reachable in this view: a 5,000-column export shows its first 100 columns here
  and the rest only as text.
- **One ragged record sets the width for the whole table, including records the
  view will never reach.** `columnCount` is the widest record in the file, so a
  60,000-record export of 4 fields containing one 100-field record shows 200 rows
  rather than 5,000, each padded to 96 empty columns, and reports no omitted
  columns because none were omitted. This is chosen, not inherited: deriving the
  width from the records actually rendered would make the table's shape depend on
  the cap that the shape itself determines, and the alternative of taking the
  width from the header record would silently narrow every legitimately wider
  record. The rows notice still reports the omission; what it does not explain is
  why the number is 200.
- The values are unit-tested through `tableExtent` and `parseDelimited` rather
  than asserted in prose: the tests fix that no shape of input can exceed the
  budget, including the single-field file that satisfies every cap but the
  fourth.
