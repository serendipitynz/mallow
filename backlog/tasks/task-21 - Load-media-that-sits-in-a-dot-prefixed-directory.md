---
id: TASK-21
title: Load media that sits in a dot-prefixed directory
status: Done
assignee: []
created_date: '2026-08-18 10:32'
updated_date: '2026-08-23 07:10'
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
- [x] #1 The failure is reproduced on macOS or Linux before anything is changed: an image inside a dot-prefixed directory under the opened folder, opened from the tree, does not render
- [x] #2 Media inside a dot-prefixed directory under the opened folder renders, on every platform
- [x] #3 The widening is scoped to the folder the user opened, and is stated in AGENTS.md and AGENTS.ja.md beside the existing allow_media_dir note
- [x] #4 cargo check and cargo test pass
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
Reproduced on macOS (2026-08-23) against tauri 2.11.3's own `scope::fs::Scope`
rather than a model of it: a scope built the way the app builds it, granted a
temp directory with `allow_directory(dir, true)`, answered `is_allowed` with
`true` for `<dir>/assets/x.png` and `false` for both `<dir>/.assets/x.png` and
`<dir>/.hidden.png`. `protocol/asset.rs:46` turns that `false` into a 403, which
is the broken image. So the source reading in the description held, and the
defect is wider than the title says - a dot-prefixed *file* fails too, at any
depth.

AC #1 is checked on that measurement. The visual round then ran on macOS
(2026-08-23, `pnpm tauri dev`, fixture at `_sandbox/handoff/task-21-fixture/`):
the non-dot control rendered, and so did all three dot cases - a dot directory,
a nested one, and a dot-prefixed file - through the tree and through the
rendered view's rewritten references both. The same fixture was confirmed to
fail on the released v0.6.0, so the two states were seen side by side rather
than one of them assumed.

AC #2 says "on every platform" and rests on three legs, only the first of which
is a screen: macOS measured as above; Linux covered by the same unit tests in
CI, which runs on ubuntu and shares the unix default this task is about;
Windows needing no change at all, since `require_literal_leading_dot` already
defaults to `false` there.

**The fix is not the second grant the description proposed.** It is
`assetProtocol.scope.requireLiteralLeadingDot: false` in `tauri.conf.json`,
which changes the scope's match options rather than its patterns. The second
grant was rejected because it cannot be written: no finite set of globs covers
dot directories at every depth or the dot-prefixed files themselves, and a
directory created after the grant would be missed regardless. The principle the
description states - that the boundary stays in the scope, and `lib/path`'s
handling of a leading dot is untouched - is kept.
<!-- SECTION:NOTES:END -->
