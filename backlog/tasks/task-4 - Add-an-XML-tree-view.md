---
id: TASK-4
title: Add an XML tree view
status: Done
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-16 22:43'
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

Gotcha: binary plists are the norm on macOS. TASK-10 already detects the bplist00 magic and reports it as the binary variant of ReadError, with a message of its own in both dictionaries (decision-5), so AC #4 needs no new detection here. What is left to decide is only whether to map plist into file_kind at all: mapping it is what makes that path reachable from the UI, and it means advertising files that open as an explanatory message rather than as a tree. See decision-2 on encoding scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 xml, plist, xsd and xsl files open in the tree view by default, with a toggle to the source view
- [x] #2 Where the WebView exposes an error position, the banner shows the line number and the source view flags that line
- [x] #3 Where it does not, the banner still appears without a line number and nothing is flagged, and that path is exercised rather than assumed
- [x] #4 A binary plist produces a message naming the cause, not a raw UTF-8 decoding error
- [x] #5 Unit tests cover the pure transform into the tree model
- [x] #6 New i18n keys are added to both the ja and en dictionaries
- [x] #7 A node count above the cap is truncated or revealed incrementally rather than rendered whole, and the omission is stated
- [x] #8 pnpm build, pnpm test, cargo check and cargo test all pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Caps, the parse-error policy and the two forms of a `.plist`: decision-8. Three
constants in `src/lib/xml-tree.ts` (`XML_MAX_NODES` 20,000, `XML_MAX_ATTRIBUTES`
64, `XML_MAX_VALUE_CHARS` 500), the tree/source toggle, and the omitted counts
stated above the tree.

`XML_MAX_ATTRIBUTES` was not in the first cut and is the same mistake decision-7
found one level up: the node budget bounds how many attributes exist, but
attributes render inline, so 25,000 of them satisfied every cap and produced one
unwrapped row 200,000 characters wide. The value is measured — 826,427 elements
across two corpora, widest element 14 attributes, none over 16 — and set at 64 for
headroom, because a cap set too low thins a real document while one set too high
only widens a row nobody reads.

AC #3 is checked on the unit test plus a path the product already exercises, not
on an XML file: all three WebViews parse XML with libxml2, whose wording always
carries a position, so an XML document with no reported position cannot be
produced here. What is covered is `xmlErrorInfo`'s no-position branch (unit test)
and the banner that renders it — `ErrorBanner`, now shared with `ConfigView`,
where the missing-line path is what JSON already takes today (TASK-18).

`.plist` carries either markup or JSON under one extension, so `ViewerBody`'s
`case 'xml'` branches on the text (`isJsonPlist`): `{` or `[` routes to
`ConfigView`, anything else to `XmlView`. Only `.plist` is sniffed. This is the
first kind whose view is not settled by its kind, so doc-1 step 4 gained a note.

Binary plists needed no code: `read_file` names them from the `bplist00` magic
before any decode (decision-5). Mapping `plist` into `file_kind` is what makes
that message reachable at all.

The transform takes `DomNodeLike` rather than a `Document`, so the caps are
unit-tested under Node with no jsdom while `XmlView` keeps the only `DOMParser`
call. The walk is iterative: nesting depth is the document's to choose, and a
recursive walk overflows the stack on a file well inside the 10 MiB read cap.

Visual pass done by the user (2026-08-17) over `_sandbox/samples/`: `pom.xml`,
`Info.plist`, `json.plist`, `schema.xsd`, `transform.xsl`, `broken.xml`,
`huge.xml`, `attrs.xml`, `bloated.xml`, `deep.xml`, `binary.plist`.
<!-- SECTION:NOTES:END -->
