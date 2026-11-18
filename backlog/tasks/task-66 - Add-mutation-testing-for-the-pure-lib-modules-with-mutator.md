---
id: TASK-66
title: Add mutation testing for the pure lib modules with mutator
status: To Do
assignee: []
created_date: '2026-11-17 23:07'
labels:
  - chore
dependencies: []
references:
  - 'https://github.com/mizchi/mutator'
  - 'https://zenn.dev/mizchi/articles/mutation-test-quality'
  - package.json
  - vitest.config.ts
  - biome.json
  - .gitignore
  - src/lib/delimited.ts
  - src/lib/find.ts
  - src/lib/html-doc.ts
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Line coverage no longer tells us much about the tests in `src/lib`. Mutation testing checks whether a test fails when the code under it changes, which is what line coverage cannot show. This task adds `@mizchi/mutator` (Vitest-native mutation testing, https://github.com/mizchi/mutator; background in https://zenn.dev/mizchi/articles/mutation-test-quality) for the pure modules in `src/lib`. The owner approved adding it as a devDependency on 2026-11-18.

**Coverage today** (measured 2026-11-18 with `@vitest/coverage-v8` 5.1.0 in a scratch clone, 706 tests). Overall: 28.3% of lines, 30.6% of branches. `src/lib`: 70.1% of lines, 75.4% of branches. The pure modules in `src/lib` are at about 91% of lines, and most of them at 90–100%. `src/components`, `src/hooks`, `App.tsx` and `src/probe` are at 0%, because the suite runs under Node with no DOM by design. Coverage is not being adopted by this task.

**Trial run** (2026-11-18, the same clone, `@mizchi/mutator` 0.2.0, six modules, 1,267 mutants, 374 of them dropped by the type check):

| module | line cov. | mutation score |
|---|---|---|
| delimited.ts | 100% | 85.3% |
| tree-arrange.ts | 98.4% | 82.5% |
| visit-history.ts | 100% | 81.3% |
| find.ts | 98.5% | 67.3% |
| settings-sync.ts | 92.3% | 54.8% |
| html-doc.ts | 56.8% | 44.5% |

- The cold run took 5 min 39 s. After a one-line edit, `--since HEAD` took 11 s and reused 717 results.
- Some survivors look like real gaps in the tests:
  - `delimited.ts:173`: `text[i + 1] === '\n'` replaced with `true` survives. No test checks a lone CR line ending.
  - `delimited.ts:155`: `storedCells += 1` replaced with `-= 1` survives. No test observes storing stop at the cell budget at line 188.
  - `find.ts:55-56`: the CJK range boundaries are never tested at the boundary values.
- Other survivors are equivalent mutants, which change nothing a caller can observe. For example, `end < n` → `end <= n` at `delimited.ts:109` reads one past the end and slices the same text.

**Decisions this task makes**

- **Version.** The user-level pnpm `minimum-release-age` (7 days) held the trial at 0.2.0 while 0.3.0 was out. Take whatever `pnpm add -D` resolves then, and record it. The package is 0.x, so expect breaking changes between minors.
- **Where the settings live.** Use either CLI flags in a `package.json` script or a `mutator.config.ts`. Biome's `files.includes` is an explicit list, so a config file at the root has to be added to it, and to `tsconfig` if it is type-checked.
- **Scope.**
  - Include `src/lib/**`.
  - Exclude the modules that need the DOM or Tauri, which have no tests by design: `codeblock`, `find-dom`, `i18n`, `mermaid`, `mermaid-copy`, `scroll`, `settings`, `slide-theme-folder`, `tauri`, `theme`, `watch`, `render-signal`. Recheck this list against coverage when the task starts.
  - Exclude `scripts/` too. `measure-paper.test.mjs` runs its code in a child process, which mutator cannot see.
- **Critical modules.** The untrusted-input boundary modules (`markdown.ts`, `html-doc.ts`, `deck-css.ts`, `slide-theme-css.ts`) are candidates for `--critical`. A surviving mutant in one of them then fails the run. Decide whether to use this, and record why either way.
- **Not in `check.yml`.**
  - Every CI workflow pins Node 22, and mutator needs Node 24 or later.
  - A cold run is minutes long and grows with `src/lib`.
  - Mutation score is a refactoring signal rather than a pass/fail gate.
  - Usage is local: `--since main` while working on a branch, and a full run now and then. A scheduled workflow would be its own task.
- **Files.**
  - `.mutator/` holds the cache and the reports, and goes into `.gitignore`.
  - `mutator.accepted.json` holds the equivalent mutants accepted with `mutator accept --reason`, and is tracked.
  - The HTML reporter loads a component from unpkg, so text and json are what work offline.

**Out of scope.**
- Rust: mutator does not cover it. `cargo-mutants` would be a separate task.
- The UI layer, which has no tests.
- `src/hooks`, which has no tests either, so every mutant there would only read as not reached. TASK-67 moves the decisions left in the hooks into `src/lib`, where this task's scope reaches them.
- The agent skills `mutator init-skill` copies into `.claude/skills`, unless the owner asks for them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @mizchi/mutator is a devDependency added with pnpm, its version recorded in the task notes, and pnpm notices shows no diff
- [ ] #2 One pnpm script runs it over src/lib with the DOM- and Tauri-bound modules and scripts/ excluded, and any config file it reads is inside Biome's scope
- [ ] #3 Whether the untrusted-input boundary modules are marked critical is decided, and the reason is recorded
- [ ] #4 .mutator/ is git-ignored, and every entry in mutator.accepted.json carries a reason
- [ ] #5 A full cold run over src/lib is done, and each module's score and the run time are recorded in the task notes
- [ ] #6 The gaps the trial found are killed by new tests: a lone CR line ending and the cell budget in delimited.ts, and the CJK range boundaries in find.ts
- [ ] #7 AGENTS.md and AGENTS.ja.md say when to run it (--since main while on a branch), why it is not in check.yml, and that it needs Node 24 or later
- [ ] #8 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
