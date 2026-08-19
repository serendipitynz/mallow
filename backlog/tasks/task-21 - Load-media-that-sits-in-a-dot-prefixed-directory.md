---
id: TASK-21
title: Load media that sits in a dot-prefixed directory
status: To Do
assignee: []
created_date: '2026-08-18 10:32'
updated_date: '2026-08-19 20:49'
labels:
  - bug
milestone: m-2
dependencies: []
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The asset-protocol scope does not match a path whose directory name starts with a dot on unix, so an image, pdf or video inside e.g. .assets/ never loads - in MediaView today, and in the HTML rendered view's rewritten references from TASK-5.1 on.

Mechanism, read off the pinned tauri 2.11.3 rather than observed: allow_media_dir calls Scope::allow_directory, which pushes a <dir>/** glob, and the scope is matched with glob::MatchOptions { require_literal_leading_dot } - true on unix, false on Windows (tauri-2.11.3/src/scope/fs.rs). A ** pattern therefore does not match .assets/x.png, and the load fails silently: the asset protocol answers with a refusal the WebView shows as a broken image.

Not caused by TASK-5.1, which only makes it easier to reach: read_dir_tree does not hide dot-directories, so the tree has always listed those files and MediaView has always failed to render them. Verify on a real machine first - the reasoning above is from the source, and no one has watched it fail.

If it is real, the fix is a second grant beside the recursive one rather than a change to how paths are resolved: lib/path's resolvePath deliberately treats a leading dot as an ordinary character (TASK-5.1), and the boundary that decides what may be read is the scope, which is where it should stay.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The failure is reproduced on macOS or Linux before anything is changed: an image inside a dot-prefixed directory under the opened folder, opened from the tree, does not render
- [ ] #2 Media inside a dot-prefixed directory under the opened folder renders, on every platform
- [ ] #3 The widening is scoped to the folder the user opened, and is stated in AGENTS.md and AGENTS.ja.md beside the existing allow_media_dir note
- [ ] #4 cargo check and cargo test pass
<!-- AC:END -->
