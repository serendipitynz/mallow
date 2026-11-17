---
id: TASK-65
title: Wrap long lines in the source view
status: To Do
assignee: []
created_date: '2026-11-17 21:17'
labels:
  - feature
dependencies: []
references:
  - src/components/SourceView.tsx
  - src/styles/source.scss
  - src/lib/source-cap.ts
  - _sandbox/samples/notes.txt
priority: medium
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reading a plain-text file such as `_sandbox/samples/notes.txt` in the source view, a line longer than the view runs off to the right and has to be scrolled sideways (that sample's last line is 228 characters). The request is that the source view wrap long lines to the view's width instead.

**What is there today.** `SourceView` is shared by every source view — a `.txt` / `.log`, the source half of markdown, config, CSV / TSV, HTML and XML — so the change reaches all of them at once. It has two paths:

- **Highlighted** (under `HIGHLIGHT_MAX_BYTES` 256 KiB / `HIGHLIGHT_MAX_LINES` 10,000 in `lib/source-cap`): Shiki emits one `<span class="line">` per line, `code { display: grid }` makes each a row, and the number is a `.line::before` counter drawn as an `inline-block` (`src/styles/source.scss`). `pre.shiki` keeps `white-space: pre` and `overflow: auto`, which is the horizontal scroll. Wrapping is possible here because each line is its own element, but it needs a hanging layout: a continuation row has to start at the text column rather than under the number, and the number has to stay beside the line's first row.
- **Unhighlighted, above the caps** (`PlainSource`): the whole text is one text node beside a second text node of numbers, so a wrapped line would put every number below it out of step. The component's own comment says this is why that path does not wrap, and the flagged-line band is placed from the measured line height on the same assumption. This path stays unwrapped in this task; README / AGENTS.md say so if the highlighted path wraps.

**Decide before implementing (the owner's call).** Whether wrapping is always on, or a choice the reader can turn off — and if a choice, where it lives: a preference beside the prose measure (app-wide, propagated through `settings-sync` like `proseMeasure`), or a toggle on the view (and possibly a View menu item and chord, as editors offer). A toggle on the view is a new control, so snz-design doc-16 and mallow's adoption record are read first.

**What wrapping must not break.** A run with no break opportunity (the `aaaa…` run in the sample) has to wrap too, not overflow, so `overflow-wrap: anywhere` or its equivalent is needed alongside `white-space: pre-wrap`. Tabs keep their width. Find (TASK-47) paints with ranges over the text nodes, so the DOM is unchanged, but bringing a match into view and the current-match paint on a wrapped row are checked. The parse-error line band (`.src-error-line`) and the scroll position kept by TASK-44's view memory are checked on a file whose lines wrap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Whether wrapping is always on or a reader's choice, and where that choice lives, is decided and recorded before implementation
- [ ] #2 In the highlighted source view, a line longer than the view wraps to the view's width and the view does not scroll sideways (with wrapping on)
- [ ] #3 A wrapped line's continuation rows start at the text column, not under the line number, and the number stays beside the line's first row
- [ ] #4 A run with no break opportunity, such as the long run in _sandbox/samples/notes.txt, wraps rather than overflowing
- [ ] #5 Find's match paint and scroll-into-view, the parse-error line band and the restored scroll position still land on the right line in a file whose lines wrap
- [ ] #6 The unhighlighted path above the source caps stays unwrapped, and README / AGENTS.md say so
- [ ] #7 Checked on macOS, Windows and Linux builds
<!-- AC:END -->
