---
id: TASK-59
title: 'Show the toolbar path with its leading separator at its start, not its end'
status: To Do
assignee: []
created_date: '2026-11-13 23:05'
labels:
  - bug
dependencies: []
references:
  - src/styles/app.scss
  - src/components/Toolbar.tsx
priority: medium
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The toolbar shows the selected file's path with its leading separator moved to the end: `/Users/…/deck.md` reads `Users/…/deck.md/` on macOS, and a UNC path `\\host\share\…\deck.md` reads `host\share\…\deck.md\\` on Windows (seen in v0.14.0 on both).

**The cause is `direction: rtl` on `.toolbar__path`** (`src/styles/app.scss`), which is there so a truncated path keeps its tail — the file name — visible. Under an RTL base direction the Unicode bidi algorithm resolves a leading neutral character (`/`, `\`) to the paragraph direction and places it at the visual end. The path's own characters are untouched; `title` carries the right string.

The fix has to keep both halves: the separators where they belong, and the ellipsis at the start rather than the end when the path does not fit. Candidates are an inner element isolating the path as one LTR run (`<bdi dir="ltr">`, or `unicode-bidi: isolate` with `direction: ltr`) inside the RTL box, or a left-to-right mark before the text. Which one keeps the head-side ellipsis is an engine question, so it is checked on WKWebView, WebView2 and WebKitGTK rather than in one browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A POSIX path shows its leading / at the start and no trailing separator in the toolbar
- [ ] #2 A Windows drive path and a UNC path (\\host\share\…) show their separators where they are written
- [ ] #3 A path too long for the toolbar is still truncated at its head, keeping the file name visible
- [ ] #4 Checked on macOS, Windows and Linux builds
<!-- AC:END -->
