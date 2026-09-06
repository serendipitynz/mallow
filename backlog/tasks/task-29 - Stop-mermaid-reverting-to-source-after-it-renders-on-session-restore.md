---
id: TASK-29
title: Stop mermaid reverting to source after it renders on session restore
status: To Do
assignee: []
created_date: '2026-09-06 03:42'
labels:
  - bug
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reproduced 2026-09-06 (macOS, `pnpm tauri dev`): with a markdown document containing mermaid restored at launch as the previously open file, **the diagram renders and then reverts to its own source a moment later**. Selecting another file and opening it again renders it and it stays. `_sandbox/samples/print-pagebreaks.md` is the document; `_sandbox/samples/mermaid-min.{md,mmd}` are minimal probes made while diagnosing it.

**The symptom is a diagram being taken back, not a diagram that never appeared, and the distinction is the whole of the diagnosis.** `renderMermaid` replaces `<pre class="mermaid">` with a `<div class="mermaid-rendered">` on success, and nothing in `lib/mermaid` puts a `<pre>` back — so source text after a successful render means the article's HTML was re-injected (`dangerouslySetInnerHTML`) or the element was remounted. It also means the module loaded and the syntax parsed, both of which are exonerated the moment anything renders. Writing this up as "mermaid does not render" is what produced two wrong diagnoses before the reproduction arrived, which is why the referent table fixes **描画後の差し戻し** as its own referent.

**Three candidates are already eliminated by reading, so do not spend the round re-checking them.** The custom-emoji config bump cannot be it: `App.tsx` awaits `applyEmojiDir` *before* it selects the restored file, so the emoji table is in place before the document renders. The restore effect cannot be running twice: its three dependencies (`openTree`, `expandPaths`, `applyEmojiDir`) are all `useCallback`s with empty or stable deps. And the watcher's reload cannot be it: `source` is a string, so an unchanged re-read does not re-run the render effect.

**A fourth read-only hypothesis is not an answer.** The remaining candidate — that the enhancement effect has no cancellation guard where the render effect has one, so a slow first `import('mermaid')` can let a stale pass complete against a DOM it no longer owns — has the right shape and is *not* an observation. Instrument it: the reproduction is reliable, so logging when `result` changes, when a `renderMermaid` pass starts and finishes, and when the article's HTML is written will name the cause in one run.

**Why it was expensive to diagnose is itself part of the fix.** `void renderMermaid(article)` in `MarkdownView` and `void renderMermaid(host)` in `MermaidView` carry no `.catch`, while `openUrl` and `printWindow` a few lines away in the same file do. A failure surfaces only as an unhandled rejection, nothing appears on screen, and the reader cannot tell a broken render from a document mallow does not support.

Found while measuring printing (TASK-27 / TASK-28) and **unrelated to it**: what reaches paper is what is on screen, and the print stylesheet cannot restore an element the app replaced. Milestone deliberately unassigned — it is pre-existing, it self-heals on reopen, and whether it belongs in v0.8.0 is a release-scope call rather than a technical one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A markdown document containing a mermaid diagram, restored at launch as the previously open file, shows the diagram and keeps showing it - reproduced first, then fixed
- [ ] #2 The cause is identified by instrumentation rather than by reading. Three candidates were already eliminated by reading (the custom-emoji config bump is awaited before the file is selected, the restore effect's deps are all stable so it runs once, and the syntax is exonerated the moment a diagram renders), so a fourth read-only hypothesis is not an answer
- [ ] #3 renderMermaid's failures stop being swallowed: the two call sites (MarkdownView and MermaidView) handle the rejection the way openUrl and printWindow beside them already do. Without this the next occurrence is as hard to diagnose as this one
- [ ] #4 Whether the enhancement effect needs a cancellation guard is decided on the evidence, not assumed - the render effect has one and this one does not, which is the shape of the symptom, but that is a candidate and not an observation
- [ ] #5 Whether a reader is told the diagram could not be drawn is decided. Today source text is indistinguishable from a document mallow does not support
<!-- AC:END -->
