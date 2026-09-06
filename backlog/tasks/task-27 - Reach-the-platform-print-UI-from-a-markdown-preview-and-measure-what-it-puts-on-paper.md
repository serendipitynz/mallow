---
id: TASK-27
title: >-
  Reach the platform print UI from a markdown preview and measure what it puts
  on paper
status: In Progress
assignee: []
created_date: '2026-08-28 03:17'
updated_date: '2026-09-06 02:29'
labels:
  - feature
milestone: m-3
dependencies: []
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Printing rendered markdown was asked for, and nothing in the tree reaches a print UI. decision-13 settles the boundary: mallow's Rust command hands the calling webview to `WebviewWindow::print()` and draws no pixel of what appears, the entry is `File > Print…` plus `CmdOrCtrl+P` with nothing in the toolbar, and `Print…` is disabled unless the active view is markdown in preview. This task builds the smallest thing that can be printed at all and then measures what comes out, because the measurement can contradict the premise: if a platform puts no UI on screen, or puts unusable paper out, the scope of printing changes rather than its styling.

**The print call takes three structurally different routes, and only one of them is `window.print()`.** macOS builds an `NSPrintOperation` (`wry/src/wkwebview/mod.rs:858`), Windows evaluates `window.print()` literally (`webview2/mod.rs:1712`), Linux runs GTK's `PrintOperation::run_dialog` with a `None` parent (`webkitgtk/mod.rs:679`). Tauri's own doc comment claims macOS-only support while the pinned wry implements all three - the same docs-versus-pinned-source disagreement TASK-11.1 hit, so the pinned source is what this rests on. The asymmetry has the shape decision-9 established for parent-registered listeners, which is why JS print events are not a design surface here.

**A returned `Ok(())` is not evidence.** macOS's route is guarded by `respondsToSelector(printOperationWithPrintInfo:)` and returns `Ok(())` having done nothing when that guard fails; Windows returns before the evaluated JS has run; Linux's dialog has no parent window, so it need not be in front of mallow. Every acceptance criterion here is written about the screen or the sheet of paper.

**The gate cannot be `file.kind === 'markdown'`.** Markdown has two states and one of them must not print, and one kind no longer implies one view anyway (`.plist` picks its view from its text, `html` owns a rendered/source toggle). The condition is `MarkdownView` mounted with `mode` at `preview`, and putting the accelerator inside that component is what makes it structural instead of a copy kept in sync. Because no `File` submenu exists yet on any platform - mallow's macOS menu has `mallow` and `Edit` only - the accelerator is the whole entry in this task, on all three platforms, and TASK-12.4 adds the item and its disabled appearance. So AC #2 is written about the accelerator being inert, not about anything looking greyed out.

**No print stylesheet lands here, deliberately.** What the engine paginates is the whole `<body>`, explorer and toolbar and footer and settings modal included, and the size of that gap is the print stylesheet's whole job. Shipping the call without `@media print` is what turns that gap into a measured number for TASK-28 instead of an estimate. decision-13 also forbids writing `@page` before the margins are measured: macOS's route zeroes all four print margins and writes them into the application-wide `NSPrintInfo::sharedPrintInfo()`, while Windows and Linux leave it to their print UI, so leaving margins alone and setting them are both wrong until measured. Whether `.doc-scroll` clips the paper to what was on screen is unmeasured and is one of the things to look for. **(Measured on macOS 2026-09-06: it does, and the paper is one page — see the Implementation Notes. Windows and Linux remain unmeasured.)**

**The fixture has to create both states of everything it tests.** A document that fits on one page cannot show whether a code block, a table or a mermaid SVG survives a page break, so the fixture spans several pages and puts each of those elements once across a break and once clear of one (TASK-22's lesson, applied to two axes here rather than one). The measurement is also run on a light and a dark palette, because decision-13's light-only rule was taken as a judgement ahead of its observation and this is where the observation is taken.

**Nothing automated can check any of this.** Biome and Vitest do not read SCSS, no harness opens a platform print dialog, and `src/probe/` is a counter-and-table instrument while the evidence here is a screenshot and a PDF - so this task carries a written procedure and reported observations from all three platforms rather than a green suite. Reports go to `_sandbox/handoff/task-27/`, which is outside git; the conclusions come back into this task's Implementation Notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CmdOrCtrl+P in a markdown preview brings the platform print UI on screen on macOS, Windows and Linux - observed on screen on each, since print_window returns Ok(()) on macOS even where its respondsToSelector guard fails
- [ ] #2 CmdOrCtrl+P reaches no print call when the active view is not a markdown preview: covering the source half of the toggle and at least one non-markdown view. Written about the accelerator being inert, not about a disabled menu item - no menu item exists until TASK-12.4
- [ ] #3 A fixture in _sandbox/samples/ spans several printed pages and puts a code block, a table, a mermaid diagram, an image and a heading both across a page break and clear of one, so the two states are comparable within one file
- [ ] #4 The paper (or the PDF the print UI's own destination writes) is inspected on all three platforms and what it holds is recorded: whether the body reaches the last page or is clipped to what was on screen, and which shell elements appear on it
- [x] #5 Both palettes are measured on at least one platform and whether a dark background reaches paper is recorded, so decision-13's light-only rule rests on an observation rather than on the ink argument alone
- [ ] #6 Printing twice in one session on macOS is checked for the first print's margins persisting, since that route writes into the application-wide NSPrintInfo sharedPrintInfo
- [x] #7 No @page rule and no @media print block is added here - the print stylesheet is TASK-28, and decision-13 forbids writing @page before the margins are measured
- [ ] #8 The report says what TASK-28 has to do: which elements need break-inside/break-after, which shell elements need removing, and whether .doc-scroll has to be released
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## macOS leg measured (2026-09-06) — the paper is one page, and the cause is in the app's own height chain

macOS 26.6.2, WKWebView, `pnpm tauri dev`, A4, default scale, HEAD `8e8e79f`.
Reports and PDFs: `_sandbox/handoff/task-27/mac/` (outside git).
**Windows and Linux are unmeasured**, so nothing below is stated of them.

**The print UI appeared and it is the native one.** A `NSPrintOperation` sheet
attached to the window, immediately, with no `print failed` on the console — the
`respondsToSelector` guard passed, so the silent-success path was not taken here.

**The paper is one page.** The sheet's own preview said `Page 1 of 1` before any
user setting, `Layout: 1 page per sheet`, and all three PDFs carry a single page
at A4 (`MediaBox [0 0 595.2756 841.8898]`). §12, the fixture's last-page marker,
is absent, so **`.doc-scroll` does clip the paper to what was on screen** — the
question decision-13 listed as unmeasured, now answered for one platform.

**The cause is not the print call but the app's height chain, and it is visible
in the CSS.** `html, body, #root { height: 100% }` (`global.scss:58-62`) →
`.app { height: 100% }` (`app.scss:3-7`) → `.app__body { flex: 1 1 auto;
min-height: 0 }` (`app.scss:149-153`) → `.doc-scroll { flex: 1 1 auto;
min-height: 0; overflow: auto }` (`markdown.scss:5-9`). **The `<body>` is exactly
one viewport tall by construction**, so paginating it yields one page whatever
the document's length. This refines rather than contradicts what was written
before: the engine does paginate the `<body>` and the paper does carry the app
shell, but the shell is not framing the document — it is nearly all of what
reaches paper.

**The page is cropped horizontally as well.** Content was laid out at window
width and cut at the A4 edge rather than scaled down to it: table columns and
sentences end mid-character on the right. So releasing the height chain alone
would not be enough — the width the shell imposes has to go too.

**A dark palette prints as pale text on white, which is worse than costly.** The
background did not reach paper at all (WebKit's default `print-color-adjust`
drops it), so a dark palette's light ink lands on an unprinted white ground and
the text comes out faint. decision-13 fixed the paper to light on an ink
argument taken ahead of its observation; **the observation is stronger than the
argument was** — this is legibility, not economy.

**The settings modal erases the document rather than overlaying it.** Its
backdrop covers the viewport and printed as opaque white, so the modal is
essentially all that is on the page. Confirms that the modal belongs in
`@media print`'s removals rather than in the entry's gate, as decision-13 said,
and raises its priority.

**Margins looked ~0**, consistent with wry writing `PrintMargin::default()` into
`NSPrintInfo::sharedPrintInfo()`.

**AC #6 is only partly answered.** A setting was changed on the first sheet and
was gone on the second — but the setting exercised was `pages per sheet`, which
is **not one of the four margins wry writes**. So what the run shows is that
`NSPrintInfo` state does not obviously persist; it does not yet show that the
margins do not. Re-run it against a margin to close this.

## What this settles for TASK-28, so far

- **Release the height chain, not just `.doc-scroll`** — all five rules above are
  in the way, and `.doc-scroll` alone would still sit inside a `100%`-tall body.
- **Remove the shell** — explorer, toolbar, `.doc__bar`, footer, and the settings
  modal *with its backdrop*.
- **Release the width** — `.doc`'s `max-width` and the explorer's fixed width,
  or the page stays cropped rather than reflowed.
- **The light-only rule is confirmed, with a better reason to write down.**
- **Page-break behaviour is still unmeasured**, because nothing reached a second
  page. `break-inside` / `break-after` cannot be judged until the height chain is
  released, so that part of AC #8 waits on TASK-28's first draft rather than on
  more measurement here.
<!-- SECTION:NOTES:END -->
