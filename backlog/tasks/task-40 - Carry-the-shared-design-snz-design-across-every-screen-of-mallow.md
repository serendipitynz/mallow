---
id: TASK-40
title: Carry the shared design (snz-design) across every screen of mallow
status: To Do
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-28 05:34'
labels:
  - design
milestone: m-4
dependencies: []
references:
  - ../snz-design
priority: high
type: feature
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow's side of snz-design TASK-19 (complete the shared design across mallow's UI). snz-design is the shared design specification for the serendipitynz apps; check it out beside this repository as `../snz-design`. The trial (TASK-39, local branch `trial/snz-design-tokens`) put the shared colour tokens on the theme and settings UI only. This task carries the shared design to every screen and component of mallow.

Before building or changing a screen, read snz-design doc-16 (the adoption guide for the four Web apps) and snz-design's adoption record for mallow ("mallowの共通デザイン適用記録", created alongside the first subtask by the template in doc-16 §10, as snz_studio's doc-17 was). The changes the subtasks carry come from the mallow rows of snz-design doc-13 §10 and doc-14 §7, and from doc-16 §7.2.

Work is split by screen into the subtasks, one PR each. The first subtask holds the colour foundation and the basic controls; the others build on it. A subtask being Done does not by itself complete snz-design TASK-19: the adoption record is updated with each merged revision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every subtask is Done, and snz-design's adoption record for mallow lists each subtask with its merged revision
- [ ] #2 Every screen and component in the adoption record has a result; no required item is left unapplied, and each intentional exception has its reason and handling
- [ ] #3 The four schemes (Standard Light / Dark, Solarized Light / Dark) meet the contrast criteria, stored settings are kept, and the keyboard reaches every control; the environment and evidence are recorded (snz-design doc-5 §5.3). Checks in the real window (WKWebView) record the owner's confirmation
- [ ] #4 Document, code and mermaid rendering, the explorer, the toolbar, the settings and the theme sync across several windows are regression-checked; Dracula and Nord keep their own palettes
- [ ] #5 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
