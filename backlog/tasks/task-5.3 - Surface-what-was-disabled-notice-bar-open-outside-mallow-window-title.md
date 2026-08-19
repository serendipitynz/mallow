---
id: TASK-5.3
title: 'Surface what was disabled: notice bar, open outside mallow, window title'
status: In Review
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-08-19 03:55'
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
- [x] #1 The notice bar reports counts for inert scripts, for the external references that do not load, and for the local references that are not rewritten - the stylesheet beside the document among them. Reworded from 'external references' and 'font references' because TASK-5.1's transform makes both narrower than they read: an http(s) reference on a rewritten media attribute DOES load, since img-src and media-src carry https:, so it is counted apart and deliberately not reported - one number for both outcomes could be right about neither - and a font is covered only where a <link> names it, because a font reached through url() inside CSS is never parsed. Neither is a lowered bar: both say what is reported instead of implying more
- [x] #2 The notice bar says that this document's links do nothing where the frame runs no parent-registered listener, and says it about the document's own table of contents too - a stronger statement than decision-9's http(s) clause, because a bare fragment resolves against the parent's URL and is neutralized rather than followed (decision-10). The claim is driven by the runtime probe, never by a platform name
- [x] #3 The open-outside-mallow action works on a file in a folder the user picked anywhere on disk, not only under the home directory
- [x] #4 The action's label matches what it actually does
- [x] #5 The window title follows the document's title element when present and falls back to the file name, with a single writer
- [x] #6 New i18n keys are added to both the ja and en dictionaries
- [x] #7 pnpm build, pnpm test, cargo check and cargo test all pass
- [x] #8 The title comes from the transform result produced in TASK-5.1, not from a second parse of the document
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The label was the one issue decision-3 named, and the answer is the OS default handler under a generic label - "既定のアプリで開く" / "Open in default app" - rather than a resolved browser name. Naming the app would mean LaunchServices on macOS, the registry on Windows and xdg-mime plus .desktop parsing on Linux, and would buy one word; naming a browser explicitly would mean a per-OS browser table beside the editor one and would miss anyone whose default is not in it. The generic label is what the command actually does, so nothing can drift out from under it. The action is in both places: the footer menu, where it reaches every kind and both modes, and the notice bar, where it is the way out of the limits the bar has just described. 2026-08-19, user.

open_in_default_app is in editors.rs with std::process, per decision-3: `open` on macOS, `xdg-open` on Linux, and `explorer <file>` on Windows - not `cmd /C start`, because cmd re-parses its command line by rules Command does not quote for, so a path holding `&` or `^` would be split there.

The counts had to be split before the bar could say anything true, and the split took two goes. externalRefs merged two populations with opposite outcomes, so it became blockedRefs, counting only what does not arrive; a remote image is not counted at all, because the bar reports what was lost. This is the same reversal the [P2] on TASK-5.1 found in unresolvedLocalRefs, one field along.

The first attempt keyed that on the scheme and was wrong twice, both caught in review. media-src is 'self' asset: and carries no https: - so a remote video is refused exactly as a remote script is, and under a rule that trusted the attribute to be enough it reached no count at all. And on the unrewritten path a protocol-relative or data: stylesheet is refused as surely as an http(s) one, which a rule about http(s) does not see. The answer is that the deciding thing is the CSP directive that fetches the attribute, never the value's scheme: lib/html-doc's refTally takes a RefSite (imgSrc / mediaSrc / unrewritten) and every count runs through it, with <source src> asking its parent because it belongs to whichever of the two the parent is. It is a pure function so the reversal is pinned by tests rather than by prose.

counts.links went the other way and widened, from http(s) anchors to every href whose fate is settled - app-origin, which decision-10 neutralizes, and http(s), which frame-src refuses. A mailto: or tel: href is in neither argument and stays out, since nothing here measured what a sandboxed frame does with it (raised for TASK-23). <area href> is neutralized but stays out for the same shape of reason: only its keyboard path is settled.

The window title has one writer and it is Viewer, which was already true and is now explicit: every setWindowTitle call moved out of the read effect into one effect of its own, and HtmlView reports the <title> the transform already read through onDocumentTitle rather than writing anything. The label is dropped on a path change and deliberately not on the watcher's reload token - a re-read whose text is unchanged produces no new transform, so nothing would report it back and the title would fall to the file name.

Visual rounds, 2026-08-19, macOS (WKWebView, dev then a --debug --no-bundle build) and Windows 11 (WebView2). All eight are ticked; what each round settled is below, and so is one thing it did not.

The notice bar reports scripts 2 / blockedRefs 3 / unresolvedLocalRefs 3 / removedFrames 1 against the fixture on both platforms, and links 3 out of four anchors - the mailto: is excluded, which is the count the bar's wording depends on. The link line appears on macOS and is absent on Windows, which is AC #2 on both sides of decision-9's boundary; it is driven by the probe, so nothing branches on a platform name. On the built macOS app all four links do nothing. The window title follows the document's <title> and falls back to the file name. "Open in default app" reached the handler from /Volumes/... on macOS and from a network share on Windows, so AC #3 is about a folder well outside the home directory.

TASK-5.2's AC #6 is ticked in the same round: on Windows a fragment link scrolled the parent scroller and an http(s) link opened the OS browser, which is the WebView2 half no round before this had a machine for.

Two failures came out of it, and both were in something written rather than in the rendered view. explorer.exe splits its argument on a comma, so a file named rendered-notice,check.html opened an Explorer window instead of its handler - the review's [P3] becoming a measurement. It is rundll32 url.dll,FileProtocolHandler now, and the three path shapes that follow from Command's quoting rule (comma, space, non-ASCII) were each measured through it. And the fixture claimed 2 local references where the code counts 3: a relative <script src> is one, and it had been left out of the expectation rather than out of the count. Reading that as a defect in the count was one step away.

What did NOT get established is the img-src / media-src split by eye. The data: pair meant to show it has an invisible positive half - the data: image was #eeeeee on white - so "the audio did not play" could still have meant data: was refused outright. The rule is settled by refTally's unit tests and by the CSP text either way; the fixture's controls are now unmistakable (a dark green band, and a remote image carrying legible text rather than placehold.co's default grey box) for whoever runs it next.

The first macOS round ran under pnpm tauri dev, where there is no CSP at all, and an http link navigating the frame was reported as a defect from it. It is not one - frame-src does not exist there. The fixture now marks every item "dev 可" or "要ビルド". #1 (the bar reports the counts), #2 (the link line) and #3 (a file outside the home directory opens) all need the app running, and #2 needs it on both sides of decision-9's boundary - a WebKit machine to see the line and a Windows one to see it absent - while #5's fallback behaviour needs the window title watched as files are switched. What the automated checks do settle is written above them: the rule that picks the lines is unit-tested, the single writer is that grep over setWindowTitle returns Viewer alone, and the single parse is that DOMParser appears once in the HTML path.

TASK-5.2's AC #6 is still open and belongs to this round for the same reason: its first half describes WebView2 and no Windows machine was in either of its visual rounds.

Raised and not done here: TASK-23, decision-10's link cases for the probe. It is a development instrument, so it changes nothing a v0.6.0 reader receives.
<!-- SECTION:NOTES:END -->
