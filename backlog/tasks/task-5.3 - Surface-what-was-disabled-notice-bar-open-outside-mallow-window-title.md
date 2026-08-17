---
id: TASK-5.3
title: 'Surface what was disabled: notice bar, open outside mallow, window title'
status: To Do
assignee: []
created_date: '2026-07-30 10:26'
updated_date: '2026-08-17 05:56'
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
- [ ] #1 The notice bar reports counts for inert scripts, external references and unrewritable local stylesheet or font references
- [ ] #2 The open-outside-mallow action works on a file in a folder the user picked anywhere on disk, not only under the home directory
- [ ] #3 The action's label matches what it actually does
- [ ] #4 The window title follows the document's title element when present and falls back to the file name, with a single writer
- [ ] #5 New i18n keys are added to both the ja and en dictionaries
- [ ] #6 pnpm build, pnpm test, cargo check and cargo test all pass
- [ ] #7 The title comes from the transform result produced in TASK-5.1, not from a second parse of the document
<!-- AC:END -->
