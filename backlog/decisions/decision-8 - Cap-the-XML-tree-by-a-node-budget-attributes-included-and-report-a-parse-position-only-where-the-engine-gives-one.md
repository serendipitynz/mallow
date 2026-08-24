---
id: decision-8
title: >-
  Cap the XML tree by a node budget attributes count against, and report a parse
  position only where the engine gives one
date: '2026-08-17 08:50'
status: accepted
---
## Context

decision-6 bounded the source view and named the views that still owed a ceiling
of their own; decision-7 gave the table its four caps. This is the XML tree's,
and it also has to settle something the earlier views never faced: an XML parse
failure has no position the DOM will tell you about.

The parser is the WebView's own `DOMParser`, taken over an XML library because it
adds no dependency, executes nothing it reads, and resolves no external entity.
What it costs is that the result is a DOM: a second copy of the document already
exists in memory before this view builds anything of its own, and the failure
mode it reports is a document, not an error.

## Decision

### One node budget, and an attribute spends from it

`src/lib/xml-tree.ts` owns it, as `lib/config-tree`, `lib/source-cap` and
`lib/delimited` own theirs:

| Constant | Value | What it bounds |
|---|---|---|
| `XML_MAX_NODES` | 20,000 | model nodes built — elements, text, CDATA, comments, instructions **and attributes** |
| `XML_MAX_ATTRIBUTES` | 64 | attributes on one element, which is what bounds the width of one row |
| `XML_MAX_VALUE_CHARS` | 500 | the text one text, comment, instruction or attribute value renders |

The **node budget** is the number of model nodes `buildXmlTree` may build, an
attribute counting as one. A tree needs no separate row and depth caps the way the
table needed separate row and column caps, because nesting does not multiply
against breadth here — every element, wherever it sits, is one row. Attributes are
the exception, and they need both of the first two caps rather than either alone:
the budget stops a document that spreads a million attributes over many elements
(no per-element cap would), and the per-element cap stops a document that puts
them all on one (the budget would allow 20,000 of them on a single row). The
ceiling the budget enforces is the one decision-7 measured: 20,000 elements is
under a third of the 69,300 spans Shiki emits at the source view's byte cap, which
decision-6 accepted as responsive.

`XML_MAX_ATTRIBUTES` bounds what neither of the others does, and it was missed
on the first pass in exactly the way decision-7's fourth cap was: the budget
counts nodes, but attributes render *inline on the element's row*, so 25,000 of
them satisfy the budget and produce one unwrapped line 200,000 characters wide.
Counting and rendering diverge again, one level down from where decision-7 found
it.

The value is measured rather than picked. Across 826,427 elements in two corpora
— a projects tree including its `node_modules` (101,858 elements) and
`/Applications` + `/usr/share` + `/Library` (724,569) — the widest element
carried **14** attributes, and none exceeded 16; the widest cases at all were
SVGs, which never reach this view. 64 is over four times that. The headroom is
deliberate, because the two errors are not symmetric: a cap set too low thins a
document someone is actually reading, while one set too high only widens a row in
a document nobody reads. Android layout XML, which neither corpus covers, reaches
roughly 30 and still fits. Attributes past the cap are counted like any other
omitted node, and the element's row ends in an ellipsis, so the cut is visible
without reading the notice.

`XML_MAX_VALUE_CHARS` bounds what the budget does not, exactly as
`TABLE_MAX_CELL_CHARS` does: the budget caps how many values exist, not how long
one is, and a single text node or attribute value may hold the whole document. A
clipped value keeps its ellipsis, so the row says so without the reader consulting
the notice. The clip is `lib/clip`'s `clipToChars`, shared with the table rather
than reimplemented — its one subtlety (never cut between the halves of a surrogate
pair) is a rule that should exist once.

**What the caps do not reach is the parse itself.** All three bound the model
built *from* the DOM, and `parseFromString` has already built the DOM before any
of them applies — so the one input they say nothing about is a document that
amplifies inside that call, an internal-subset entity nested into itself being
the standard shape. What bounds that is the engine's own entity-expansion limit,
which every current WebView has and none of them documents as a contract. It is
recorded here as a known edge rather than guarded: a guard on the DOCTYPE
internal subset costs a parse of its own on every document, and TASK-7's
cross-WebView pass is where the assumption gets checked rather than assumed.

### Over the budget the tree omits; incremental reveal is for what is under it

Two mechanisms, doing two different jobs, and they are not alternatives:

- **The node budget** decides what is built at all. Past it the walk keeps going
  but allocates nothing, so `nodeCount` describes the document while the model
  describes the render — the same split decision-7 made for `rowCount`. The
  difference is reported as **omitted nodes**: the count of nodes the document
  holds that the tree does not show. Where the budget runs out *inside* an
  element, that element records it (`omittedChildren`) and its row ends in an
  ellipsis rather than being drawn as `<name/>` — a self-closing tag asserts the
  document holds nothing there, which is a different claim from "not all of it is
  shown", and only one of the two is true. The same mark, for the same reason, as
  the one the attribute cap leaves.
- **Incremental reveal** (`lib/config-tree`'s `BRANCH_INITIAL` / `BRANCH_STEP`)
  decides how much of a *built* branch mounts at once. It is reused verbatim, and
  so is `initialBranchOpen`, which keeps "expand all" from opening deeper than
  `FORCE_EXPAND_MAX_DEPTH`.

So the tree reveals what the budget kept and omits the rest, with no "show more"
that could reach past the budget. That is decision-7's reasoning applied
unchanged: a reveal control earns its complexity only when the hidden part is
otherwise unreachable, and here the source half of the toggle reaches the whole
document at any size, because decision-6 made that view safe at any size. The
notice above the tree names it.

### The walk is iterative because the depth is the document's

`buildXmlTree` walks an explicit stack. A recursive walk is shorter and would be
wrong: nesting depth here is chosen by the file, and 10 MiB of nested start tags
inside the read cap is a stack overflow — a document a viewer should survive, not
one it should refuse. Rendering recurses, but only through branches that are open,
and both ways of opening one are already bounded.

### Whitespace-only text is dropped; CDATA is kept whatever it holds

Indentation between elements is most of a pretty-printed document and is exactly
what the tree is drawing anyway, so a whitespace-only text node is not built and
is not counted. A CDATA section is kept even when it holds only whitespace,
because writing one is a statement that its text matters. The doctype is not
shown. None of this loses anything a reader cannot get: the source half of the
toggle is the document byte for byte, which is also the reason an element with
nothing left after this is drawn as `<tag/>` although the file wrote it across
two lines.

### A parse position is reported where the engine gives one, and never inferred

`parseFromString` reports a failure by returning a document containing a
`<parsererror>` element. Two things about it are not contractual, and each gets a
different treatment:

- **Which document is an error document.** Detected by namespace, not by element
  name: a valid XML document may contain an element called `parsererror` of its
  own, and reading that as a failure would be worse than missing one. The
  namespace is learned once per session by parsing a document that cannot be
  valid. On an engine that gives no namespace at all the name is all there is, and
  that is what is used — a worse test, but a better outcome than reporting nothing.
- **Where the error is.** There is no API for the position; it exists only inside
  the message text, in wording the engine chooses. `xmlErrorInfo` reads it back
  out with a small set of patterns and is allowed to fail. Where it finds one, the
  banner shows the line and column and `SourceView` flags and scrolls to that line
  — the same path the config views already use. Where it does not, the banner
  appears with the engine's message and no location, and nothing is flagged.

**A parse failure with no position is a supported outcome, not a degraded one.**
The alternatives were both rejected: adding an XML parser dependency to get a
position the platform will not give is against the project's stated weight and was
not to be done without asking, and inferring a position from the message's
description of the markup would put a line number under the reader's cursor that
nothing verified.

Today all three WebViews mallow ships on (WKWebView, WebView2, WebKitGTK) parse
XML with libxml2 and therefore share one wording, so the first pattern is the one
that matches in practice. That is a fact about the current engines, not a promise
any of them makes — which is why the no-position path exists and is covered by a
unit test on `xmlErrorInfo` rather than left to be discovered on the engine that
changes first.

### A `.plist` picks its view from its text, and it is the only kind that does

A property list is XML, binary or OpenStep, and `plutil -convert json` writes a
fourth form people keep under the same extension. All of them are `.plist`, so
this is the one kind whose view cannot be settled by the extension mapping the
way decision-2 settles everything else:

- Binary is already answered before any view is chosen — `read_file` names it
  from the `bplist00` magic (decision-5). Mapping `plist` into `file_kind` is
  what makes that message reachable; without the mapping the file is simply
  absent from the tree and nothing can be said about it at all.
- Between the two text forms, `isJsonPlist` looks at the first non-whitespace
  character: `{` or `[` routes the file to `ConfigView` (which parses it as JSON
  and shows the config tree), anything else to `XmlView`. `configFormat` names
  `plist` explicitly rather than falling through to its JSON default, so the
  mapping is stated where it is read.
- An OpenStep plist matches neither and reaches `XmlView`, which reports it as a
  parse failure and shows the source. That is the accepted outcome: the format is
  not supported, and saying so beats guessing.

**Only `.plist` is sniffed.** A `.xml` beginning with `{` is a broken XML
document and gets the error banner, because a file that claims markup and holds
something else is worth saying so about rather than quietly opening as something
else. The rule is deliberately one character wide, not a format detector: it
decides between two known encodings of one extension, and nothing more.

### The parse stays at the component boundary

`XmlView` is the only place that touches `DOMParser`. Everything below it takes
`DomNodeLike`, the structural subset of a DOM node the transform reads, which a
real `Document` satisfies and a test can write as an object literal. This is what
makes the transform and the caps testable under Node with no jsdom, and doc-1
requires it of any kind whose safety or shape depends on a browser API.

## Consequences

- An XML document can lose content in this view, as a CSV can. The notice states
  what was left out and where the rest is, and the toggle is one click.
- `nodeCount` and `omittedNodes` describe the document; `clippedValues` counts
  what was built and clipped, so it under-reports what a document holds rather
  than over-reporting what the reader lost. This is the mirror of decision-7's
  `clippedCells`, and for the same reason: the value has to exist to be measured.
- The tree reuses the config tree's row shell (`cfg-*` in `styles/config.scss`)
  and its reveal constants. The two views collapse the same way and are meant to
  keep doing so; only what is specific to markup lives in `styles/xml.scss`.
- **The position patterns are the one part of this that can rot silently.** An
  engine that rewords its message does not break anything — it drops every XML
  error to the no-position path, quietly. TASK-7 already plans a pass across the
  three WebViews; the wording belongs in it.
- Binary plists need nothing here. `read_file` names them from the `bplist00`
  magic before any decode is attempted (decision-5), so they arrive as a typed
  `ReadError` with wording in both dictionaries, and mapping `plist` into
  `file_kind` is what makes that message reachable at all instead of the file
  being absent from the tree.
- **One kind can now reach two views, which doc-1's seven touch points did not
  anticipate.** `ViewerBody`'s `case 'xml'` branches on the text. Anything that
  reasons from `file.kind` to "which view is on screen" is wrong for `.plist`
  from here on.

## Amendment — what this decision's position rule does and does not cover (TASK-18, 2026-08-24)

The section above ("A parse position is reported where the engine gives one, and
never inferred") was written about XML and stays correct about XML. It was read
afterwards as the project's general policy on parse positions, and it is not:
decision-12 states the rule that covers every parsed kind — **report a position
wherever one can be obtained without adding a dependency and without inferring
it** — and this decision's sentence is that rule's XML consequence.

Nothing here changes. XML still reports a position only where the engine's
`<parsererror>` wording carries one, because there is still no position source for
it besides that text and adding an XML parser to get one is still rejected. What
changes is that the same rule gives `.json` a different answer, since
`jsonc-parser` is already in the tree for `.jsonc` and a strict scan of it names
the offset the engine's message omits (decision-12). **The asymmetry is about which
position sources exist, not about which formats deserve a line** — so if an XML
parser ever arrives for another reason, XML is obliged to start reporting one.

The other half of "never inferred" gained a case: `parseJsonl`'s `column: 1` was
an inferred position of exactly the kind this decision forbids, printed into the
banner for every failing `.jsonl` record. decision-12 removes it.
