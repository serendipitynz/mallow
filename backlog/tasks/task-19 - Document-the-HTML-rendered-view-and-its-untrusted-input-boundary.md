---
id: TASK-19
title: Document the HTML rendered view and its untrusted-input boundary
status: To Do
assignee: []
created_date: '2026-08-17 03:09'
updated_date: '2026-08-18 11:56'
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

A behaviour found in TASK-5.1's visual round belongs here too, because a reader meets it as a broken player rather than as a disabled feature: a video inside a rendered document draws its poster or first frame - the local reference is rewritten and fetched - but its controls do not start playback, while the same file plays when opened directly in mallow (MediaView, same asset protocol, no frame). Observed on macOS / WKWebView only, on 2026-08-18; the other two WebViews are unmeasured. The likely mechanism is the same family as decision-9's finding rather than a fault in the rewriting: WebKit implements its media controls in script, and the frame runs no script at all, so the controls render and do nothing. Do NOT write that mechanism as established, and do not write the behaviour as a property of every platform - say what was observed, where, and that opening the file itself plays it.

doc-1 and decision-3 name this task as the one that writes the HTML boundary up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The HTML untrusted-input boundary is described alongside the Markdown one in AGENTS.md and AGENTS.ja.md, in terms of sandbox flags plus the inherited CSP rather than an element allowlist
- [ ] #2 AGENTS.md and AGENTS.ja.md gain the new backend command for opening a file outside mallow in their Backend section
- [ ] #3 The gotchas list covers the dirname helper the subresource rewriting introduced
- [ ] #4 README.md and README.ja.md replace TASK-6's source-only wording for HTML with what the rendered view actually shows, including what it leaves inert
- [ ] #5 The user-facing documentation says a video inside a rendered document may show its poster or first frame while its controls do nothing, names macOS / WKWebView as where that was observed and says the other WebViews are unmeasured, and points at opening the file itself as what plays it
<!-- AC:END -->
