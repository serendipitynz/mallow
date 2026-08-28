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
  does not attempt it.

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

The reason is ink and legibility, and it is the one point here taken as a judgement
ahead of its observation. So the measurement is required to cover **both palettes**
— light and dark — and to record whether a dark background reaches paper at all.
If it does not, this rule costs nothing and is kept for the code-block case; if it
does, the observation is what the rule rests on. Either way the claim stops being
an assumption.

### Two questions stay open, and `@page` is not written before they are answered

- **Margins.** Whether mallow sets `@page { margin }` or leaves the paper to the
  print UI. Leaving it produces three different pages, because macOS's route zeroes
  the print operation's own margins and the other two do not; setting it collides
  with a layer CSS cannot see. `@page` is the only place one voice can be given to
  three engines, which is exactly why it must not be written on a guess.
- **Headers and footers.** Page numbers, document name, date. `@page`'s margin
  boxes (`@top-center` and friends) have uneven engine support. **Where support is
  uneven, the answer falls to not printing them**, because three different sheets
  of paper is a worse outcome than none of the three carrying a page number.

Whether macOS's write into the application-wide `sharedPrintInfo` persists across
two prints in one session is part of the same measurement.

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
- **The paper carries the app shell until a print stylesheet lands.** The
  measurement task deliberately ships the print call without `@media print`, so the
  first sheets of paper show explorer, toolbar, footer and scrollbars. That is the
  measured size of the stylesheet's job, and it is why the two rounds are separate
  tasks rather than one.
- **The settings modal is part of the shell, not part of the gate.** It can be open
  while a markdown preview is mounted, so the accelerator will fire under it. The
  fix belongs in `@media print` with the rest of the shell; widening the gate to
  ask about modals would make the one sentence above untrue of itself.
- **`.doc-scroll` may clip the paper to what is on screen, and this is unmeasured.**
  The scroll container's height is bounded by its flex parent. If it clips,
  releasing it inside `@media print` is the print stylesheet's first job; if it does
  not, nothing is needed. Either answer is an observation, not an inference from the
  CSS.
- **A print stylesheet must not go into `index.html`.** An inline `<style>` there
  makes tauri-codegen add a hash to `style-src`, which retires its
  `'unsafe-inline'` and breaks Shiki, mermaid and every inline `style` attribute at
  once. It also must not remove `.toolbar`'s compositing layer
  (`will-change: transform`), which is load-bearing for dropdown paint order —
  neutralise it inside `@media print` only.
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
