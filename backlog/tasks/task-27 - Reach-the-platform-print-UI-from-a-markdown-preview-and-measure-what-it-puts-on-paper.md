---
id: TASK-27
title: >-
  Reach the platform print UI from a markdown preview and measure what it puts
  on paper
status: In Progress
assignee: []
created_date: '2026-08-28 03:17'
updated_date: '2026-08-28 03:24'
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

**No print stylesheet lands here, deliberately.** What the engine paginates is the whole `<body>`, explorer and toolbar and footer and settings modal included, and the size of that gap is the print stylesheet's whole job. Shipping the call without `@media print` is what turns that gap into a measured number for TASK-28 instead of an estimate. decision-13 also forbids writing `@page` before the margins are measured: macOS's route zeroes all four print margins and writes them into the application-wide `NSPrintInfo::sharedPrintInfo()`, while Windows and Linux leave it to their print UI, so leaving margins alone and setting them are both wrong until measured. Whether `.doc-scroll` clips the paper to what was on screen is unmeasured and is one of the things to look for.

**The fixture has to create both states of everything it tests.** A document that fits on one page cannot show whether a code block, a table or a mermaid SVG survives a page break, so the fixture spans several pages and puts each of those elements once across a break and once clear of one (TASK-22's lesson, applied to two axes here rather than one). The measurement is also run on a light and a dark palette, because decision-13's light-only rule was taken as a judgement ahead of its observation and this is where the observation is taken.

**Nothing automated can check any of this.** Biome and Vitest do not read SCSS, no harness opens a platform print dialog, and `src/probe/` is a counter-and-table instrument while the evidence here is a screenshot and a PDF - so this task carries a written procedure and reported observations from all three platforms rather than a green suite. Reports go to `_sandbox/handoff/task-27/`, which is outside git; the conclusions come back into this task's Implementation Notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CmdOrCtrl+P in a markdown preview brings the platform print UI on screen on macOS, Windows and Linux - observed on screen on each, since print_window returns Ok(()) on macOS even where its respondsToSelector guard fails
- [ ] #2 CmdOrCtrl+P reaches no print call when the active view is not a markdown preview: covering the source half of the toggle and at least one non-markdown view. Written about the accelerator being inert, not about a disabled menu item - no menu item exists until TASK-12.4
- [ ] #3 A fixture in _sandbox/samples/ spans several printed pages and puts a code block, a table, a mermaid diagram, an image and a heading both across a page break and clear of one, so the two states are comparable within one file
- [ ] #4 The paper (or the PDF the print UI's own destination writes) is inspected on all three platforms and what it holds is recorded: whether the body reaches the last page or is clipped to what was on screen, and which shell elements appear on it
- [ ] #5 Both palettes are measured on at least one platform and whether a dark background reaches paper is recorded, so decision-13's light-only rule rests on an observation rather than on the ink argument alone
- [ ] #6 Printing twice in one session on macOS is checked for the first print's margins persisting, since that route writes into the application-wide NSPrintInfo sharedPrintInfo
- [ ] #7 No @page rule and no @media print block is added here - the print stylesheet is TASK-28, and decision-13 forbids writing @page before the margins are measured
- [ ] #8 The report says what TASK-28 has to do: which elements need break-inside/break-after, which shell elements need removing, and whether .doc-scroll has to be released
<!-- AC:END -->
