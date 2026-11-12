---
id: TASK-51.2
title: Show a deck as slides and present it full-screen
status: To Do
assignee: []
created_date: '2026-11-11 01:30'
updated_date: '2026-11-12 08:41'
labels:
  - feature
dependencies:
  - TASK-51.1
references:
  - src/components/MarkdownView.tsx
  - src/components/Segmented.tsx
  - src/lib/chord.ts
  - src/hooks/useViewMemory.ts
  - src-tauri/capabilities/default.json
parent_task_id: TASK-51
priority: medium
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds the view TASK-51.1 decided on. decision-18 is the decision: Marpit on mallow's own markdown-it, the supported subset and the notice that names what is not, the slide size and scaling, mallow's slide theme, and the deck's CSS applied scoped to its slides. Read it before starting; this task builds what it settles and does not reopen it.

decision-18 also leaves this task four things it could not measure, and the rest of the decision rests on them: whether the deck CSS walk holds on the engine's own CSSOM in all three WebViews (if not, `postcss` as a direct dependency needs the owner's approval first); whether WKWebView and WebKitGTK paint Marpit's inline SVG correctly or need `@marp-team/marpit-svg-polyfill` (a second dependency needing its own approval, with §4's CSS-transform fallback if it is needed and not approved); that `contain: paint` on the slide host keeps a deck's `position: fixed` from drawing over the app; and how a deck behaves under the built app's CSP on Windows and Linux, since every CSP measurement so far is macOS. Where to hook the image-token rule (§2) and the deck CSS walk (§6) into Marpit is also this task's to build and verify.

A `marp: true` document gains a third choice in the markdown view switch beside preview and source: Slides. It shows one slide at a time scaled to the view, with the slide number, and moves with the arrow keys, Page Up / Page Down, Space / Shift+Space, Home / End and on-screen previous / next buttons. A document without `marp: true` does not offer the choice.

Present enters a full-screen presentation of the current slide: the window goes full-screen (`core:window:allow-set-fullscreen` is not in the capability today and has to be added), the toolbar, explorer and document bar are hidden, the same keys move between slides, a click advances, and Escape leaves and puts the window back as it was.

To settle at the start: the chord that starts presenting (a browser-like F5 or Cmd+Enter / Ctrl+Enter, checked against what WebView2 binds, which lib/chord's rule says to consume rather than concede), and whether the slide reached is remembered by the view memory TASK-44 keeps per file.

What find, the outline, Print… and Export as PDF… do while Slides is shown has to be decided rather than left to fall out: the print gate is "markdown in preview", which Slides is not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A marp: true document offers Slides in the markdown view switch; other documents do not
- [ ] #2 Slides shows one slide at a time scaled to the view, with its number, and moves by the listed keys and the on-screen buttons
- [ ] #3 Present shows the current slide full-screen with the app's chrome hidden, moves by the same keys and a click, and Escape restores the window as it was
- [ ] #4 What find, the outline, Print and Export as PDF do while Slides is shown is decided and written down, and the menu's gates agree with it
- [ ] #5 Every new label reaches the reader in both ja and en
- [ ] #6 pnpm lint, pnpm build and pnpm test pass; the slide split and navigation logic are unit-tested
- [ ] #7 The four measurements decision-18 left to this task are done against a built app and recorded in the task: the deck CSS walk on the engine's CSSOM in all three WebViews, whether WKWebView and WebKitGTK need marpit-svg-polyfill, that contain: paint keeps a deck's position: fixed inside the slide host, and the deck's behaviour under the CSP on Windows and Linux
- [ ] #8 @marp-team/marpit is added with mallow's markdown-it range raised to ^14.3.1 and THIRD-PARTY-NOTICES.md regenerated; any further dependency (the polyfill, a direct postcss) has the owner's approval before it is added
- [ ] #9 AGENTS.md's untrusted-Markdown boundary and README Security state what a deck's CSS can reach, as decision-18's Consequences set out
<!-- AC:END -->
