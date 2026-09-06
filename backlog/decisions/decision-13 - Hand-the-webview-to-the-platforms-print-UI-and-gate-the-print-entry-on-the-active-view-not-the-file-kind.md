---
id: decision-13
title: >-
  Hand the webview to the platform's print UI and gate the print entry on the
  active view, not the file kind
date: '2026-08-28 03:15'
status: accepted
---
## Context

The request was to print rendered markdown, and to be able to get a PDF out. Both
halves are one call: mallow has no print code and will write none, because every
desktop WebView already carries a print UI whose PDF destination is one of its own
entries. What has to be decided is not how to paginate but **where the boundary
falls** — what mallow calls, what it draws, what it refuses to offer, and which
screen states the call is allowed from.

The word "print" names four different things in this feature, and answering the
request without separating them produces a README that promises a mallow feature
which does not exist. The referent table fixed them before this text: **the print
call** (a mallow Rust command invoking `WebviewWindow::print()`), **the platform's
print UI** (the sheet, preview or dialog the OS or engine puts on screen, of which
mallow draws no pixel), **the print UI's PDF destination** (macOS "Save as PDF",
Windows "Microsoft Print to PDF", Linux "Print to File" — inside that UI, not in
mallow), and **the paper being readable** (the body present on every page with its
layout intact). The term "PDF export" is dropped: it reads as a mallow menu item.

Three facts about the mechanism constrain everything below, and all three come
from reading the pinned sources rather than the docs — `WebviewWindow::print()`'s
own doc comment says "Currently only supported on macOS on `wry`" while wry 0.55.1
implements all three backends, the same docs-versus-pinned-source disagreement
TASK-11.1 hit.

- **One call takes three structurally different routes.** macOS builds an
  `NSPrintOperation` (`wry/src/wkwebview/mod.rs:858`), Windows literally evaluates
  `window.print()` (`webview2/mod.rs:1712`), Linux runs GTK's
  `PrintOperation::run_dialog` (`webkitgtk/mod.rs:679`). **`window.print()` is
  reached on Windows alone**, so JS print events cannot be assumed to fire, in the
  same shape as decision-9's finding that a parent-registered listener runs on
  WebView2 only.
- **There is no JS API.** `@tauri-apps/api` exposes no print, so the entry is a
  custom Rust command, outside capability gating like mallow's others.
- **What the engine paginates is the whole `<body>`** — explorer, toolbar, footer
  and settings modal included. The body worth printing is a part of it, and the
  size of that gap is the print-stylesheet work itself, which is why this decision
  does not attempt it. **How large that gap turned out to be is in the
  Consequences below**: measured on macOS, the `<body>` is one viewport tall by
  construction, so the gap is not a margin around the document but nearly the
  whole page.

Two questions this decision deliberately leaves open are named at the end: page
margins and headers/footers. Both are unanswerable before measurement, and margins
in particular have a second layer under them — macOS's route sets all four print
margins to `0.0` and writes them into `NSPrintInfo::sharedPrintInfo()`, which is
application-wide, while Windows and Linux let their print UI decide.

## Decision

### mallow calls the platform's print UI and draws nothing

A Rust command hands the calling webview window to `WebviewWindow::print()`. That
is the whole of the print call. mallow contributes no print preview, no page
setup, no paper size, no destination picker, and **no PDF export**: getting a PDF
means choosing the PDF destination inside the platform's print UI, and mallow
neither knows nor records that a PDF was produced. **Neither the code, the README
nor the release notes may use a phrase that reads as a mallow PDF feature** — the
capability is real and the reader should be told it exists, but told where it
lives.

The command is named **`print_window`**, not `print_document`. Its argument is the
webview window and its effect is on the whole `<body>`; a name promising a document
would be false at the boundary that matters most here, and would stay false after a
print stylesheet lands, because CSS changes what is painted and not what the engine
paginates.

### The entry is `File > Print…` and `CmdOrCtrl+P`, and nothing in the toolbar

The toolbar is rejected as an entry: printing is a file operation, the toolbar is
already the busiest surface in the window, and no platform puts print there.

**Linux is refused outright, added 2026-09-07 after measurement.** The GTK dialog
opens and never returns: the compositor reports mallow as not responding, Wait does
nothing, the dialog's own Cancel cannot be pressed, and Force Quit is the only way
out. Reproduced with a real network printer configured and under a
`--debug --no-bundle` build, so it is neither a missing-printer nor a dev-server
artefact. `PrintOperation::run_dialog` is synchronous and wry calls it on the main
thread, which is consistent with the window never servicing another event.

**A feature that costs the user their session is worse than an absent one**, so
`print_window` refuses on Linux at compile time — a `cfg`, not a runtime platform
test, because a platform test that answered wrongly would hand back the hang. The
frontend may stop offering the entry as well; that is a nicety and the Rust guard
is the boundary. **The File menu's `Print…` has to be disabled on Linux too**,
which is work for the task that adds the menu.

**The menu item arrives with the File menu, not before it.** mallow's macOS menu
today has `mallow` and `Edit` submenus and no `File` submenu at all, and the task
that puts a File menu on all three platforms is where one more item costs a few
lines. Until then the accelerator is the entry on **all three platforms** — the
measurement task ships it alone. This is a sequencing consequence, not a second
policy: the end state is the item plus the accelerator everywhere.

### The gate is one sentence, and it is not about `file.kind`

**`Print…` is disabled unless the active view is markdown in preview.**

That sentence answers three separately-raised questions at once — what happens on
non-markdown views, what happens in the config/source/table/XML/HTML/mermaid/media
views, and what happens while the preview↔source toggle is on source — and it is
written as one mechanism because the answers landed on one. It is also the form
that satisfies the standing requirement to be able to *name* the mechanism that
puts something out of scope (TASK-11.3's lesson 0b), so **this sentence is used
verbatim in the README** rather than restated per view.

**It cannot be implemented as `file.kind === 'markdown'`.** Markdown itself has two
states, and `Print…` must be disabled in one of them; separately, one kind no
longer implies one view — a `.plist` picks its view from its text and `html` owns a
rendered/source toggle. The condition is therefore evaluated against the view that
is mounted and the state it is in, which in practice means `MarkdownView` being
mounted with its `mode` at `preview`. Putting the accelerator inside that component
is what makes the condition structural rather than a copy of it kept in sync: a
view that cannot be printed does not register an entry.

**Where no menu item exists yet, the accelerator is simply inert** — pressing it
reaches no print call. "Disabled" describes how the menu item looks, and there is
nothing on screen to grey out until the File menu lands; an acceptance criterion
written before then has to be written about the accelerator doing nothing, not
about an appearance.

### Paper is printed light, on every palette

`@media print` pins the light palette and **disables Shiki's `--shiki-dark`
swap**, which is part of this decision and not a detail of it: the dark code
background is emitted as an inline custom property, so a stylesheet that fixes the
page palette and forgets the swap prints dark code blocks onto a light page.

The reason was written as ink and legibility, and it was the one point here taken
as a judgement ahead of its observation. **The observation (macOS, 2026-09-06) is
stronger than the argument was, and it is legibility rather than economy.** The
dark background did not reach paper at all — WebKit's default
`print-color-adjust` drops it — so the palette's light ink landed on an unprinted
white ground and the text came out faint. The rule therefore costs no ink to
begin with, and what it buys is a page that can be read. Windows and Linux are
unmeasured; if either does print the background, the ink argument returns for
that platform and the rule already covers it.

### `@page` is written for what macOS measured; headers and footers stay unanswered

- **Margins — answered in part on 2026-09-06, and `@page` is now written.**
  The prohibition below stood while nothing was measured. macOS then measured it:
  the print operation's own margins really are zero, so leaving the paper to the
  print UI puts text at the sheet's edge there. `print.scss` ships
  `@page { margin: 16mm }`, which is the one voice three engines can be given.
  **What is still open is the interaction, not the value**: Windows and Linux let
  their print UI reserve a margin of their own, and whether `@page` composes with
  that or fights it is unmeasured. The original reasoning is kept below because it
  is still why the value was not written before the first measurement.
  > Whether mallow sets `@page { margin }` or leaves the paper to the print UI.
  > Leaving it produces three different pages, because macOS's route zeroes the
  > print operation's own margins and the other two do not; setting it collides
  > with a layer CSS cannot see. `@page` is the only place one voice can be given
  > to three engines, which is exactly why it must not be written on a guess.
- **Headers and footers.** Page numbers, document name, date. `@page`'s margin
  boxes (`@top-center` and friends) have uneven engine support. **Where support is
  uneven, the answer falls to not printing them**, because three different sheets
  of paper is a worse outcome than none of the three carrying a page number.
  **This governs what mallow asks for, not what reaches the paper**: measured
  2026-09-07, Windows prints WebView2's own header and footer — date, document
  title, URL and page numbers — which the reader can switch off in the print UI
  and CSS cannot suppress. So the three sheets differ anyway, on a layer this
  decision does not reach.

Whether macOS's write into the application-wide `sharedPrintInfo` persists across
two prints in one session is part of the same measurement. **The first attempt
(2026-09-06) did not settle it**: a setting changed on the first sheet was gone
on the second, but the setting exercised was `pages per sheet`, which is not one
of the four margins wry writes — so what it shows is that `NSPrintInfo` state
does not obviously persist, not that the margins do not. It has to be re-run
against a margin.

### Acceptance is judged on paper, never on the return value

An acceptance criterion here is about the paper being readable — the body on every
page with its layout intact — and at most secondarily about the print UI appearing.
**It is never about what `print_window` returns**, and that is not a general
scruple about exit codes: on macOS the route is guarded by
`respondsToSelector(printOperationWithPrintInfo:)` and **returns `Ok(())` having
done nothing** when that guard fails, so a successful call is not evidence that
anything appeared. Windows returns before the JS it evaluated has run, and Linux
opens its dialog with a `None` parent, so the dialog need not be in front of
mallow. The screen and the sheet of paper are the only witnesses.

## Consequences

- **Printing is markdown-only in this milestone, and the boundary is a named
  mechanism rather than a list.** Extending it to another view means making that
  view's active state satisfy the same sentence — the source view is the natural
  next one, since decision-6 makes it every view's shared fallback.
- **The two rounds were separate tasks and are no longer.** The measurement task
  deliberately shipped the print call without `@media print`, which is what turned
  the gap into a measured number rather than an estimate — and it also produced a
  branch that reaches a print UI and prints an unusable page. **That is not a
  deliverable**, so TASK-28's stylesheet lands beside TASK-27 rather than after it
  (2026-09-06). The measurement still came first, and still had to.
- **The settings modal is part of the shell, not part of the gate.** It can be open
  while a markdown preview is mounted, so the accelerator will fire under it. The
  fix belongs in `@media print` with the rest of the shell; widening the gate to
  ask about modals would make the one sentence above untrue of itself.
  **Measured on macOS: the modal does not overlay the document on paper, it
  erases it** — its backdrop covers the viewport and printed as opaque white, so
  the modal was essentially the whole page. The removal has to take the backdrop
  and not only the panel.
- **`.doc-scroll` clips the paper to what is on screen — measured on macOS
  (2026-09-06), unmeasured on Windows and Linux.** The paper came out as a single
  A4 page: the print sheet's own preview said `Page 1 of 1` before any user
  setting, and the fixture's last-page marker was absent. **The cause is the app's
  height chain rather than the print call** — `html, body, #root { height: 100% }`
  → `.app { height: 100% }` → `.app__body { flex: 1 1 auto; min-height: 0 }` →
  `.doc-scroll { flex: 1 1 auto; min-height: 0; overflow: auto }` makes the
  `<body>` exactly one viewport tall by construction, so paginating it yields one
  page whatever the document's length. **So releasing `.doc-scroll` alone is not
  the print stylesheet's first job; releasing the whole chain is.** The same run
  showed the page cropped horizontally as well — content laid out at window width
  and cut at the paper's edge rather than scaled to it — so **the content also has
  to reflow to the paper's width**. What imposes that width is not isolated: the
  run shows the cropping, not its cause, and `.doc`'s `max-width: 1180px` is not
  it, sitting above A4's ~794 CSS px.
- **The paper carries the app shell, and on macOS the shell is nearly all of
  it.** The sentence above about `<body>` being what the engine paginates stands;
  what the first measurement adds is proportion. The shell is not framing a
  printed document — with the height chain in place there is no printed document
  past the first screen to frame.
- **A print stylesheet must not go into `index.html`.** An inline `<style>` there
  makes tauri-codegen add a hash to `style-src`, which retires its
  `'unsafe-inline'` and breaks Shiki, mermaid and every inline `style` attribute at
  once. `src/styles/print.scss` is the file, imported last so its palette
  overrides win on source order at equal specificity. It also must not remove
  `.toolbar`'s compositing layer (`will-change: transform`), which is load-bearing
  for dropdown paint order — what shipped hides the toolbar outright inside
  `@media print`, which reaches the same paper without touching the screen's paint
  order at all.
- **The stylesheet carries no pagination constraint at all** — no
  `break-inside: avoid`, `break-after: avoid`, `orphans` or `widows`. They were
  written and then removed while the macOS truncation was being chased, on the
  reasoning that they are presentation and what they might be costing was content
  (decision-6). Removing them changed nothing, and the cause turned out to be
  elsewhere entirely, so **their absence is now a state nothing has printed
  against rather than a finding**. Reintroducing any of them is its own change
  with its own reprint.
  What was learned while they were there is worth keeping: `.mermaid` is the
  `<pre>` holding a diagram's source and `.mermaid-rendered` is what replaces it,
  so a rule naming the former applies to a `<pre>` and misses every diagram that
  drew; `figure` and a bare `svg` match nothing worth protecting, since
  `html: false` emits no `<figure>` and the body's only other SVG is a GFM alert
  icon; and `table` is actively worse with it, because a 21-row table half a page
  from the bottom went whole onto the next sheet and left half a page blank while
  a split table repeats its `<thead>` anyway.
- **Code wraps in print, and not wrapping it cost more than a lost line.**
  `overflow: visible` does not wrap `white-space: pre`, so an over-wide code line
  ran past the page — and content wider than the page makes the engine shrink the
  whole document to fit, so every page carried smaller type than intended. Every
  macOS run recorded before that fix was scaled down, which is why their page
  counts are not comparable with a later reprint.
- **Printing from a dark palette gives monochrome code, and that is a limitation
  rather than a choice.** Shiki's dark tokens are inline `--shiki-dark` custom
  properties applied with `!important`, which outranks the inline light colour
  beside them; CSS cannot un-apply a declaration, so there is no value that
  restores the light token. Inheriting the body ink is the readable outcome
  available. Emitting `--shiki-light` from the pipeline would fix it and would
  change what every code block renders on screen, so it belongs to its own
  decision.
- **A headless-Chrome harness checks the stylesheet and cannot stand in for the
  measurement.** `_sandbox/handoff/task-27/harness/run.sh` prints the fixture
  through the app's own pipeline with the real compiled CSS, and it earns its
  keep — it caught a selector that compiles and matches nothing (`@include
  on-dark` at the top level emits `:scope`) and the wasted page above. But its
  control run paginates the unstyled page into 16, so **Chrome never had the
  one-page failure being fixed**, and only a reprint on the three WebViews says
  whether the paper is readable.
- **Nothing automated can show that any of this works.** Biome and Vitest do not
  read SCSS, no test harness can open a platform print dialog, and `src/probe/` is
  a counter-and-table instrument while the evidence here is a screenshot and a PDF.
  Green says nothing about printing; a written procedure and a reported observation
  from each of the three platforms is the check.
- **Print events in JS are not a design surface.** They may fire on Windows and not
  elsewhere. Anything that needs the DOM rearranged before printing must do it
  synchronously in the frontend before the print call, never in a handler.
- **A second entry point is now cheap and a second gate is not.** Adding the menu
  item is a few lines because the condition it reads already exists; adding a
  toolbar button or a context-menu entry would each need to read the same
  condition, and the sentence above is what they must read rather than re-derive.
