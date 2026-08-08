---
id: TASK-14
title: Write the coding style into the project conventions
status: To Do
assignee: []
created_date: '2026-08-07 22:31'
updated_date: '2026-08-08 00:23'
labels:
  - documentation
dependencies: []
priority: medium
type: docs
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write the Comments / Control flow / Functions rules into the repository's own conventions, so they bind contributors and agents rather than living only in a personal config.

## Where it goes

`AGENTS.md` has `## Conventions` at line 63 and `AGENTS.ja.md` has `## 規約` at line 64. `CLAUDE.md` is a symlink to `AGENTS.md`, so writing it once covers both audiences. Both language versions are kept in sync in this repo, so the Japanese text is part of this task, not a follow-up.

## Two rules already there that the new text overlaps

The existing Conventions list carries `Code comments in English`, which the Comments subsection has to absorb rather than restate beside it. It also carries `SCSS only — never introduce Tailwind`, which is untouched by this change and should stay where it is.

## The Control flow rule does not match the code on the day it lands

**144** implicit control-flow bodies exist today, counted from the TypeScript AST rather than by pattern-matching source lines (a regex over `if (…)` overcounts — it backtracks into nested parentheses and reports braced bodies as bare):

| scope | if | else | for | while | total |
| --- | --- | --- | --- | --- | --- |
| non-test `src/` (29 of its 39 files) | 116 | 3 | 3 | 0 | 122 |
| `src/**/*.test.ts` | 5 | 0 | 0 | 0 | 5 |
| `scripts/*.mjs` | 12 | 0 | 4 | 1 | 17 |

The dominant shape is the early return `if (!dir) return;` — a consistent, deliberate idiom, not drift. So the document must say which way the gap closes, with a pointer to the follow-up task, or a reader will take the mismatch for an oversight and copy whichever side they happened to read first.

## Retroactive or forward-only

The Comments rules are the ones where this matters. Current code largely conforms already — `src/lib/markdown.ts:40-47`, `src/lib/markdown.ts:132-140` and `src/lib/mermaid.ts:27-32` are why / why-not comments of exactly the kind the rule asks for. The known gaps are narrower:

- Doc comments that restate the name or signature: `src/lib/markdown.ts:70`, `src/lib/config-parse.ts:20`, `src/lib/config-parse.ts:41`, `src-tauri/src/watch.rs:37`, `src-tauri/src/commands.rs:98`, `src/components/MermaidView.tsx:4`, `src/hooks/useFileTree.ts:122`.
- 16 section-divider banners (`// ---- Custom emoji ----` and friends): `src/App.tsx` x5, `src/components/icons.tsx` x5, `src-tauri/src/editors.rs` x4, `scripts/gen-third-party-notices.mjs` x2. The SCSS carries the same form in quantity; whether stylesheets are in scope for the Comments rule at all is part of the retroactive-or-forward question below. The `editors.rs` ones mark `#[cfg]` per-OS implementation blocks and carry real structure; the other ten are navigation labels.
- Roughly half of the 18 `/** lucide: ... */` labels in `src/components/icons.tsx`. `/** lucide: settings */` on `SettingsIcon` is pure restatement; `/** lucide: file-braces-corner (json / yaml / toml config) */` on `FileConfigIcon` records an upstream name the export name does not preserve.

Decide and write down whether the rules apply retroactively or only to new and changed code. Forward-only is the safer reading — reshaping untouched comments to satisfy a freshly written rule is exactly the churn the Functions rule warns against — but leaving it implied invites both interpretations.

While in there: `src/hooks/useFileTree.ts:5-7` cites "(P4)" and "(P6)", plan identifiers that no longer resolve to anything in the repo. **Do not fix it here** — this task changes documentation only, and the Definition of Done says so. If the answer above is "retroactive", file the comment cleanup as its own task; if it is "forward-only", the citation stays until that block is edited for another reason.

## Do not write what nothing will check

The Control flow rule becomes machine-enforceable in TASK-15 via Biome's `style/useBlockStatements`. The Comments and Functions rules do not — no linter judges whether a comment restates its code or whether an extraction improves abstraction. Anything written here that no tool will ever check is a rule that decays; either keep it to what a human reviewer can reasonably hold, or name it as reviewer-enforced.

Note also that TASK-15 selects Biome and leaves SCSS and Markdown unformatted deliberately. If the conventions text says anything about formatting, it has to match that scope rather than imply a repo-wide formatter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AGENTS.md carries the Comments, Control flow and Functions rules under Conventions, and AGENTS.ja.md carries the same rules in Japanese
- [ ] #2 The pre-existing 'Code comments in English' bullet is folded into the Comments text rather than left beside it as an overlapping rule
- [ ] #3 The document states whether the rules apply retroactively or only to new and changed code
- [ ] #4 The Control flow rule's gap against the 144 implicit bodies in the current tree is acknowledged with a pointer to TASK-16, so the mismatch cannot be read as an oversight
- [ ] #5 Any rule that no tool will check is either kept to what a reviewer can hold or explicitly named as reviewer-enforced
- [ ] #6 The SCSS-only / no-Tailwind rule is left untouched
- [ ] #7 No code is changed - the useFileTree.ts P4/P6 citation is filed as a separate task if retroactive edits were chosen, not fixed here
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 AGENTS.md and AGENTS.ja.md say the same thing; no code changes are mixed into this task
<!-- DOD:END -->
