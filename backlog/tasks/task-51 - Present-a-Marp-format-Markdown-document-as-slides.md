---
id: TASK-51
title: Present a Marp-format Markdown document as slides
status: To Do
assignee: []
created_date: '2026-11-11 01:30'
labels:
  - feature
dependencies: []
references:
  - src/components/MarkdownView.tsx
  - src/lib/markdown.ts
  - src/lib/frontmatter.ts
  - 'https://marpit.marp.app/directives'
  - 'https://github.com/marp-team/marp-core'
priority: medium
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow shows a Markdown document as a preview or as its source. A document written as a slide deck — slides separated by `---`, the deck switched on by front matter — has no view that shows it as slides, so a reader who writes decks in Markdown has to leave mallow to present them. This task adds a slide view and a presentation mode for such documents, and a laser pointer for presenting.

**The format is Marp's** (Marpit's slide split and directives): a document whose front matter carries `marp: true` is a deck, and its slides are separated by a horizontal rule. Taking an existing format rather than inventing one means a deck written for mallow also opens in Marp's own tools and the VS Code extension, and the reverse. How much of Marp is supported — the split alone, the global and local directives (`theme`, `paginate`, `header`, `footer`, `class`, `backgroundColor`, `_`-scoped ones in HTML comments), the image extensions (`![bg]`, `![w:200]`), speaker notes — is the first subtask's to settle, along with the route.

**The route is the decision this task turns on**, because the two candidates do not keep the same promises:
- `@marp-team/marp-core` renders Marp completely, but it is a new production dependency carrying its own markdown-it, its own HTML allowlist in place of mallow's `html: false`, math, and remote twemoji images by default — each of which crosses a boundary AGENTS.md records (the untrusted-Markdown boundary, "Math (KaTeX) is intentionally not implemented", the CSP), and Shiki, mermaid and custom emoji would not reach its slides without wiring.
- A subset on mallow's own pipeline (split the rendered markdown at the top-level `hr` of a `marp: true` document, apply a chosen set of directives) keeps every existing boundary and enhancement, at the cost of decks that use the unsupported part rendering differently from Marp.

Subtasks:
- TASK-51.1 — settle the route and the supported subset, recorded as a decision.
- TASK-51.2 — the slide view and the presentation mode.
- TASK-51.3 — the laser pointer.

Out of scope until asked for: a presenter view with notes and a timer in a second window, exporting the deck as PDF (the print stylesheet is markdown-prose-only — decision-14), editing, and slide transitions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Markdown document whose front matter carries marp: true can be shown as slides, and presented full-screen with a laser pointer, per the subtasks
- [ ] #2 The rendering route and the supported Marp subset are recorded as a decision before the view is built
- [ ] #3 No boundary AGENTS.md records (untrusted Markdown, CSP, no math) is widened without that decision saying so
<!-- AC:END -->
