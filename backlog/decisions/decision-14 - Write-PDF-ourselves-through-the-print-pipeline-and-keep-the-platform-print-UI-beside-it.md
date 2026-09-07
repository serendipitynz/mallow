---
id: decision-14
title: >-
  Write PDF ourselves through the print pipeline, and keep the platform print UI
  beside it
date: '2026-09-07 10:30'
status: accepted
---
## Context

decision-13 settled the print boundary and said one thing that is no longer going
to be true: **"mallow contributes … no PDF export"**, on the reasoning that every
desktop WebView already carries a print UI whose PDF destination is one of its own
entries, so getting a PDF was the platform's business and naming it a mallow
feature would promise something that did not exist.

**That reasoning was sound and its premise is gone.** TASK-27 measured the print
path on all three platforms and printing works cleanly on exactly one of them:

- **Windows** prints the whole document correctly, and adds WebView2's own header
  and footer — date, title, URL, page numbers — which the reader can switch off
  and CSS cannot.
- **macOS** loses the end of a long document. The print sheet computes a page
  count, the PDF export honours that count, and a layout needing more pages simply
  stops. Switching printers in the sheet forces the recalculation and the export
  then matches, which is the workaround a reader has to be told about.
- **Linux** hangs. The GTK dialog opens and never returns — Wait does nothing, its
  own Cancel cannot be pressed, Force Quit is the only way out — so
  `print_window` refuses there outright.

**All three sit in wry's implementation, behind a `WebviewWindow::print()` that
takes no arguments**, so none of them is reachable from CSS or from Tauri's API.
Four attempts to reach the macOS one from the stylesheet each failed, and the
fifth predicted the size of the loss correctly while still naming the wrong cause.

So the question is no longer whether a PDF is the platform's business. It is that
**the one path mallow had to paper is defective on two platforms out of three and
absent on one**, and the API each platform exposes for writing a PDF directly is
not the same code as the one that opens its print dialog.

decision-13's other conclusions are untouched and this decision rests on them: the
print call, the three structurally different routes, the gate on the active view,
the refusal on Linux, and the print stylesheet's contents.

The referent table fixed the vocabulary first, because the word "PDF" now names
two things at once and only one of them is new: **PDF export** (mallow writes the
file, no print UI involved) and **the print UI's PDF destination** (an entry
inside the platform's own dialog, which mallow does not touch). Both exist in
v0.8.0. **The bare phrase "PDF output" is not used anywhere**, because it reads as
either.

## Decision

### mallow writes PDF itself, and the print entry stays

Two entries, side by side. **PDF export does not replace printing** — printing is
useful where it works, and it works on Windows without caveat. What PDF export
adds is a path that does not go through the platform's print dialog at all, which
is why it sidesteps all three defects above, and **on Linux it is the only way to
get a page out of mallow.** That is a platform difference, not a replacement.

### The entry is `File > Export as PDF…` and `CmdOrCtrl+E`, and it asks where

The menu item lands with the File menu, like `Print…` before it. `CmdOrCtrl+E` is
the accelerator.

**The destination is chosen by the reader through a save dialog**, not written to
a default location. A file appearing somewhere the reader did not name is worse
than one keystroke more, and `tauri-plugin-dialog`'s `save` is already a
dependency.

**The handler must consume the chord even when it will not export**, which is not
a preference but the rule TASK-27 paid for: the print handler used to live in the
printable view, so an unprintable view registered nothing — and WebView2's own
`Ctrl+P` then printed a `.csv`. **Registering no handler does not make a chord
inert; it concedes the chord to the platform.** Whether any of the three engines
binds `Ctrl+E` is unmeasured, and consuming it means that does not have to be
answered.

### The gate is the same sentence as printing, for a different reason

**`Export as PDF…` is disabled unless the active view is markdown in preview** —
the same condition as `Print…`, so the two entries enable and disable together.

**The reason is not the reason printing has one.** Printing is gated because the
body worth printing is the rendered markdown and because being able to *name* the
mechanism that puts a view out of scope was a requirement. PDF export inherits
neither: it is gated because **the print stylesheet is markdown-only**. A PDF of a
table view or an XML tree would be paginated by a stylesheet written for
`.markdown-body`, and nothing has looked at that paper.

**So a later request to export other views is a request to widen the print
stylesheet, not the entry.** decision-6 makes the source view every view's shared
fallback, which is where that would start. Widening the entry alone would produce
PDFs nobody has inspected.

### macOS goes through the print pipeline, not through `createPDF`

Two APIs could write the file and **they are not interchangeable**:

- `WKWebView.createPDF(configuration:)` renders the view's own content. It does
  not go through the print pipeline, so **whether `@media print` applies to it is
  the question that decides everything** — if it does not, the PDF carries the app
  shell and TASK-28's stylesheet is inert.
- An `NSPrintOperation` built with `NSPrintInfo.jobDisposition = .save` writes a
  PDF *through* the print pipeline, so the print stylesheet applies by
  construction.

**The second is the intended implementation**, and it carries a second benefit
worth naming: wry runs its print operation off `NSPrintInfo::sharedPrintInfo()`,
an application-wide singleton it mutates on every print, and **a stale page count
is exactly the kind of state such a singleton would hold**. Building a fresh
`NSPrintInfo` per export may therefore avoid the truncation as well. **That is a
hypothesis** — the cause of the stale count was never isolated — so it is a reason
to prefer this API, not a claim that the bug is fixed.

**Whether `@media print` applies is an acceptance criterion, not an assumption**,
on every platform. Windows' `PrintToPdfAsync` and WebKitGTK's print-to-file both
go through their print pipelines and should apply it; "should" is why it is
checked. A PDF carrying the explorer and the toolbar is the failure to look for.

### The command is named for the window

`write_window_pdf`, for the reason `print_window` is not `print_document`: the
engine paginates the whole `<body>` and `@media print` only changes what is
painted. `export_pdf` or `write_document_pdf` would make the same false promise
this project already rejected once.

## Consequences

- **decision-13 is not edited.** Its "no PDF export" clause is superseded by this
  decision and everything else in it stands — the same treatment decision-12 gave
  decision-8, where the earlier text stayed correct about its own subject and the
  later decision carried the change in scope. decision-13 gains a pointer here and
  nothing more.
- **`PDF export` becomes usable vocabulary**, in code, README and release notes.
  What stays banned is the bare "PDF output", which reads as either this or the
  print UI's own destination, and both exist now.
- **This is what closes TASK-28.** Its AC #1 and #9 ask for paper that reaches the
  last page on all three platforms, which the print path cannot deliver on two of
  them.
- **A new macOS-gated direct dependency arrives** (`objc2-app-kit` or equivalent),
  because Tauri exposes none of the three PDF APIs. Windows and Linux need their
  own platform code for the same reason. That is the cost of leaving wry's
  `print()` behind, and it buys a path that is correct on all three rather than one
  that is correct on one.
- **Printing keeps its defects and its documentation burden.** Two entries mean
  the README has to say when to reach for which, including that Linux has only
  one of them and that macOS printing can lose a last page. That documentation is
  TASK-12.6's, which already owns the print and shortcut sections.
- **The accelerator is a third chord the app must consume unconditionally**
  (`CmdOrCtrl+,`, `CmdOrCtrl+P`, `CmdOrCtrl+E`). The `Cmd/Ctrl+,` handler predates
  the rule and does not follow it; it is not a defect today because no engine is
  known to bind that chord, but it is the one place the codebase is inconsistent
  about this, and a task that touches it should bring it in line.
- **Nothing automated will verify the paper here either.** The same limits as
  TASK-28 apply — no harness opens a print pipeline, and the headless-Chrome
  harness does not reproduce any of the three engines' behaviour. What can be
  automated is the chord decision, which is where the print work put its tests.
