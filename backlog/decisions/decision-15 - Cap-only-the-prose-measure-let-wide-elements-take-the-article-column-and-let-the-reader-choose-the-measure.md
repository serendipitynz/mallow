---
id: decision-15
title: >-
  Cap only the prose measure, let wide elements take the article column, and let
  the reader choose the measure
date: '2026-09-30 23:04'
status: accepted
---
## Context

A rendered document does not widen with the window. The reader hit it on a
9-column table (`_sandbox/samples/table-api-endpoints.md`): the table scrolls
inside the article, and making the window wider adds nothing to what is visible
(TASK-34). TASK-35 changes the screen and TASK-36 the paper; both implement what
this decision says.

**Two caps exist, and which one binds depends on the outline** (measured
2026-09-16, re-checked 2026-10-01 against `5448881` — no width, grid or overflow
declaration changed in between):

| outline | what limits the markdown article | width |
|---|---|---|
| open | `.doc { max-width: 1180px }` minus its `padding: 0 32px`, minus `.doc__body`'s `gap: 3rem` and the outline's `15rem` column | **828px** |
| closed | `.doc .markdown-body { max-width: 53rem }`, since `.doc.is-outline-closed` collapses the grid to one column and centres the article with `margin-inline: auto` | **848px** |

So the 1180px never reaches the article with the outline open and the 53rem never
binds with it open; closing the outline swaps them. **Raising the 1180px alone
changes nothing in the closed state**, which is why the value the reader would
think to change is the wrong half of the answer.

`.doc` is not markdown's alone, and the other views sit in states nobody chose:

| view | width today | why |
|---|---|---|
| HTML, rendered | 828px open, **1116px closed** | `.html-frame` is not matched by `.doc .markdown-body`, so nothing but `.doc` caps it once the grid is one column — the frame and the markdown article disagree in the closed state |
| mermaid file (`.mmd`) | 848px | `MermaidView` draws into a `.markdown-body`, so a diagram is held to the same cap as a paragraph |
| config, XML trees | 896px | `.doc.cfg` / `.doc.xml-doc { max-width: 960px }` minus the padding |
| CSV / TSV table | none | `.tbl-doc { max-width: none }`; a wide table overflows `.doc` and `.doc-scroll` scrolls sideways, deliberately (`table.scss`), so the header can stick against the one scroller |
| source view | its host's: 1116px, 896px or none | `SourceView` sits inside whichever `.doc` its host view renders |

Below a 1024px viewport (`$outline-breakpoint`) there is a third state: the
outline stacks above the article and `.doc .markdown-body` becomes
`max-width: none`. **None of 1180px, 53rem and 960px has a recorded reason** —
the first two date from the initial commit, config's too, and XML's copied
config's (`427432a`). snz-design does not govern this either: its adoption record
for mallow (doc-18 §4) lists the screen frame's layout as an app-specific
exception.

On paper the same declarations produce a different outcome. `print.scss` sets
`overflow: visible` on `.markdown-body table`, but the table is still
`display: block; width: max-content`, so the columns past the page's edge do not
reach the paper at all (TASK-36).

## Decision

### 1. What the cap is for

**The only cap is on the length of a line of prose**, and it exists so that a
reader's eye can travel from the end of one line back to the start of the next.
That reason is a property of running text — paragraphs, list items, headings,
block quotes, alerts, the front-matter table — and says nothing about an element
whose width comes from its content. **A later change to the number is judged
against that reason**: does a line of prose stay trackable at the new value.

Three widths are named here, from the outside in:

- **The article column** is the column of `.doc__body`'s grid that the article
  (or the HTML frame) sits in: the scroller's width minus `.doc`'s padding, minus
  the outline and its gap when the outline is open. **`.doc`'s 1180px goes**, so
  the article column grows with the window; keeping it would stop a wide table
  again on any window wider than 1180px.
- **The prose measure** is the longest a line of prose may run. It applies to
  prose only, never to the article as a whole — which is what `.markdown-body`'s
  53rem does today, and why a table is held to it.
- **The page's text block** is the paper's width minus `@page`'s margin. On paper
  it is the article column, and it is narrower than every prose measure below
  (A4 at 16mm is about 504pt, against 53rem ≈ 636pt), so on paper the page binds
  and the measure never does — which `print.scss` reflects by setting the
  measure to the column (`--prose-measure: 100%`).

### 2. Wide elements take the article column

**A wide element is one whose width comes from its content rather than from
wrapping text**: in a markdown article, a table (not the front-matter one), a code
block, a rendered mermaid diagram, and an image standing alone in its paragraph.
It is not held to the prose measure; it may take the whole article column.

- **Only at the top level of the article.** A table inside a list item or a block
  quote stays inside that block's width, which is the prose measure, and reaches
  the rest by its own horizontal scroll. An image inline with text is part of that
  line of prose.
- **On screen, past the article column, each keeps what it has today**: a table
  and a code block scroll sideways inside themselves (**the element's own
  horizontal scroll**, which already exists and moves nothing else); an image and a
  diagram scale down to fit (`max-width: 100%`).
- **On paper, a wide element fits the page's text block, and nothing is lost off
  its edge.** A code block already wraps there. A table fits by laying out its
  columns within the block and wrapping its cells' text. An image and a diagram
  keep scaling down in proportion (`max-width: 100%`), as on screen — a picture
  has no text to wrap, and scaling it shrinks nothing else. **No text is scaled
  down to make it fit — neither the whole document nor a table or code block on
  its own** — the engine's shrink-to-fit and a smaller type size are the failure
  mode TASK-27 and TASK-28 recorded, not a fix. A table whose narrowest layout
  still exceeds the block is measured and written down by TASK-36, not solved by
  shrinking.
  **Measured (TASK-36, macOS unattended export, A4 at 16mm)**: the table is laid
  out as a table again on paper, and its cells take `overflow-wrap: anywhere`,
  which is what lets a column narrow past its longest word at all. Its narrowest
  layout — each column about one glyph plus its cell padding — fits up to **24
  columns** and loses the right-hand ones from 25; that is the limit this
  decision accepts rather than shrinking past. Below it the price is that a short
  word in a squeezed column can split mid-word: in the nine-column fixture
  `GET` and the right-hand values are set one letter per line, because WebKit
  shares the block out in proportion to each column's content width.

### 3. The measure is a preference with three values

The reader chooses the prose measure (answer from the owner, 2026-10-01):

| value | label (ja / en) | prose measure |
|---|---|---|
| `standard` (default) | 標準 / Standard | 53rem (848px) — the value readers have had since the first release |
| `wide` | 幅広 / Wide | 72rem (1152px) |
| `full` | フル（制限なし） / Full (no limit) | none — prose takes the article column too |

The setting is labelled **文章の幅 / Text width**: it widens text, and the modal
says that tables, code and diagrams follow the window whichever value is chosen.
53rem is about 53 characters of Japanese and about 100 of English at the body's
16px, which is already at the long end for English; 72rem is a step past it for a
reader on a wide monitor who wants fewer line breaks, and `full` is for the reader
who wants none. **The two numbers may be revised after TASK-35's real-window
check by amending this decision**; the reason in §1 is what a revision is judged
against.

**It is one app-wide preference, held and propagated the way `outlineOpen` is**:

- **Key `proseMeasure`**, in localStorage under that name, and as a
  `SettingChange` of the same key. localStorage rather than settings.json because
  the article is laid out at mount: a synchronous read lays it out once at the
  chosen measure, while the store's asynchronous read would lay it out at the
  default and again at the stored value.
- **Every window follows** through `settings:change`, ordered by
  `commit_setting`'s stamp like every other preference (TASK-12.8, TASK-33). The
  window that changes it persists and broadcasts; a receiving window applies the
  persist-free half. **There is no per-window value** — TASK-12 put those out of
  scope.
- **The settings modal carries it** as a select (snz-design doc-8 §6.3), as it
  does the language. A segmented control (doc-9 §6.12) was the first choice and
  was replaced in TASK-35: in the modal, the three worded options did not fit its
  track — the field's label wrapped and "フル（制限なし）" overflowed its
  segment — and doc-9 §6.12 sends a choice whose options need not be seen at once
  to a select anyway.
- **It does not reach the paper.** The page's text block is narrower than every
  value.

### 4. Which views this binds

| view | prose measure (the preference) | article column |
|---|---|---|
| markdown, preview | prose follows it | wide elements take it |
| HTML, rendered | not applied — the document's own CSS decides its line length, and mallow imposing one on an author's layout would override the author | **the frame takes it in both outline states**, so the frame and a markdown wide element reach the same width (this is how TASK-35 AC #4 reads) |
| mermaid file (`.mmd`) | not applied — a diagram is not prose | the diagram takes it |
| config, XML trees | not applied — tree rows are not prose | **the 960px goes**; the tree takes it |
| CSV / TSV table | not applied | unchanged: no cap, and the one view where the page scrolls sideways |
| source view (every host), text / ini / diff / sql, the raw fallback | not applied | takes it |

Media is outside `.doc` and unaffected.

### 5. The scroll invariant this rests on, stated precisely

decision-3, decision-9 and TASK-8 rest on **one vertical scroller**, `.doc-scroll`:
the HTML frame has no scrollable viewport of its own, so the outline jump, the
scroll spy and keyboard scrolling all act on the parent. **That invariant is
vertical, and this decision keeps it.** Horizontally:

- **An element's own horizontal scroll is allowed**, and already exists on tables,
  code blocks and the source view.
- **The page scrolling sideways** — `.doc-scroll` itself scrolling horizontally —
  **is allowed only in the CSV / TSV view**, where the whole content is one table
  and there is neither prose nor an outline to slide out of view. In markdown and
  the rendered HTML view it is a defect: the prose and the outline would move with
  it.

TASK-34's own text ("a change that makes the page scroll horizontally … is the
defect") is read with that qualification; as written it would condemn the CSV
view's existing, deliberate behaviour.

**Whether the HTML frame acquires a horizontal scroll of its own** when the
document inside is wider than the frame is unmeasured: `HtmlView` sizes the
frame's height only and sets no `overflow` on its document. It is of the same
class as a table's own horizontal scroll and is accepted as such; TASK-35
measures whether it appears and whether the outline jump and keyboard scrolling
still act on the parent. If they do not, this decision is reopened rather than
worked around.
**Seen 2026-10-01** (the owner, `pnpm tauri dev`,
`_sandbox/samples/rendered-wide-table.html`): the frame does take a horizontal
scroll of its own; the outline jump and keyboard scrolling still act on the
parent, and scrolling does not change the frame's height (a window-width change
does, which is the designed restart). **Not seen**: classic, space-taking
scrollbars (Windows, some Linux setups), where the horizontal bar takes height
and could open a second vertical scroll region inside the frame.

### 6. What is left to the implementing tasks

- **TASK-35** places the outline once the article column can outgrow the prose
  measure — on a wide window with `standard`, the prose and an outline pinned to
  the column's far side would sit well apart — and checks that the outline jump,
  the scroll spy and the HTML frame's height loop still converge, since a width
  change asks that loop for a restart by design.
  **Placed (TASK-35)**: the outline keeps its column at the far side, and every
  top-level child of the article is centred in the article column, so the prose
  sits mid-column in both outline states and the spare width is split either side
  of it rather than all of it falling between the prose and the outline. A wide
  element narrower than the measure keeps the measure as its minimum width, so
  its content starts where the prose does.
- **TASK-36** measures the paper on all three platforms, and adds the wide table
  to the paper fixture if that is what keeps it from regressing unseen.
  **Done (TASK-36)**: the fixture carries a nine-column table, and
  `measure-paper.mjs` fails a paper missing any of its right-hand values or with
  a word ending past the page's edge. Without the fix, macOS lost columns 6–9 and
  the engine shrank the whole paper to 0.45; with it, every column is there at
  the baseline type size.

## Consequences

- **Widening the window widens a wide element in both outline states**, which is
  the reader's report, and prose keeps a measure the reader chose.
- **Every `.doc` view now has a stated width.** Config and XML trees and `.mmd`
  diagrams become wider on a wide window than they are today; that follows from
  §1's reason, not from a separate choice, and is visible to readers.
- **One more preference**: a key, a propagation and a settings-modal entry, all
  in the existing shapes. The ordering and the store/localStorage split are
  unchanged.
- **No shrink on paper.** A table very much wider than the page may come out with
  narrow, heavily wrapped columns; that is preferred to losing columns or shrinking
  the type.
- **Relation to earlier decisions**: decision-3 and decision-9 are refined, not
  replaced — §5 names their scroll invariant as the vertical one. decision-13 and
  decision-14 are unaffected: the print and PDF entries still gate on a markdown
  preview, and both run the same stylesheet this decision's paper rule lands in.
