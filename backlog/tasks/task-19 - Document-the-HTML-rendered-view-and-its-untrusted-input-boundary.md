---
id: TASK-19
title: Document the HTML rendered view and its untrusted-input boundary
status: Done
assignee: []
created_date: '2026-08-17 03:09'
updated_date: '2026-08-19 12:03'
labels:
  - documentation
milestone: m-1
dependencies:
  - TASK-5
  - TASK-7
  - TASK-8
priority: low
type: docs
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split out of TASK-6 on 2026-08-17. TASK-6 documented the file kinds that reached v0.5.0; this task documents the HTML rendered view, which did not.

Everything here needs the rendered view to exist, so none of it could be written truthfully in v0.5.0: there was no sandbox, no inherited CSP, no open-outside-mallow command, and no dirname helper. Writing them anyway would have described a security contract mallow does not implement.

- AGENTS.md / AGENTS.ja.md: a subsection beside the untrusted-Markdown boundary, plus the new backend command and the dirname helper in the gotchas.
- README.md / README.ja.md: HTML is listed there as "source view only" with an explicit note that rendering is not implemented. Replace that wording, and say what stays inert (scripts, external references).

For the boundary itself, describe what actually contains the document: the sandbox flags, the CSP a srcdoc document inherits, the small set of elements removed for rendering reasons (base, iframe, frame), and the residual network exposure through CSS url() and remote images. Do NOT describe an element allowlist - decision-3 does not implement one, and documenting a defense layer that does not exist would misstate the security contract. decision-3 also records that the two layers are not equally broad (a relative script src is stopped by the sandbox alone), so do not write "two independent layers" without that caveat.

A behaviour found in TASK-5.1's visual round belongs here too, because a reader meets it as a broken player rather than as a disabled feature: a video inside a rendered document does not start playing when its controls are pressed, while the same file plays when opened directly in mallow (MediaView, same asset protocol, no frame). What was seen on 2026-08-18, precisely, was a <video> carrying a nested <source src> and no poster: it drew the file's first frame, so that reference was rewritten and fetched, and the controls then did nothing. The element beside it carried a poster and a src, and drew the poster - which says its poster reference fetched and nothing about its src, since a poster is shown instead of the first frame. Whether a bare <video src> fetches at all is the same question TASK-5.1's AC #6 is still open on, so one look closes both; do not write "the video loads but will not play" of that shape until it does. Observed on macOS / WKWebView only; the other two WebViews are unmeasured. The likely mechanism is the same family as decision-9's finding rather than a fault in the rewriting: WebKit implements its media controls in script, and the frame runs no script at all, so the controls render and do nothing. Do NOT write that mechanism as established, and do not write the behaviour as a property of every platform - say what was observed, where, and that opening the file itself plays it.

doc-1 and decision-3 name this task as the one that writes the HTML boundary up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The HTML untrusted-input boundary is described alongside the Markdown one in AGENTS.md and AGENTS.ja.md, in terms of sandbox flags plus the inherited CSP rather than an element allowlist
- [x] #2 AGENTS.md and AGENTS.ja.md gain the new backend command for opening a file outside mallow in their Backend section
- [x] #3 The gotchas list covers the dirname helper the subresource rewriting introduced
- [x] #4 README.md and README.ja.md replace TASK-6's source-only wording for HTML with what the rendered view actually shows, including what it leaves inert
- [x] #5 The user-facing documentation says a video inside a rendered document does not respond to its controls, describes what it does show in terms of what was actually observed for that shape (a nested source src drew the first frame; a poster drew the poster), names macOS / WKWebView as where that was seen and says the other WebViews are unmeasured, and points at opening the file itself as what plays it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Documentation only - no source changed, so there is no visual round for this task.

AC #2 needed no edit: TASK-5.3 already put open_in_default_app in the Backend section of both AGENTS.md and AGENTS.ja.md, with the rundll32 note beside it. Recorded here so the absence of a diff is not read as an omission.

AGENTS.md / AGENTS.ja.md gained three bullets. The untrusted-HTML boundary sits directly after the untrusted-Markdown one and before the dev-CSP bullet, which now follows both: sandbox flags as a pair, the inherited CSP as the second layer, decision-3's table spelled out so "two independent layers" cannot be written from it, the removal list (iframe / frame / base) named as rendering and network work rather than sanitization, and the residual CSS/remote-image exposure. The dirname bullet covers dirname and resolvePath as the pair TASK-5.1 introduced (f2c3ee0) - why the WebView has no Node path, why '..' trims the directory string rather than rebuilding it, and why the document-absolute case is answered in lib/html-doc instead. The video bullet is there so a contributor does not read a drawn-but-dead player as a rewriting fault.

README.md / README.ja.md: the source-only entry is replaced by six sub-bullets (default rendered view and toggle, what local media loads and what does not, links doing nothing on some platforms with the document's own table of contents included, the video behaviour, the source-view fallback, open in default app). The Security section gained a rendered-HTML bullet and its intro now says Markdown and HTML are contained by different mechanisms. The intro paragraph and the editors.rs line in Layout were updated to match.

The description's condition on the video shape is met. It said the bare <video src> question was still open on TASK-5.1's AC #6 and that "the video loads but will not play" must not be written until one look closed both. TASK-5.1's second visual round did close it (2026-08-19, macOS / WKWebView, built app): a poster-less <video src> and a nested <source src> each drew the file's first frame, and the controls then did nothing. So the loading half is written as observed, the mechanism is not written as established, macOS is named as the only measured platform, and opening the file itself is named as what plays it.

Deliberately not written: no element allowlist or sanitizer; not "two independent layers"; not "external references are blocked" as a blanket, since remote images load; nothing claiming the img-src / media-src difference was measured, since it stands on unit tests and the CSP text; and no platform name for the link behaviour - the frame is probed per document, so both READMEs say "some platforms" / 環境によって.

Verification (docs-only, so these are regression baselines rather than evidence for the change): vitest 16 files / 229 tests pass, biome ci 85 files 0 errors 0 warnings, tsc clean, vite build succeeds, and in src-tauri cargo fmt --check, cargo check and cargo test (16) all pass. Every number matches the TASK-5.3 baseline.
<!-- SECTION:NOTES:END -->
