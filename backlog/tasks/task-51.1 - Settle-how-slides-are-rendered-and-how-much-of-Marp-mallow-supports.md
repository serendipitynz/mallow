---
id: TASK-51.1
title: Settle how slides are rendered and how much of Marp mallow supports
status: To Do
assignee: []
created_date: '2026-11-11 01:30'
labels:
  - feature
dependencies: []
references:
  - src/lib/markdown.ts
  - src-tauri/tauri.conf.json
  - 'https://marpit.marp.app/directives'
  - 'https://github.com/marp-team/marp-core'
parent_task_id: TASK-51
priority: medium
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-51 turns on one choice: render decks with `@marp-team/marp-core`, or as a subset of Marp on mallow's own markdown-it pipeline. This task measures both far enough to choose, and records the choice as a decision.

To measure for marp-core: what its HTML allowlist lets a document put into the DOM compared with `html: false`, and whether it can be configured down to `html: false`; whether it can run with math and remote emoji off; whether its output runs under the shipped CSP (`pnpm tauri build --debug --no-bundle`, since dev has no CSP); what it adds to the bundle; whether Shiki highlighting, mermaid diagrams and custom emoji can reach its slides; its licence for THIRD-PARTY-NOTICES.

To measure for the subset: which Marp features a typical deck actually uses, so the subset is chosen against real decks rather than the whole directive list — at least the split, `paginate`, `header` / `footer`, `class` and `_`-scoped local directives, `backgroundColor`, and `![bg]`.

Either way, settle: the slide's aspect ratio and how it scales to the window (Marp's default is 16:9, 1280×720), how the slide's theme relates to mallow's colour family and light / dark mode, and how a deck reports Marp features it does not support (a notice, as `highlightSkipped` does, rather than silence).

A new production dependency needs the owner's approval before it is added (AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both routes are measured on the points listed, against the built app's CSP, and the numbers are recorded in the task
- [ ] #2 A decision records the route, the supported Marp subset, the slide size and scaling, the theme rule, and how unsupported features are reported
- [ ] #3 If the route adds a production dependency, the owner has approved it before anything depends on it
<!-- AC:END -->
