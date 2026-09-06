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
- [x] #5 break-inside: avoid is applied only where a split makes the element unreadable, which is img and .mermaid-rendered - NOT .mermaid, which is the <pre> holding a diagram's source and would be exactly the shape this rule excludes. figure and a bare svg are excluded too: html: false emits no <figure>, and the body's only other SVG is a GFM alert icon that cannot span a break. Not pre, table or blockquote, which split readably and cost a part-blank page when forced whole
- [x] #6 The print stylesheet is a .scss imported last, never an inline <style> in index.html, which would add a hash to style-src and retire its unsafe-inline
- [x] #7 Nothing in the file leaks outside @media print - .toolbar's will-change: transform in particular keeps its screen behaviour, since dropping it alone brings back the dropdown paint-order failure
- [x] #8 @page carries a margin, since macOS zeroes the print operation's own margins and would otherwise put text at the paper's edge. No header/footer margin boxes - engine support is uneven and three different sheets is worse than none carrying a page number
- [ ] #9 Reprinted on macOS, Windows and Linux, and the paper is readable on each. The headless-Chrome harness is not this: its control run shows Chrome paginates the unstyled page into 16, so it never had the failure being fixed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Reprinted on macOS (2026-09-06) — the paper is readable

**Three runs, and each observation below belongs to one of them.** macOS 26.6.2,
WKWebView, `pnpm tauri dev`, A4, default scale, all in
`_sandbox/handoff/task-27/mac/`.

| run | files | what it shows |
|---|---|---|
| 1 | `paper-mac-{light,dark}.pdf`, `paper-mac-modal.pdf` | **before the stylesheet**: one page, the shell on the paper, dark printing faint, the modal erasing the document |
| 2 | `paper-mac-{light,dark}-2.pdf` | **the stylesheet working**: 6 pages, no shell, reflowed, light on both palettes. mermaid and the images are still absent here — the diagrams were the TASK-29 bug and the images were the fixture's own defect, both fixed after this run |
| 3 | `paper-mac-{light,dark}-3.pdf` | 7 pages, with the diagrams drawn and the images present — **but shrunk to fit**, which is why its page count is not comparable with run 4's |
| 4 | `paper-mac-{light,dark}-4.pdf` | **after the code-wrapping fix**: 12 pages at true size, and **truncated** — §10's image and everything after it are missing |
| 5 | `paper-mac-{light,dark}-5.pdf` | **after removing `break-inside: avoid` from `img`**: 12 pages, truncated **at exactly the same point**. The removal did not help |

**Run 4 answered one question and opened another.** The wrapping fix worked: the
body prints at the size it has on screen instead of being shrunk to fit, which is
why 7 pages became 12 for the same document. **But the paper no longer reaches
the end.** Both light and dark stop at exactly the same place — §10's heading and
its one-line intro, then a half-empty page, with the 512px image, §11 and §12
absent. Run 3 reached §12; scaled down, that image fitted the space left on its
page and was never pushed to a new one.

**AC #1 fails on macOS, and run 5 refuted the first attempt at it.** Removing
`break-inside: avoid` from `img` changed nothing: same 12 pages, same cut point.
The truncation had started exactly at an image, and that correlation was wrong —
the second time in this task that a cause named from a correlation did not hold
(the first was `.doc`'s `max-width` for the horizontal cropping, caught in
review).

**What the runs do establish is when it appears**: runs 1–3 were shrunk to fit by
the engine and all reached §12; runs 4 and 5 print at true size and both stop two
pages short. The document needs about 14 pages at true size (the harness's count)
and macOS produces 12 in both runs. **So the shape to suspect is a page count or
a content height decided somewhere other than where the pages are laid out** —
not an element-specific rule. That is a hypothesis; nothing has measured it.

**Every pagination constraint is removed in response** — `break-inside`,
`break-after`, `orphans`, `widows` — because a stylesheet cannot bisect them from
here, they are all presentation, and what they may be costing is content
(decision-6). **Run 6 is the test**, and if it still truncates the lever is not in
this file.

## Two things run 5 established about how to measure at all

- **The print sheet's preview is not the output.** Its pagination differs from the
  saved PDF's — the preview fitted §10's image, §11 and §12 into its 12 pages
  while the PDF, at the same stated page count, stops at §10's intro. **Judge on
  the saved PDF, never on the preview.**
- **A CSS `filter` reaches the preview and not the PDF.** The dark mermaid
  inversion showed correctly in the preview and printed black in the saved file.
  So the filter approach cannot deliver the output that is actually used, and it
  is removed. **Rendering a second, light-themed copy is the only remaining route
  for a dark-palette diagram**, at the cost of a change to `lib/mermaid.ts` —
  the file TASK-29's unexplained bug lives in. **Windows and Linux are unmeasured**, so AC #9 stays open, and
`procedure.md` is at its second version because the first described the
pre-stylesheet baseline and would have had those operators record a failure as
expected.

**A later review found that all three runs were probably scaled down.** An
over-wide line in a code block made the content wider than the page, and
`overflow: visible` does not wrap `white-space: pre` — so the engine shrank the
whole document to fit and the paper carried smaller text than intended. The
stylesheet now wraps code in print (`pre-wrap` + `overflow-wrap: anywhere`); in
the harness that changed the page count from 8 to 14 at the true size. **The
macOS runs above predate that fix, so their page counts are not the ones a
reprint will produce.**

Comparing **run 1** (before the stylesheet) with **run 2** (the first run with
it). Run 3 differs from run 2 only in the mermaid and image fixes, and no run
carries the code-wrapping fix.

| | run 1 | run 2 |
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
panel is what removed the white backdrop that had erased the document.

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

## Two things did not reach the paper in runs 1 and 2, and neither was this stylesheet

**Both are fixed and both should appear on a reprint** — this section is why they
were missing, not a list of what to expect. **An operator on Windows or Linux who
finds a diagram or an image absent has found a fault, not a documented
limitation.** (The diagram can also be TASK-29, which reopening the document
works around; `procedure.md` step 1 checks for that before printing.)

Neither was inferred: the reporter's screenshot showed both failing in the app
itself, which is what separated them from the print stylesheet.

- **mermaid printed as its own source in runs 1 and 2, and draws in run 3.**
  `renderMermaid` replaces the `<pre class="mermaid">` on success and leaves it in
  place on failure, so source text on paper means the element was never
  replaced — and CSS cannot restore an element that was.
  `_sandbox/samples/mermaid-min.{md,mmd}` are minimal probes made while
  diagnosing it. It is **TASK-29**, filed separately, and reopening the document
  is the workaround — which is what run 3 did. **Not this task's to fix.**
- **The fixture's images could never have loaded in runs 1 and 2, and that was my
  error in TASK-27.** markdown-it runs with `html: false` and its `validateLink` drops
  `asset:`, so **a relative path in a document does not reach the opened folder**
  — AGENTS says it as "media only loads for files chosen in the tree". The
  fixture asked for `media/logo.png` and got a broken image on screen and on
  paper. The images are now `data:` URIs, which `validateLink` does carry, and
  the harness confirms they render and that `break-inside: avoid` keeps the large
  one whole.
<!-- SECTION:NOTES:END -->

## Why the print stylesheet cannot recolour a mermaid diagram (measured 2026-09-06)

Printing from a dark palette gives a diagram with black node fills and grey
labels on otherwise-light paper. The palette override does not reach it, and the
reason is not inline `style` attributes — it is specificity.

`mermaid.initialize({ theme })` bakes the colours in at render time, and
`compileCSS` (mermaid 11.16.0, `dist/mermaid.core.mjs`) prefixes **every rule it
emits with the SVG's own id**, so the `<style>` element inside the SVG holds
rules shaped like `#mermaid-svg-0 .node rect { fill: … }` — specificity
**(1,1,1)**. An external rule cannot reach that: no number of classes outranks a
single id, the id is generated (`mermaid-svg-${renderSeq++}`) so it cannot be
written into a stylesheet, and `svg[id^="mermaid-svg-"]` is an attribute
selector, which counts as a class rather than an id. Cascade layers do not help
either — mermaid's `<style>` is unlayered, as is ours, so specificity still
decides.

**So a CSS fix would require `!important`, and it would also have to name
mermaid's internal class names.** Both are costs the alternative avoids:
rendering a second, light-themed copy for print needs neither, and needs no
print-timing hook (there is none to rely on — decision-13). That is the option
this task should take if the diagram's print appearance is to be fixed at all.
