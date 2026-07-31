---
id: TASK-6
title: Document the new file kinds and the HTML untrusted-input boundary
status: To Do
assignee: []
created_date: '2026-07-30 08:56'
updated_date: '2026-07-30 10:45'
labels:
  - documentation
dependencies:
  - TASK-1
  - TASK-2
  - TASK-3
  - TASK-4
  - TASK-5
  - TASK-7
  - TASK-8
  - TASK-9
  - TASK-10
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the docs once the viewer work lands.

- README.md / README.ja.md: supported formats, and the Security section for the HTML boundary.
- AGENTS.md / AGENTS.ja.md: architecture plus gotchas - the file_kind and kindFromName duplication, the CSV row and cell caps, the DOMParser/Vitest constraint, and the XML error-position fallback.
- tauri.conf.json: bundle.shortDescription and longDescription, if the positioning wording changes.

For the HTML boundary, describe what actually contains the document: the sandbox flags, the CSP inherited by srcdoc, the small set of elements removed for rendering reasons (base, iframe, frame), and the residual network exposure through CSS url() and remote images. Do NOT describe an element allowlist - decision-3 does not implement one, and documenting a defense layer that does not exist would misstate the security contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README.md and README.ja.md list the newly supported formats
- [ ] #2 The HTML untrusted-input boundary is described alongside the Markdown one in AGENTS.md and AGENTS.ja.md, in terms of sandbox plus inherited CSP rather than an allowlist
- [ ] #3 AGENTS.md gains the new backend command for opening a file outside mallow in its Backend section
- [ ] #4 The gotchas list covers the file_kind and kindFromName duplication, the CSV row and cell caps, the XML error-position fallback, the skipped-highlighting threshold and the dirname helper
- [ ] #5 The read_file contract is updated wherever it is documented, including the UTF-8-only wording and the move of BOM stripping into the backend
- [ ] #6 The absence of a CSP under pnpm tauri dev is recorded as a gotcha, since it removes the second containment layer during development
<!-- AC:END -->
