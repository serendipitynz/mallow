---
id: TASK-28
title: Make the printed paper readable with a print stylesheet
status: In Progress
assignee: []
created_date: '2026-09-06 03:02'
updated_date: '2026-09-06 03:26'
labels:
  - feature
milestone: m-3
dependencies:
  - TASK-27
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-27 reached the platform's print UI and measured what it puts on paper. On macOS the answer was one A4 page carrying the app shell and the first screenful of the document — the print call works and the paper is unusable. This task makes the paper readable, which is what the feature was asked for; without it mallow has a print entry that produces nothing anyone would keep.

**The measurement moved the instruction this task was filed under.** decision-13 said releasing `.doc-scroll` inside `@media print` would be the print stylesheet's first job. It is not: `html, body, #root { height: 100% }`, `.app`, `.app__body`, `.viewer` and `.doc-scroll` together make the `<body>` exactly one viewport tall **by construction**, so pagination yields one page whatever the document's length, and `.doc-scroll` released on its own still sits inside a viewport-tall body. The referent table names that whole parent chain the **height chain**, and that is the subject of the fix.

**The width is written as a requirement and not as a cause.** The same run cropped the page horizontally instead of scaling it, and what imposes that width was never isolated — `.doc`'s `max-width: 1180px` sits above A4's ~794 CSS px and cannot be it, which TASK-27's review caught after it had been written down as though measured. So the criterion is that the content reflows to the paper's width; the reprint says whether it does.

**Two observations from that run are what several rules here rest on.** A dark palette printed as faint text on white, because WebKit's default `print-color-adjust` drops the background and leaves the palette's light ink on an unprinted ground — so pinning light is legibility, not ink. And the settings modal did not overlay the document on paper, it erased it: the viewport-covering overlay printed as opaque white, so hiding the panel without the overlay would leave a blank page.

**Shiki's dark swap survives the palette override, and that is a limitation rather than a choice.** The dark tokens are emitted per token as inline `--shiki-dark` custom properties and applied with `!important`, which outranks the inline light colour beside them. CSS cannot un-apply a declaration and there is no value that restores the light token, so printing from a dark theme gives monochrome code in the body ink. Restoring the light tokens would mean emitting `--shiki-light` from the pipeline, which changes what every code block renders on screen and belongs to its own decision.

**A headless-Chrome harness checks the stylesheet, and it is not the measurement.** `_sandbox/handoff/task-27/harness/run.sh` renders the fixture through the app's own markdown pipeline, wraps it in the real shell markup with the real compiled CSS, and prints it. It caught two things worth having: a dead selector (`@include on-dark` used at the top level compiles to `:scope`, giving `:root[…] :scope .markdown-body …`, which matches nothing and ships silently), and `break-inside: avoid` on `table` pushing a 21-row table whole onto the next sheet and leaving half a page blank. **Its control run is why it cannot stand in for the measurement**: without the print stylesheet Chrome paginates the same page into 16, so Chrome never had the one-page failure this task exists to fix. Only a reprint on the three WebViews closes AC #9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The rendered markdown reaches the last page of the paper on all three platforms - the height chain is released, not just .doc-scroll, since the body is one viewport tall by construction and .doc-scroll alone still sits inside it
- [x] #2 The content reflows to the paper's width rather than being cropped at it. Written as the requirement, since what imposes the width was never isolated - .doc max-width sits above A4's ~794 CSS px and is not it
- [x] #3 No part of the app shell appears on the paper: toolbar, explorer, resizer, footer, the pinned doc bar, the outline, and the settings/update modal WITH its overlay, which erased the document rather than overlaying it
- [x] #4 Paper is light on every palette, and printing from a dark palette produces readable ink rather than the faint text macOS measured
- [ ] #5 break-inside: avoid is applied only where a split makes the element unreadable - images, SVG, mermaid, figure. Not to pre, table or blockquote, which split readably and cost a part-blank page when forced whole
- [x] #6 The print stylesheet is a .scss imported last, never an inline <style> in index.html, which would add a hash to style-src and retire its unsafe-inline
- [x] #7 Nothing in the file leaks outside @media print - .toolbar's will-change: transform in particular keeps its screen behaviour, since dropping it alone brings back the dropdown paint-order failure
- [x] #8 @page carries a margin, since macOS zeroes the print operation's own margins and would otherwise put text at the paper's edge. No header/footer margin boxes - engine support is uneven and three different sheets is worse than none carrying a page number
- [ ] #9 Reprinted on macOS, Windows and Linux, and the paper is readable on each. The headless-Chrome harness is not this: its control run shows Chrome paginates the unstyled page into 16, so it never had the failure being fixed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Reprinted on macOS (2026-09-06) — the paper is readable

macOS 26.6.2, WKWebView, `pnpm tauri dev`, A4, default scale.
`_sandbox/handoff/task-27/mac/paper-mac-{light,dark}-2.pdf`.
**Windows and Linux are still unmeasured**, so AC #9 stays open.

| | before | after |
|---|---|---|
| pages | 1 | **6**, ending on §12 |
| app shell on the paper | explorer, toolbar, footer | **none** |
| horizontal | cropped at the paper's edge | **reflows to the page** |
| margins | ~0 | 16mm |
| dark palette | faint text on white | **light forced; code in solid ink** |
| printed with the modal open | the modal alone, document erased | **identical to a normal print** |

The modal line is the one that had to be reported by someone looking at two
files: the reporter said the modal print matched the normal one and therefore
kept no separate PDF, which is the result — hiding `.modal-overlay` with the
panel is what removed thewhite backdrop that had erased the document.

## What the harness caught that reading would not have

`_sandbox/handoff/task-27/harness/run.sh` (headless Chrome, the app's own
pipeline, the real compiled CSS) found two defects before the reprint:

- **A selector that compiles and matches nothing.** `@include on-dark` used at
  the *top level* has no parent for its `&`, and Sass emits `:scope` in its
  place — `:root[data-theme='dark'] :scope .markdown-body …`, a `:root` nested
  under another element. Biome, `tsc` and the suite all stay green. It showed up
  as dark-theme code still printing pale.
- **`break-inside: avoid` on `table` costing a page.** A 21-row table half a page
  from the bottom went whole onto the next sheet and left half a page blank; the
  document went from 7 pages to 8. Narrowing the rule to boxes that become
  unreadable when cut is what fixed it.

**Its control run is why it is not the measurement**: without the stylesheet
Chrome paginates the same page into 16, so Chrome never had the one-page failure
being fixed here.

## Two things do not reach the paper, and neither is this stylesheet

Confirmed on screen, not inferred: the reporter's screenshot shows both failing
in the app itself.

- **mermaid prints as its own source.** `renderMermaid` replaces the
  `<pre class="mermaid">` on success and leaves it in place on failure, so source
  text on paper means the element was never replaced — and CSS cannot restore an
  element that was. `_sandbox/samples/mermaid-min.{md,mmd}` are minimal probes
  that separate "mermaid does not load at all" from "the markdown path only".
  **Not this task's to fix**, but AC #5's `break-inside: avoid` on `.mermaid` is
  untested until a diagram renders.
- **The fixture's images could never have loaded, and that was my error in
  TASK-27.** markdown-it runs with `html: false` and its `validateLink` drops
  `asset:`, so **a relative path in a document does not reach the opened folder**
  — AGENTS says it as "media only loads for files chosen in the tree". The
  fixture asked for `media/logo.png` and got a broken image on screen and on
  paper. The images are now `data:` URIs, which `validateLink` does carry, and
  the harness confirms they render and that `break-inside: avoid` keeps the large
  one whole.
<!-- SECTION:NOTES:END -->
