---
id: TASK-5.3
title: 'Surface what was disabled: notice bar, open outside mallow, window title'
status: In Review
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-08-19 00:25'
labels:
  - feature
milestone: m-1
dependencies:
  - TASK-5.1
parent_task_id: TASK-5
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Part 3 of 3 for TASK-5 (see decision-3). Makes the limits visible instead of looking like breakage.

1. Count and show what is inert or missing: script elements, external references, and the local stylesheet/font references that cannot be rewritten without a CSP change (decision-3). A document rendering unstyled with no explanation reads as a bug in mallow.
2. Add an action to open the file outside mallow. Do NOT plan it on opener's open_path: is_path_allowed in tauri-plugin-opener 2.5.4 requires an allowed Entry::Path, allow-open-path ships no scope, and opener:default contributes only URL entries, so every call returns ForbiddenPath. Widening at runtime is possible via Manager::add_capability plus CapabilityBuilder::permission_scoped, but decision-3 declines it: that is a second runtime-scope mechanism next to allow_media_dir for a call editors.rs can make directly with std::process, exempt from capabilities. Add the command there. Label it for what it does - the OS default handler for .html is not always a browser.
3. Set the window title from the document's title element when present, falling back to the file name. Take it from the transform result TASK-5.1 returns (see its step 5) - the document has already been through DOMParser there, so do not parse it a second time, by regex or otherwise. What still needs deciding is who writes the title: frontMatterTitle in lib/title.ts returns null for kind !== 'markdown' so documentTitle always yields file.name for HTML, and Viewer.tsx:48,53 already sets the title on read. Extend one of those paths rather than adding a second writer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The notice bar reports counts for inert scripts, for the external references that do not load, and for the local references that are not rewritten - the stylesheet beside the document among them. Reworded from 'external references' and 'font references' because TASK-5.1's transform makes both narrower than they read: an http(s) reference on a rewritten media attribute DOES load, since img-src and media-src carry https:, so it is counted apart and deliberately not reported - one number for both outcomes could be right about neither - and a font is covered only where a <link> names it, because a font reached through url() inside CSS is never parsed. Neither is a lowered bar: both say what is reported instead of implying more
- [ ] #2 The notice bar says that this document's links do nothing where the frame runs no parent-registered listener, and says it about the document's own table of contents too - a stronger statement than decision-9's http(s) clause, because a bare fragment resolves against the parent's URL and is neutralized rather than followed (decision-10). The claim is driven by the runtime probe, never by a platform name
- [ ] #3 The open-outside-mallow action works on a file in a folder the user picked anywhere on disk, not only under the home directory
- [x] #4 The action's label matches what it actually does
- [ ] #5 The window title follows the document's title element when present and falls back to the file name, with a single writer
- [x] #6 New i18n keys are added to both the ja and en dictionaries
- [x] #7 pnpm build, pnpm test, cargo check and cargo test all pass
- [x] #8 The title comes from the transform result produced in TASK-5.1, not from a second parse of the document
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The label was the one issue decision-3 named, and the answer is the OS default handler under a generic label - "既定のアプリで開く" / "Open in default app" - rather than a resolved browser name. Naming the app would mean LaunchServices on macOS, the registry on Windows and xdg-mime plus .desktop parsing on Linux, and would buy one word; naming a browser explicitly would mean a per-OS browser table beside the editor one and would miss anyone whose default is not in it. The generic label is what the command actually does, so nothing can drift out from under it. The action is in both places: the footer menu, where it reaches every kind and both modes, and the notice bar, where it is the way out of the limits the bar has just described. 2026-08-19, user.

open_in_default_app is in editors.rs with std::process, per decision-3: `open` on macOS, `xdg-open` on Linux, and `explorer <file>` on Windows - not `cmd /C start`, because cmd re-parses its command line by rules Command does not quote for, so a path holding `&` or `^` would be split there.

The counts had to be split before the bar could say anything true. externalRefs merged two populations with opposite outcomes: an http(s) reference on a rewritten media attribute loads, since img-src and media-src carry https:, while the same URL on <link> or <script src> is refused. So it became blockedExternalRefs, which counts only the second, and the first is not counted at all - the bar reports what was lost, and a remote image that arrived is not that. This is the same reversal the [P2] on TASK-5.1 found in unresolvedLocalRefs, one field along. counts.links went the other way and widened, from http(s) anchors to every a[href], because decision-10 makes the statement about all of them; <area href> is neutralized but stays out of the count, since only its keyboard path is settled.

The window title has one writer and it is Viewer, which was already true and is now explicit: every setWindowTitle call moved out of the read effect into one effect of its own, and HtmlView reports the <title> the transform already read through onDocumentTitle rather than writing anything. The label is dropped on a path change and deliberately not on the watcher's reload token - a re-read whose text is unchanged produces no new transform, so nothing would report it back and the title would fall to the file name.

Four of the eight are ticked at In Review, and the four left are the ones a screen answers. #1 (the bar reports the counts), #2 (the link line) and #3 (a file outside the home directory opens) all need the app running, and #2 needs it on both sides of decision-9's boundary - a WebKit machine to see the line and a Windows one to see it absent - while #5's fallback behaviour needs the window title watched as files are switched. What the automated checks do settle is written above them: the rule that picks the lines is unit-tested, the single writer is that grep over setWindowTitle returns Viewer alone, and the single parse is that DOMParser appears once in the HTML path.

TASK-5.2's AC #6 is still open and belongs to this round for the same reason: its first half describes WebView2 and no Windows machine was in either of its visual rounds.

Raised and not done here: TASK-23, decision-10's link cases for the probe. It is a development instrument, so it changes nothing a v0.6.0 reader receives.
<!-- SECTION:NOTES:END -->
