---
id: TASK-57
title: Record a tour of the app for README and x.com
status: To Do
assignee: []
created_date: '2026-11-13 11:42'
labels:
  - documentation
dependencies: []
references:
  - 'https://github.com/serendipitynz/serenebach'
  - README.md
priority: low
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow has no moving picture of itself anywhere: README shows the app icon and text only, and there is nothing to post on x.com when a release is announced. This task records one short tour of the real app and derives the two forms its two destinations need.

**README follows serenebach's approach** (`serendipitynz/serenebach`, `docs/assets/admin-tour.webp` and the commit that introduced it): an animated WebP embedded as an image, linked to an HD MP4 for click-through. The reasons it gives carry over unchanged:
- A `<video>` whose source is on another domain is refused by GitHub's `media-src` CSP.
- A `github.com/user-attachments` video does not play on iOS Safari.
- An image goes through camo, which `img-src` permits, so an animated WebP plays inline everywhere.

serenebach's numbers, as the reference point: 720×450, 15 fps, lossy q=75, 17 s, 474 KB, loop; the click-through MP4 is 629 KB with `+faststart`.

**x.com takes an MP4**, uploaded directly, since an animated WebP is not played there as a video. 16:10 is inside the aspect range X accepts, so the README master serves both and nothing is recorded twice.

The shape proposed, to be confirmed at the start:
- **Source**: a screen recording of the built app (`pnpm tauri build --debug --no-bundle`), not a mock-up, opened on a demo folder assembled from `_sandbox/samples` outside the tracked tree. Driven by `osascript`, recorded with `screencapture -v`, cut with ffmpeg.
- **Scenes** (15–20 s for README): a Markdown document with a mermaid diagram and code, a jump through the outline, a Marp deck shown as slides, a CSV table, a JSON tree, and the light / dark switch. Five or six of these, not all.
- **Derived files**:
  - `docs/assets/tour.webp` — 720×450, 15 fps, lossy, around 500 KB, loop.
  - HD MP4 — 1440×900, H.264, `+faststart`, no audio; the README image links to it.
  - X MP4 — 1440×900, H.264 High, yuv420p, 30 fps, `+faststart`, no audio, with a title card at each end.

To settle at the start:
- **Where the HD MP4 is served from.** mallow has no domain of its own as serenebach has `go.serenebach.net`. Candidates: a domain the owner already holds, GitHub Pages on this repository (which serves `video/mp4`), or no click-through and the WebP alone.
- **Captions.** None, as serenebach's tour has none, or short feature names on the X cut only; and if so, Japanese or English.
- **Running the recording**: macOS asks for Screen Recording and Accessibility permission the first time, and the app is driven in front while it records, so the machine is not usable for that time.

Nothing here adds a dependency to mallow: ffmpeg and the recording tools are the machine's, and the scripts that drive the recording stay outside the tracked tree unless keeping them is decided at the start.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Where the HD MP4 is served from, and whether the X cut carries captions and in which language, are settled and written in the task
- [ ] #2 The tour is recorded from a built app, not a dev build or a mock-up, on a demo folder kept outside the tracked tree
- [ ] #3 docs/assets/tour.webp is an animated WebP of 15-20 s at 720x450 that loops, and its size is recorded in the task
- [ ] #4 README embeds the WebP as an image linked to the HD MP4 (or, if no click-through was chosen, as an image alone), and it plays inline on github.com in a desktop browser and on iOS Safari
- [ ] #5 An X MP4 (H.264, yuv420p, faststart) is produced and handed to the owner, and its spec is recorded in the task
- [ ] #6 No dependency is added to package.json or Cargo.toml
<!-- AC:END -->
