---
id: TASK-16
title: Convert every implicit control-flow body to explicit blocks
status: To Do
assignee: []
created_date: '2026-08-07 22:33'
updated_date: '2026-08-14 05:03'
labels:
  - chore
milestone: m-0
dependencies:
  - TASK-14
  - TASK-15
priority: medium
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the gap TASK-14 documents: convert every implicit control-flow body to explicit block syntax, in one mechanical pass.

## What is actually there

**144 bodies**, counted from the TypeScript AST. Do not re-derive this with a regex over `if (…)` — that overcounts, because it backtracks into nested parentheses and reports braced bodies as bare. An earlier pass this way reported 151 and wrongly listed `src/lib/custom-emoji.ts:88`, which has a block.

| scope | if | else | for | while | total |
| --- | --- | --- | --- | --- | --- |
| non-test `src/` (29 of its 39 files) | 116 | 3 | 3 | 0 | **122** |
| `src/**/*.test.ts` | 5 | 0 | 0 | 0 | **5** |
| `scripts/*.mjs` | 12 | 0 | 4 | 1 | **17** |

Heaviest files in non-test `src/`: `App.tsx` 16, `lib/mermaid.ts` 11, `lib/mermaid-copy.ts` 9, `lib/custom-emoji.ts` 8, `components/ConfigTree.tsx` 7, then `lib/markdown.ts`, `components/MarkdownView.tsx`, `components/OpenWith.tsx` and `components/Outline.tsx` at 6 each.

Everything that is not an `if` is enumerated, since these are the cases a reviewer will want to find by eye:

- braceless `else` — `src/App.tsx:159`, `src/App.tsx:177`, `src/components/FileTree.tsx:75`
- braceless `for` in `src/` — `src/lib/markdown.ts:50`, `src/lib/markdown.ts:86`, `src/lib/mermaid-copy.ts:184`
- braceless `for` in `scripts/` — `gen-third-party-notices.mjs:151`, `:188`, `:193`, `release-version.mjs:171`
- the repo's only braceless `while` — `gen-third-party-notices.mjs:70`

`src-tauri/src/` needs no change — Rust requires the braces, so it already conforms, and Biome does not read Rust in any case.

## Expect a style reversal, not a cleanup

The dominant shape is the early return: `if (!dir) return;` at `src/App.tsx:53`, the type ladder at `src/components/ConfigTree.tsx:9-13`, the icon picks at `src/components/ThemePicker.tsx:15-16`, the platform picks at `src/components/OpenWith.tsx:9-10`. These are consistent and deliberate, so the diff will read as the codebase changing its mind, and it will touch nearly every file. That is the expected outcome, not a sign the scope slipped.

## Scope comes from TASK-15

TASK-15 decides what `biome.json` reads — `src/` only, or plus `src/**/*.test.ts`, or plus `scripts/*.mjs`. This task applies that decision and does not revisit it. If the scope excludes `scripts/*.mjs`, 17 of the 144 stay as they are, and that is the intended outcome rather than an omission to fix quietly.

## How to run it

```sh
biome lint --write --unsafe --only=lint/style/useBlockStatements
```

Three things about that command line are deliberate.

**`lint`, not `check`.** Biome 2.5.6 has an open bug where `check --write` applies formatting to files that have no lint findings at all, even under `--only` ([biomejs/biome#11023](https://github.com/biomejs/biome/issues/11023)). Measured on this repo, `check --write --unsafe --only=…` rewrote 46 of the 47 files in `src/` and 7,594 lines, including `src/shims.d.ts`, `src/lib/types.ts` and `src/lib/tauri.ts`, which contain no implicit bodies. The same run as `lint` touched 31 files and 254 lines. Use `lint`, and re-check whether the bug is fixed before assuming `check` is safe again.

**`--only=lint/style/useBlockStatements`.** Restricting to one rule is what makes "nothing else moved" checkable rather than hoped for, and it is what keeps `--unsafe` bounded. Biome classifies this rule's fix as unsafe; that is a blanket classification, not a measured claim about this rule on this code, and reading the diff is how the difference gets established.

**Formatting the touched lines belongs in this commit.** The fix emits `if (id === 'auto') { return SunMoonIcon; }` on one line and Biome's formatter then expands it — leave that unformatted and CI's format check goes red. This does not contradict keeping the diff clean, because TASK-15 has already formatted the whole scope in its own commit: the only formatting left to do here is on the lines this task just changed. Run the formatter after the fix, then confirm the tree is clean with a bare `biome format <paths>` — that is the non-writing check. There is no `--check` flag on `biome format` in 2.5.6 (`biome format --check` errors with *"`--check` is not expected in this context"*); it exits non-zero on a difference when given no write flag. `biome ci` covers it too.

What must still not ride along is **restructuring**: no early return turned into an if/else, no condition inverted, no comment relocated. `src/lib/markdown.ts:50` sits inside `ownKeysOnly`, whose comment at `src/lib/markdown.ts:40-47` is the prototype-pollution rationale — the loop gains braces and the comment does not move.

## Verification

Nothing about behaviour changes, so the existing checks are the whole story: `pnpm build`, `pnpm test`, `biome ci`, plus `cargo check` and `cargo test` to confirm the Rust side was genuinely untouched.

## Two things to close out afterwards

TASK-15 enables `style/useBlockStatements` at `warn` so the new CI check cannot fail on bodies this task had not yet fixed. **Raise it to `error` once the count reaches zero** — that is what stops the idiom coming back, and it is the last step here, not a follow-up.

TASK-14 writes a note into `AGENTS.md` and `AGENTS.ja.md` saying the control-flow gap is closed by this task. **Remove that note**, or it outlives the task and leaves a permanent document pointing at a finished backlog item.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No implicit control-flow body remains in the scope TASK-15 defined; biome lint with style/useBlockStatements reports zero
- [ ] #2 The fix was run as biome lint --write --unsafe --only=lint/style/useBlockStatements, not as check --write, and whether biome#11023 is still open was re-checked
- [ ] #3 A bare biome format over the scope exits zero at commit time; the formatting of the lines this task changed is in this commit, and no unrelated file was reformatted
- [ ] #4 style/useBlockStatements is raised from warn to error in biome.json as the final step, once the count is zero
- [ ] #5 All three parts of TASK-14's transition note are removed from AGENTS.md and AGENTS.ja.md - the two paragraphs under Control flow, the 'reviewer-enforced for now' qualifier on its label, and the 'see below' clause in the scope paragraph - so no permanent document points at a completed backlog item and no pointer is left dangling
- [ ] #6 The change is mechanical only - no early return restructured, no condition inverted, no comment moved, and markdown.ts:40-47 stays where it is
- [ ] #7 src-tauri/src is untouched, since Rust already conforms by language
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test all pass
- [ ] #2 The diff was read file by file for anything the fixer changed beyond adding braces
<!-- DOD:END -->
