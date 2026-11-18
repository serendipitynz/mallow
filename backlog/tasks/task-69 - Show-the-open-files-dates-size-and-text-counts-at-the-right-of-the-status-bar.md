---
id: TASK-69
title: >-
  Show the open file's dates, size and text counts at the right of the status
  bar
status: To Do
assignee: []
created_date: '2026-11-18 22:06'
labels:
  - feature
dependencies: []
references:
  - src/App.tsx
  - src/styles/app.scss
  - src-tauri/src/commands.rs
  - src/lib/file.ts
  - src/lib/types.ts
  - src/components/SourceView.tsx
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The window's bottom bar (`.app__footer`) holds only the settings button at its left end. The request (2026-11-19) is to use its right end for facts about the open file: its **creation date**, **modification date**, **size**, and — for text files only — its **character count** and **line count**.

**Where the facts come from.** `read_dir_tree` already returns each entry's `modified` and `created` (TASK-61), but the `FileEntry` a restored session synthesizes from a bare path (`lib/file`) carries neither, and no size is carried anywhere. So the selected file needs its own metadata read (a small command beside `read_file`, or a size added to what the tree already returns) — decide which, keeping in mind `read_dir_tree` is read per folder and lazily. The live watch (`fs:change`) re-reads the document on a change, and these facts follow it.

**Settle at the start.**
- **Character count's unit**: grapheme clusters (what a reader counts; `Intl.Segmenter`), code points, or UTF-16 units — and its cost on a file near `read_file`'s 10 MiB cap, on the main thread. Whether line breaks count as characters.
- **Line count's rule**: the same number the source view's last line number shows, so the two never disagree (a trailing newline, CRLF).
- Markdown and decks are counted on their **source text**, not the rendered result — stated in the UI or README.
- **Size**: bytes on disk, with the unit base (1000 or 1024) and the precision chosen once.
- **Dates**: format per UI language (`lib/i18n`), with or without the time. A filesystem with no creation time (`Metadata::created` errors on some Linux filesystems) shows a stated absence, not a wrong date.
- Whether the bar's information is a preference the reader can turn off.

**Which files.** Text kinds (markdown, config, CSV / TSV, XML, HTML, plain text) get all five; media (image / PDF / video) get dates and size only, since no text is read for them; a file that failed to read (`ReadError`: binary, invalid UTF-8, too large) gets dates and size and no counts. With no file open the right end is empty.

**Sharing the bar.** TASK-68 shows a hovered link's destination at the left end of the same bar; when the window is narrow the destination takes precedence and this information yields (truncates or hides) by a stated rule, and the bar never grows taller or wraps.

Before building, read snz-design doc-16 (§7.2) and mallow's adoption record (doc-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The character count's unit, the line count's rule, the size unit, the date format and whether the information can be turned off are decided and recorded before implementation
- [ ] #2 With a file open, the right end of the bottom bar shows its creation date, modification date and size, including for a file selected by session restore
- [ ] #3 A text file also shows its character and line counts, and the line count matches the source view's last line number
- [ ] #4 Media files and files that failed to read show dates and size without counts; a missing creation time is shown as absent by a stated rule
- [ ] #5 An edit to the open file picked up by the live watch updates every shown value
- [ ] #6 In a narrow window the information yields to TASK-68's link destination by a stated rule, and the bar does not grow taller or wrap
- [ ] #7 Counting a file near the 10 MiB read cap does not stall the view (measured)
- [ ] #8 Checked on macOS, Windows and Linux builds
<!-- AC:END -->
