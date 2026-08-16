---
id: TASK-2
title: Add an HTML source view
status: Done
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-08-16 08:10'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-10
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the file kind html (html/htm) routed to SourceView with the html grammar, which is already in the LANGS list in lib/shiki.

Ships ahead of the rendered view so HTML files are at least openable; the rendering task then only has to add the second mode and the toggle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 html and htm files appear in the tree and open highlighted in the source view
- [x] #2 file_kind and kindFromName both map the new extensions, with tests
- [x] #3 pnpm build, pnpm test and cargo test all pass
- [x] #4 A non-UTF-8 HTML file, such as one saved as shift_jis, reports the cause by name rather than a raw decoding error
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ships the html kind as source only. decision-3 makes the rendered view the default mode with a toggle to this view, so this task is the half that makes an HTML file openable at all; nothing here decides anything about rendering.

Extensions are html and htm exactly, per the description. xhtml and shtml are deliberately not added: the allowlist stays explicit (decision-2), and neither has come up as a file mallow is asked to open.

AC #4 needed no new code. The typed ReadError of decision-5 is chosen in read_file before any kind is consulted, so invalidUtf8 reaches the viewer with its own wording for html the same way it does for log and txt. The sample cp932.html exists to observe that, not to fix it.

Icon: the FileKindIcon default (FileTextIcon) is left alone, on TASK-1's rule that FileConfigIcon marks kinds with a tree view. Whether a rendered html view deserves an icon of its own is that task's call.

Sample files for the visual check are in _sandbox/samples/ (gitignored): index.html, legacy.htm and cp932.html, with CHECKLIST.md saying what each shows. The repository carries no html file, so opening the repo root shows nothing to check.

AC #1 is recorded as met on static grounds, not on an observation: the tree half is pinned by the file_kind unit test, and the highlighted-open half is determinable without running the app -- html is in lib/shiki's LANGS, ViewerBody passes file.kind through as lang, and SourceView's only fallback for a grammar it lacks is plain text. On-screen confirmation under pnpm tauri dev is still outstanding; record it here when it happens, the way TASK-1 did.

Confirmed by eye on 2026-08-16, after PR #27 merged: html and htm appear in the tree and open highlighted in the source view under pnpm tauri dev, showing the markup as text rather than rendering it. AC #1 therefore rests on observation as well as on the static grounds above.
<!-- SECTION:NOTES:END -->
