---
id: TASK-30
title: Write PDF from the print pipeline so a page can leave mallow on every platform
status: To Do
assignee: []
created_date: '2026-09-07 08:55'
labels:
  - feature
milestone: m-3
dependencies:
  - TASK-28
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-13 said mallow would contribute no PDF export, because every desktop WebView already carries a print UI whose PDF destination is one of its own entries. **That reasoning was sound and TASK-27 removed its premise**: the print path is clean on Windows, loses the end of a long document on macOS, and hangs hard enough on Linux that `print_window` refuses there. All three sit in wry's implementation behind a `WebviewWindow::print()` that takes no arguments, so none is reachable from CSS or from Tauri's API — four attempts to reach the macOS one from the stylesheet failed, and a fifth predicted the size of the loss correctly while still naming the wrong cause.

So mallow writes the PDF itself, through each platform's print *pipeline* rather than its print *dialog*. decision-14 is the contract; this is the work.

**Printing stays.** Two entries side by side, and this is not a replacement — printing works on Windows without caveat, and **on Linux this export is the only way to get a page out of mallow at all.** That is a platform difference, and the README says it in TASK-12.6's sections rather than here.

**The criterion that decides the macOS implementation is whether `@media print` applies.** `WKWebView.createPDF` renders the view's own content and may not go through the print pipeline; if it does not, the PDF carries the explorer and the toolbar and TASK-28's whole stylesheet is inert. An `NSPrintOperation` with `NSPrintInfo.jobDisposition = .save` writes through the pipeline, so the stylesheet applies by construction — **that is the intended API**, and it carries a second reason: wry runs its print operation off `NSPrintInfo::sharedPrintInfo()`, an application-wide singleton it mutates on every print, and a stale page count is the kind of state such a singleton would hold. **A fresh `NSPrintInfo` may therefore avoid TASK-27's truncation too — as a hypothesis.** The cause was never isolated, so a clean export is not proof of it and a truncated one is not a regression against it. Windows' `PrintToPdfAsync` and WebKitGTK's print-to-file should both apply print styles; "should" is why AC #1 checks rather than assumes.

**The chord has to be consumed even when the export is refused.** This is the one rule TASK-27 paid for twice: the print handler lived inside the printable view, so an unprintable view registered nothing — and WebView2's own `Ctrl+P` printed a `.csv`. Registering no handler does not make a chord inert; it concedes it to the platform. Whether any engine binds `Ctrl+E` is unmeasured, and consuming it means that never has to be answered. `lib/print` already holds the shape to follow, including the three-way decision whose `suppress` case is the one that was missing.

**The gate is printing's sentence with a different reason behind it.** `Export as PDF…` is disabled unless the active view is markdown in preview — but not because the body worth exporting is markdown, which is printing's reason. It is because **the print stylesheet is markdown-only**: a PDF of a table view or an XML tree would be paginated by rules written for `.markdown-body`, and nothing has looked at that paper. **A later request to export other views is therefore a request to widen the stylesheet, not the entry** (decision-6 makes the source view the natural place to start).

**Nothing automated will verify the paper.** No harness opens a print pipeline, and the headless-Chrome harness in `_sandbox/handoff/task-27/harness/` reproduces none of the three engines — its control run paginates the unstyled page into 16, so it never had the failure TASK-27 chased. What can be automated is the chord decision, which is where TASK-27's tests ended up after review found that a green suite had covered the classifier and not what the handler does with the event.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Whether @media print applies is verified on each platform BEFORE its implementation is called done, because a PDF carrying the explorer and the toolbar is the failure to look for and TASK-28's stylesheet is inert if it does not apply. On macOS this is what decides between NSPrintOperation with a save disposition and WKWebView.createPDF - decision-14 intends the former for exactly this reason
- [ ] #2 File > Export as PDF... and CmdOrCtrl+E both reach the export, and the destination is chosen by the reader through a save dialog rather than written to a default location
- [ ] #3 The CmdOrCtrl+E handler consumes the chord even where the export is refused, the way the print chord does. Registering nothing concedes a chord to the platform - that is what let WebView2 print a .csv in TASK-27 - and whether any engine binds Ctrl+E is unmeasured, which consuming it makes moot
- [ ] #4 Export as PDF... is disabled unless the active view is markdown in preview - the same sentence as Print..., recorded with its own reason (the print stylesheet is markdown-only) rather than as a copy of printing's
- [ ] #5 A PDF written on macOS, Windows and Linux each reaches the document's last page and carries no part of the app shell. This is the criterion TASK-28's AC #1 and #9 could not meet on the print path
- [ ] #6 No platform print UI appears at any point in the export - not a sheet, not a preview, not a dialog. On Linux that is also what keeps the export away from the hang that made print_window refuse there
- [ ] #7 The Rust command is write_window_pdf, named for the window for the reason print_window is not print_document: the engine paginates the whole body and @media print only changes what is painted
- [ ] #8 The new platform dependencies are the smallest set that works, one per platform and each behind its own cfg, and pnpm notices is regenerated because THIRD-PARTY-NOTICES.md is bundled
- [ ] #9 Whether the macOS export also avoids the stale page count is recorded as an observation either way. decision-14 prefers this API partly because a fresh NSPrintInfo may avoid it, and that is a hypothesis - the cause was never isolated, so a clean export is not proof and a truncated one is not a regression
<!-- AC:END -->
