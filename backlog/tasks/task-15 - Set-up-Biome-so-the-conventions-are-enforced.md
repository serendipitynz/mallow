---
id: TASK-15
title: Set up Biome so the conventions are enforced
status: To Do
assignee: []
created_date: '2026-08-07 22:32'
updated_date: '2026-08-08 00:41'
labels:
  - chore
dependencies:
  - TASK-14
priority: medium
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the written conventions a tool that enforces them, and give TASK-16 the mechanism that makes it a fix run instead of 144 hand edits. **Biome, not ESLint + Prettier.** Verified against Biome 2.5.6.

## Nothing enforces anything today

There is no lint or format config of any kind: no `eslint.config.*`, no `.prettierrc*`, no `biome.json`, no `rustfmt.toml`. `package.json` has no lint or format script — `pnpm build` is `tsc && vite build`, `pnpm test` is `vitest run`. `.github/workflows/` contains only `release.yml`, which runs `pnpm install --frozen-lockfile` and the Tauri build and never runs `pnpm test`. No check of any kind runs on a change today.

## Why Biome

One devDependency against the four to six an equivalent ESLint setup needs (eslint, typescript-eslint, eslint-plugin-react-hooks, prettier, probably eslint-plugin-jsx-a11y and a bridge), which is what AGENTS.md's "Prefer minimal dependencies" asks for. Every rule this task needs exists:

- `style/useBlockStatements` — the `curly` equivalent, and TASK-16's mechanism.
- `correctness/useExhaustiveDependencies` — the react-hooks concern.
- `a11y/noStaticElementInteractions` — the `Explorer.tsx:53` concern, and recommended, so on by default.

## SCSS is out of scope, and it cannot be worked around

Biome's language support lists SCSS as in progress for parsing and formatting, and not started for linting. Both ways of forcing it were measured on this repo:

- A `.scss` file handed to `biome check` is silently skipped — *"These paths were provided but ignored"*. No error, no output.
- Renamed to `.css` so the CSS parser takes it, `_vars.scss` produces **199 parse errors** and `global.scss` **40** (measured with `--max-diagnostics=5000`; the default caps the display at 20, so a casual run understates it). `_vars.scss` fails on its first line with `Expected a qualified rule, or an at rule but instead found '//'`; `global.scss` opens with `@use`, which the CSS parser accepts as an at-rule, and fails on line 4 instead.

That is not a near miss. This repo's 1,688 lines of SCSS use 116 `//` line comments, 5 `@use`, 7 `@mixin`, 10 `@include`, 24 `$variable` declarations and 6 `#{}` interpolations. None of it is CSS.

**This is not a regression:** no formatter runs today, so SCSS stays exactly as it is — hand-maintained, reviewed by eye. Biome's 2026 roadmap names SCSS as its most-wanted feature with work started, so the gap is expected to close on its own.

**Do not add Prettier just for SCSS.** That reinstates the two-tool setup this choice exists to avoid, for files that are not being formatted today anyway.

### stylelint on the SCSS was evaluated and rejected

Stylelint is a linter, not a formatter — it deprecated its stylistic rules in v15 and removed them in v16, and its own guidance is to use a pretty printer for formatting. So it would not have closed the formatting gap above. The question is whether it earns its place as a *checker*. Measured against this repo's six files with stylelint 17.14.1:

- `stylelint-config-recommended-scss`, the error-focused config: **1 finding across 1,688 lines**, and it is a false positive — `scss/comment-no-empty` on `_vars.scss:2`, which is the bare `//` line inside an ordinary multi-line `//` comment block.
- `stylelint-config-standard-scss`, the opinionated config: **85 findings, none of them defects.** The full tally: 62 `selector-class-pattern`, 14 `scss/double-slash-comment-empty-line-before`, 6 `value-keyword-case`, 1 `scss/comment-no-empty`, 1 `property-no-vendor-prefix`, 1 `color-hex-length`.

  The 62 demand kebab-case, which rejects the BEM `__element` / `--modifier` naming this codebase uses deliberately throughout (`.app__footer`, `.doc__bar`, `.media-view--image`). The 6 `value-keyword-case` want CSS keywords lowercased — three font names (`SFMono-Regular`, `Menlo`, `Consolas`), `optimizeLegibility`, and two `currentColor`. One finding — `property-no-vendor-prefix` on `-webkit-backdrop-filter` at `src/styles/markdown.scss:37` — is advice that is **actively wrong here**, since this app's macOS WebView is WKWebView.

The real safety net already exists and already runs: `sass` fails the build on an undefined variable (`Error: Undefined variable.`), a bad `@use`, or a syntax error, and `pnpm build` compiles the stylesheets on every run. Adding two devDependencies, a config file, and four rule suppressions to find nothing is not a trade worth making. Revisit if the stylesheets grow well beyond their current size or gain a second author.

Markdown is in the same state (in progress) and matters even less: the repository tracks over forty `.md` files and the large majority are backlog tasks, which a formatter would have churned for no benefit and would have been ignored regardless.

## useBlockStatements, and the ordering problem it creates

It is **not recommended by default**, so it must be enabled explicitly in `biome.json`. And its **fix is classified unsafe**, so TASK-16 runs `biome lint --write --unsafe --only=lint/style/useBlockStatements` — `lint` rather than `check`, for reasons TASK-16 sets out. Do not substitute `check --write` here or there.

**This task must not leave CI failing.** Enabling the rule at `error` and wiring the CI workflow in the same task would put 144 diagnostics in front of a required check, because the task that fixes them — TASK-16 — runs afterwards. Enable it at **`warn` here, and let TASK-16 raise it to `error`** as its final step, once the count is zero.

That works because `biome ci` fails on errors but not on warnings — unless it is given `--error-on-warnings`. **Do not pass that flag** while any rule is parked at `warn`; adding it later, once nothing is parked, is a reasonable tightening.

## Format the whole scope here, once — but choose the settings first

**Biome's formatter defaults do not match this codebase.** It defaults to tab indentation and double quotes; the source is two-space indented and single-quoted. Run it as-is and the reformat is roughly **7,357 lines across 46 of the 47 files in `src/`**, plus 559 in `scripts/`, and `package.json` and `tsconfig.json` convert to tabs. That is more than sixty times the size of the Rust reformat this task already treats as worth a deliberate decision.

So settle `formatter.indentStyle`, `formatter.indentWidth`, `formatter.lineWidth`, `javascript.formatter.quoteStyle` and `javascript.formatter.semicolons` against what the code already looks like, exactly as `rustfmt.toml` is settled against the Rust. Taking the defaults is a legitimate choice, but it has to be a choice rather than a default fallen into.

Matching the existing style shrinks the reformat by an order of magnitude but does not eliminate it. With `indentStyle: space`, `indentWidth: 2` and `quoteStyle: single` fixed, `lineWidth` still moves it:

| lineWidth | `src/` diff | files |
| --- | --- | --- |
| 80 | 1,517 | 33 / 47 |
| 100 | 779 | 24 / 47 |
| 120 | 593 | 13 / 47 |
| **130** | **573** | **10 / 47** |
| 140 | 614 | 14 / 47 |

`scripts/` adds 145–200 lines on top. And the composition matters more than the total: **472 of those 573 lines are `src/lib/markdown.test.ts` alone**, because Biome expands the three-argument `it('…', async () => {…}, TIMEOUT)` calls across lines — restructuring the security-boundary tests wholesale. So the scope decision above governs the size of this commit: excluding `src/**/*.test.ts` takes the reformat from roughly 573 lines to roughly 81. Decide the scope first, then measure, then commit.

`semicolons` is worth naming explicitly because the answer is not uniform: `src/` and `scripts/gen-third-party-notices.mjs` terminate statements, `scripts/release-version.mjs` never does. Biome's `"always"` default is right for `src/`, and `asNeeded` would expand it by 3,869 lines across 46 files.

Then run the formatter over every file in the scope, as its own commit — not just over files that happen to change. TASK-16 depends on it: Biome's lint fix emits `if (x) { return y; }` on one line and the formatter then expands it, so unless the tree is already formatted, TASK-16 cannot both add braces and leave CI's format check green. Landing the bulk reformat here keeps TASK-16's diff to the braces and their own lines.

## This task decides the scope, TASK-16 follows it

`biome.json` has to name what Biome reads before anything can be fixed, so the scope decision belongs here — not in TASK-16, which merely applies it. State it as an include list plus an explicit exclude list, because the obvious phrasings overlap: the unit tests live at `src/**/*.test.ts`, so "src/ only" already contains them unless they are excluded by name. Three files sit outside every candidate and need an explicit answer either way: `vite.config.ts`, `vitest.config.ts`, and `scripts/*.mjs`. Whatever is chosen, `scripts/*.mjs` is worth a deliberate answer rather than a default: it holds 17 of the 144 bodies, including the only `while` in the repo (`scripts/gen-third-party-notices.mjs:70`).

## Explorer.tsx:53 needs rewriting, not just deciding

`src/components/Explorer.tsx:53` carries `// eslint-disable-next-line jsx-a11y/no-static-element-interactions`. **Biome does not read ESLint directives at all**, so that line becomes an ordinary comment while `a11y/noStaticElementInteractions` — recommended, hence enabled — fires on the code underneath. Either fix the underlying accessibility problem, or rewrite the suppression as `// biome-ignore lint/a11y/noStaticElementInteractions: <explanation>`. Biome requires the explanation, which is the same thing TASK-14's Comments rule asks for.

## What the recommended set actually reports: 34 findings, 13 rules

Measured, not guessed. Turning on `linter.rules.recommended` alone produces **34 findings across 13 rules** over `src/`. (Including `scripts/*.mjs` in the scope adds one more, a `style/useTemplate` at `scripts/gen-third-party-notices.mjs:205`.) Three rules decide how big this task is:

**`security/noDangerouslySetInnerHtml` — 2 findings**, at `src/components/MarkdownView.tsx:168` and `src/components/SourceView.tsx:51`. This is recommended and its severity is error, and it fires on the app's central rendering mechanism — the one AGENTS.md devotes its "Untrusted-Markdown boundary" section to justifying. CI cannot go green until both are suppressed. Suppress them with `biome-ignore` comments that point at that section by name; do not weaken the rule globally, or a future unjustified `dangerouslySetInnerHTML` lands silently.

**`a11y/noStaticElementInteractions` — 2 findings, not 1.** `src/components/Explorer.tsx:54` is the one with the stale ESLint directive; `src/components/SettingsModal.tsx:39` is an overlay `div` with `onMouseDown` and `role="presentation"`, and it has no suppression at all. Fixing only the first leaves CI red.

**`correctness/useExhaustiveDependencies` — 10 findings**, at `src/components/Viewer.tsx:28` (7 of them), `src/components/MarkdownView.tsx:51`, and `src/components/MediaView.tsx:47` and `:59`. Note what is *not* flagged: the ref-mirroring effects at `src/App.tsx:33-42`, the `[result, mode]` dependency list at `src/components/MarkdownView.tsx:107`, and the render-time `resultRef.current` assignment at `src/components/MarkdownView.tsx:46` all pass. An earlier draft of this task named those three; that was speculation and it was wrong.

The remaining 20 are spread over `a11y/useSemanticElements` (6), `complexity/useOptionalChain` (3), `suspicious/useIterableCallbackReturn` (3), `style/noNonNullAssertion` (2), and one each of `style/useTemplate`, `style/useImportType`, `suspicious/noAssignInExpressions`, `a11y/useFocusableInteractive`, `a11y/useAriaPropsForRole` and `a11y/useMediaCaption`.

Triage all 34 before wiring CI. Each one is either fixed, or suppressed with a stated reason — nothing is silenced by turning a rule off wholesale unless the rule itself is a bad fit for this project, which is a separate judgement to write down.

## JSON formatting reaches config files

Biome formats JSON and JSONC. The tracked JSON in this repo is six files: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `.vscode/extensions.json`, `src-tauri/tauri.conf.json` and `src-tauri/capabilities/default.json`. Two things to check rather than assume:

- `scripts/release-version.mjs:179` rewrites versions with a regex `.replace()` on raw text, not a JSON round-trip, so a reformat does not corrupt it — but its patterns must still match afterwards. Run `pnpm release --dry-run` after the reformat.
- Generated output (`src-tauri/gen/schemas/`, `dist/`, `src-tauri/target/`) must not be formatted. `dist/` and `src-tauri/target/` are already in `.gitignore`, so enabling Biome's `vcs.useIgnoreFile` covers them without a second list; check whether `src-tauri/gen/` needs an explicit entry.

## CI: this repository gets its first check workflow

Decided: lint runs in CI. There is nothing to bolt it onto — `.github/workflows/` holds only `release.yml`, which builds on a pushed `v*` tag and never runs `pnpm test`. So this task adds a workflow that runs on pull requests and on pushes to the default branch.

What it runs should be the same set `AGENTS.md`'s "Verifying changes" already names, plus the new checks, so the documented list and the enforced list cannot drift apart:

- `biome ci` over the scope decided above — `ci` rather than `check`, since it is the non-writing variant intended for this
- `pnpm build` and `pnpm test`
- `cargo fmt --check`, `cargo check` and `cargo test` inside `src-tauri/`

Including the tests is a judgement call worth making explicitly rather than by omission: they have never been enforced, so the first run may surface something. Run it once before wiring the branch protection, and if a pre-existing failure appears, fix it or exclude it deliberately — do not disable the step.

Note the Rust half needs the Linux system dependencies `release.yml:134-142` already installs (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`); reuse that step rather than rediscovering it.

## Rust: cargo fmt is adopted

Decided: `cargo fmt` joins the documented commands. Three consequences.

**Pick the configuration deliberately.** There is no rustfmt configuration that leaves the current source untouched — measured with rustfmt 1.9.0 against `src-tauri/src/` (diff lines counted excluding `diff -u` file headers; hunk counts vary with the context setting, so compare the line counts):

| config | diff |
| --- | --- |
| default (`max_width=100`) | 122 lines, 18 hunks |
| `max_width=120` | 86 lines, 11 hunks |
| `max_width=120, use_small_heuristics=Max` | 44 lines, 7 hunks (minimum found) |

The defaults expand compact struct literals — `entries.push(FileEntry { name, path: full, is_dir: true, kind: "directory".into() });` becomes six lines, because `struct_lit_width` defaults to 18 and widening `max_width` alone does not reach it. Loosen it far enough to stop that and rustfmt starts collapsing chains the author deliberately broke, such as `app.asset_protocol_scope().allow_directory(&path, true).map_err(...)` at `src-tauri/src/commands.rs:111-113`. The current formatting is hand-made and matches no single configuration, so some reformat is unavoidable; choose which shape is wanted rather than inheriting whichever the defaults produce. Record the choice in `rustfmt.toml` so CI and local runs agree.

**The reformat is its own commit.** It lands separately from the config commit and from TASK-16, for the same reason the Biome reformat does. To size it: the diff is 44–122 lines depending on the configuration chosen above, against roughly 554 lines of Rust total. `src-tauri/src/` holds five files. `main.rs` is six lines and is unaffected at every setting measured; the other four change under the defaults and under `max_width=120, use_small_heuristics=Max`, while `max_width=120` alone touches only `commands.rs` and `editors.rs`.

**It costs no dependency.** rustfmt ships with the Rust toolchain, so AC 2 still holds: Biome remains the only added lint/format package.

`cargo fmt` goes into both `AGENTS.md:9-24` (`## Commands`) and `AGENTS.md:150-160` (`## Verifying changes`), and into the `## コマンド` / `## 変更の検証` mirrors in `AGENTS.ja.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 biome.json names the scope as an include list plus an explicit exclude list, resolving src/**/*.test.ts, vite.config.ts, vitest.config.ts and scripts/*.mjs by name, so TASK-16 inherits an unambiguous decision
- [ ] #2 style/useBlockStatements is enabled at warn, not error, so the 144 outstanding bodies cannot fail the new CI check before TASK-16 fixes them; CI does not pass --error-on-warnings while any rule is parked at warn
- [ ] #3 Every file in the scope is formatted in one dedicated commit, so TASK-16 can add braces without its diff carrying unrelated formatting
- [ ] #4 Every recommended-set finding in the chosen scope is triaged - each fixed, or suppressed with a stated reason - before CI is wired; no rule is turned off wholesale without writing down why it is a bad fit here
- [ ] #5 Both noDangerouslySetInnerHtml findings (MarkdownView.tsx:168, SourceView.tsx:51) are suppressed with biome-ignore comments naming the AGENTS.md untrusted-Markdown section, and the rule is not disabled globally
- [ ] #6 Both noStaticElementInteractions sites are resolved - the Explorer.tsx finding at :54 plus removal of its stale ESLint directive at :53, and SettingsModal.tsx:39 which has no suppression today
- [ ] #7 Biome is the only lint/format dependency added; Prettier is not added for SCSS or anything else
- [ ] #8 SCSS and Markdown are documented as deliberately unformatted, with the reason, so a later reader does not take it for a misconfiguration
- [ ] #9 Lint and format scripts exist in package.json, and cargo fmt plus those scripts are listed in AGENTS.md's Commands and Verifying changes sections and both AGENTS.ja.md mirrors
- [ ] #10 Generated output is excluded (vcs.useIgnoreFile or explicit entries), and pnpm release --dry-run still matches its version patterns after any JSON reformat
- [ ] #11 stylelint is not added; the measurement that rejected it is recorded so the option is not reopened without new evidence
- [ ] #12 A CI workflow runs on pull requests and on the default branch, running biome ci, pnpm build, pnpm test, cargo fmt --check, cargo check and cargo test
- [ ] #13 The first CI run was green before the check is relied on; any pre-existing failure was fixed or suppressed deliberately rather than by disabling the step
- [ ] #14 rustfmt.toml records a deliberately chosen configuration, not the defaults
- [ ] #15 formatter.indentStyle, indentWidth, lineWidth, javascript.formatter.quoteStyle and javascript.formatter.semicolons are chosen deliberately against the existing code, not left at Biome's defaults by omission
- [ ] #16 The size of the bulk reformat was measured after the scope was fixed, not assumed - excluding src/**/*.test.ts changes it from roughly 573 lines to roughly 81
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build and pnpm test still pass; THIRD-PARTY-NOTICES.md is confirmed unchanged rather than assumed unchanged
<!-- DOD:END -->
