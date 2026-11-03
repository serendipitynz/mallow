---
id: TASK-47
title: Find text in the open document
status: To Do
assignee: []
created_date: '2026-11-03 19:23'
updated_date: '2026-11-03 19:30'
labels:
  - feature
milestone: m-7
dependencies:
  - TASK-46
references:
  - src/components/MarkdownView.tsx
  - src/components/SourceView.tsx
  - src/components/Outline.tsx
  - src/lib/chord.ts
  - src/lib/markdown-preview.ts
  - src-tauri/src/menu.rs
priority: medium
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reader looking for a word in the open document has no way to find it: mallow has no find. This task adds find-in-document — `Cmd/Ctrl+F` opens a find bar over the active view, matches are highlighted, and the reader steps through them — for the markdown view (both preview and source) and every view that renders through `SourceView`. It searches the open document only; finding files by name and searching across the folder are separate tasks, not started.

What is searched is the text the view has rendered, so a value a view withheld at its caps is not found (the table's `TABLE_MAX_ROWS`, the XML tree's `XML_MAX_NODES`) — the views in this task withhold none, since `SourceView` above its caps gives up the highlighting and never the content. UI chrome inside the article — the code-copy buttons, the mermaid controls — is not document text and is excluded. Text inside a rendered mermaid diagram is excluded too: it is SVG, which TASK-46 does not measure.

Matches are painted with the CSS Custom Highlight API, never by wrapping them in elements, because the article must not be written to outside its enhancements (TASK-29's invariant). TASK-46 is what establishes the API works on all three WebViews; this task does not start until it has.

Matching, settled with the owner (2026-11-04): a substring match, case-insensitive, with full-width and half-width forms treated as one (NFKC), and hiragana and katakana kept distinct. Offsets are taken in the normalized text and mapped back to the original's, since NFKC changes lengths. A match may cross inline element boundaries within one block (`foo**bar**` matches `foobar`), so text is joined per block before matching. No case, regex or whole-word options — whole-word means nothing in Japanese text.

Moving to a match has to clear `.doc__bar`. `scrollIntoView` on an element honours the scroller's `scroll-padding-top`, but a Range has no `scrollIntoView`, so a scroll computed from a rect must read that padding back from the scroller the way `Outline` does, rather than restating the bar height.

The chord is consumed in every view, including those without find, on `lib/chord`'s rule: registering nothing concedes `Ctrl+F` to the platform, and WebView2 carries a find of its own. The Edit menu gains Find…, Find Next and Find Previous, gated per window on whether the active view supports find, the way `lib/markdown-preview` gates `Print…`. The menu's accelerators are not relied on, since they do not arrive on Windows (the `Ctrl+W` finding).

The query outlives the document under it: a watcher reload, the preview / source toggle and moving to another file all keep the bar open and re-run the same query (settled with the owner, 2026-11-04). It is not a preference and is not shared across windows.

Out of scope, for a follow-up once this lands: the config and XML trees (settled: collapsed nodes are searched, and a match expands its ancestors), the CSV / TSV table, and the rendered HTML view, whose frame TASK-46 measures separately. In those views the chord is consumed and the menu entries are disabled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cmd+F on macOS and Ctrl+F on Windows and Linux opens a find bar with the focus in its input, in the markdown preview, the markdown source and every view rendering through SourceView
- [ ] #2 Matching is a case-insensitive substring match with full-width and half-width forms treated as one (NFKC) and hiragana and katakana kept distinct, and a match may cross inline element boundaries within a block; the pure matching and offset mapping are unit-tested
- [ ] #3 Matches are painted with the CSS Custom Highlight API and the current match is drawn distinctly from the rest; finding writes nothing into the article's DOM
- [ ] #4 Enter and Shift+Enter, and Cmd+G / Cmd+Shift+G on macOS or F3 / Shift+F3 on Windows and Linux, move to the next and previous match, wrapping at the ends, and the current match is scrolled into view clear of .doc__bar
- [ ] #5 The bar shows the current position and the total (n / m), a zero-match state, and stops counting at 1,000 with 1000+; the count reaches a screen reader through a live region
- [ ] #6 Escape closes the bar, clears every highlight and returns the focus to where it was before the bar opened
- [ ] #7 The chord is consumed in every view, including those without find, and the Edit menu carries Find…, Find Next and Find Previous on all three platforms, disabled in a window whose active view has no find
- [ ] #8 A watcher reload, the preview / source toggle and moving to another file keep the bar open and re-run the same query
- [ ] #9 The input follows snz-design doc-8 §6.3, and every string is in both the ja and en dictionaries
- [ ] #10 pnpm lint, pnpm build and pnpm test pass, and cargo fmt --check, cargo check and cargo test pass inside src-tauri/
<!-- AC:END -->
