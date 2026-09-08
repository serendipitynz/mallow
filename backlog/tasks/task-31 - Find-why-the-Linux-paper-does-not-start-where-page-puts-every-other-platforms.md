---
id: TASK-31
title: >-
  Find why the Linux paper does not start where @page puts every other
  platform's
status: To Do
assignee: []
created_date: '2026-09-08 20:52'
labels:
  - bug
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-09-08 in CI (run 34216957411, `paper-linux-light.pdf` / `-dark.pdf`): **the body of the Linux paper starts at x=18pt, where every other paper starts at 45.4pt — the 16mm `@page` margin.** macOS (both the runner's Letter paper and this project's A4 one) and Windows all place it at the margin; Linux does not. The same run's other checks pass on that paper: it reaches the fixture's last section and carries no part of the app shell, so **`@media print` is reaching that arm — partly.** TASK-30's AC #1 therefore answers "yes" for macOS and Windows and "in part" for Linux.

**Do not write "the Linux paper has no margin".** Three separate layers can produce one, and only one of them is mallow's: the `@page` margin `styles/print.scss` asks for, the print operation's own margins (GTK's `GtkPageSetup`, the layer macOS's `NSPrintInfo` margins occupy), and the paper's imageable area, which is a constraint rather than a margin. What is measured is where the body starts, not which layer decided it. The referent table for this is `_sandbox/handoff/referent-table/referent-table-task-31-linux-page-margin.md` (outside git).

**Two candidates, neither of them an observation.** `pdf.rs`'s Linux arm passes a `GtkPrintSettings` (printer, output uri, output format) and **never a page setup**, so the operation's own margins are whatever the default is; and 18pt is about 6.35mm, which is the shape of a backend's imageable-area inset rather than of a CSS value. **The macOS half of this task already punished one confident diagnosis of exactly this kind** — the paper there was blamed on `@page`'s margin when the cause was the order in which the page box is computed — so this task is written to be measured rather than reasoned.

**The paper is accepted as it stands** (maintainer, 2026-09-09) and this is deliberately not in m-3: the export works on Linux, which matters more there than anywhere else, because printing is refused on that platform and this is the only way a page leaves mallow at all. What is wrong is how the paper is laid out, not whether it can be had.

**The instrument is already watching it.** `scripts/paper/measure-paper.mjs` records the text extent on every run, and `ci-linux` carries a baseline whose note names this defect, so a change in that arm's paper shows up as a measured difference rather than as a surprise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The layer that places the body at 18pt is identified by measurement rather than by reading: which of the @page margin, the print operation's page setup, or the imageable area decides it, shown by changing one at a time and reprinting
- [ ] #2 Whether WebKitGTK honours @page margins at all on this path is answered, because the two candidates differ in what a fix would be - an unset page setup is ours to set, an ignored @page is not
- [ ] #3 If the fix is ours, the Linux paper's body starts at the same 16mm as macOS and Windows, measured by scripts/paper/measure-paper.mjs rather than by eye, and ci-linux's baseline is retaken because the type may move with it
- [ ] #4 If the fix is not ours, that is recorded in AGENTS.md as a platform difference with the evidence, the way the print path's three-way asymmetry is, and the ci-linux baseline note is rewritten to say so rather than to describe a defect that is being carried
- [ ] #5 The Linux paper's size is looked at while this is open: 4.3 MB against 314 KB on macOS and 543 KB on Windows for the same document. It may be font embedding and it may be the same cause, and it costs nothing to record which
<!-- AC:END -->
