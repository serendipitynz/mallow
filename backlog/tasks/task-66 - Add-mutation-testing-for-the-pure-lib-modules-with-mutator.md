---
id: TASK-66
title: Add mutation testing for the pure lib modules with mutator
status: In Review
assignee: []
created_date: '2026-11-17 23:07'
updated_date: '2026-11-18 20:21'
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
- [x] #1 @mizchi/mutator is a devDependency added with pnpm, its version recorded in the task notes, and pnpm notices shows no diff
- [x] #2 One pnpm script runs it over src/lib with the DOM- and Tauri-bound modules and scripts/ excluded, and any config file it reads is inside Biome's scope
- [x] #3 Whether the untrusted-input boundary modules are marked critical is decided, and the reason is recorded
- [x] #4 .mutator/ is git-ignored, and every entry in mutator.accepted.json carries a reason
- [x] #5 A full cold run over src/lib is done, and each module's score and the run time are recorded in the task notes
- [ ] #6 The gaps the trial found are killed by new tests: a lone CR line ending and the cell budget in delimited.ts, and the CJK range boundaries in find.ts
- [x] #7 AGENTS.md and AGENTS.ja.md say when to run it (--since main while on a branch), why it is not in check.yml, and that it needs Node 24 or later
- [x] #8 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 導入したもの

- `@mizchi/mutator` **0.2.0**(devDependency、`pnpm add -D` が解決した版)。ユーザー設定の pnpm `minimum-release-age`(7 日)のため 0.3.0(11-16)・0.4.x(11-18)は対象外になった。0.x なので minor 間の破壊的変更に注意する。
- 設定は CLI フラグではなく `mutator.config.ts` に置いた。除外リストが 13 件あり、除外理由をコメントで書けるため。Biome の `files.includes` に追加した。tsconfig には入れていない。`vitest.config.ts` も tsconfig.node.json の include に無く、同じ扱いにそろえた(読み込みは Node 24 の type stripping)。
- `pnpm mutation` = `mutator`。`.mutator/` は .gitignore、`mutator.accepted.json` は git 管理。reporter は text と json(html は unpkg からコンポーネントを読むので外した)。
- `pnpm notices`: mutator 由来の行は出ない(devDependency)。ただし main の時点で既に差分がある — c900e21(Dependabot の npm 一括更新)で react 19.3.1・yaml 2.9.1・plugin-opener 2.7.3 などに上がったのに notices が生成し直されていない。スコープ外なので本タスクでは戻した。
- CI は Node 22 固定だが、mutator の `engines: node>=24` で `pnpm install --frozen-lockfile` は止まらないことを Node 22.22.2 で確認した(pnpm 11.9.0、engine-strict 未設定)。

## 除外リストの再確認

タスク記載の 12 モジュール(DOM / Tauri 依存)に `build-flags.ts`(Vite がビルド時に置換する定数 2 つで、テストから観測できない)を足した。cold run の結果、部分的に DOM 依存のモジュールが 3 つ低スコアで残る: `shiki.ts` 3.6%(言語一覧の文字列リテラルとハイライタ生成。テストからは観測されない)、`heading.ts` 13.3%(`findHeading` が DOM 必須)、`code-side.ts` 40.4%(canvas probe)。どれも純粋な部分にテストがあるので、除外せず残した。

## critical 指定(AC #3)

**指定しない。** critical なモジュールは検出されない mutant が 1 件でもあれば exit 2 になる。境界の 4 モジュール(markdown・html-doc・deck-css・slide-theme-css)には cold run 時点で未検出が 339 件(83 + 188 + 55 + 13)あり、仕分けが済むまで、それらに触れるブランチの `--since main` が毎回失敗する。常に赤い関門は無視されるだけである。境界を守っているのは markdown の untrusted-input スイートなど名前の付いたテストと CSP で、ミューテーションスコアではない。339 件を仕分けた後に critical を入れるなら、別タスクで扱う。

## cold run(AC #5)

2026-11-19、MacBook Air(M2、8 コア、concurrency は既定の半分の 4)、Node 24.19.0。**567 秒(9 分 27 秒)**。mutant 4,731 件、実行 2,508 件(型検査で 1,823 件を除外)。Killed 1,985・Timeout 62・Survived 527(うち not infected 66)・NoCoverage 330・Ignored 4。**全体スコア 70.5%**。試行(6 モジュール、5 分 39 秒)より長いのは対象が 57 モジュールに増えたため。

モジュール別スコア(検出 / (検出 + 未検出)、テスト追加前):

| module | score | | module | score |
|---|---|---|---|---|
| shiki | 3.6% | | path | 85.5% |
| heading | 13.3% | | chord | 87.5% |
| outline-pref | 31.3% | | read-error | 88.9% |
| code-side | 40.4% | | find-target | 90.0% |
| source-wrap | 42.9% | | markdown-preview | 90.0% |
| html-doc | 43.9% | | source-cap | 92.0% |
| prose-measure | 50.0% | | tree-nav | 92.5% |
| present | 52.1% | | html-headings | 92.9% |
| settings-sync | 54.8% | | context-menu | 93.9% |
| config-parse | 56.7% | | history-nav | 94.4% |
| clip | 57.1% | | explorer-width | 94.7% |
| markdown | 61.4% | | file | 95.3% |
| frontmatter | 63.8% | | menu-nav | 96.0% |
| custom-emoji | 65.1% | | find-chord | 97.1% |
| find | 67.3% | | slide-nav | 97.7% |
| deck-css | 68.6% | | close-window・config-tree・explorer-toggle | 100% |
| color-choice | 72.7% | | handover・html-notice・is-deck・kinari | 100% |
| slide-theme-css | 73.5% | | laser・modal-stack・new-window・pdf-export | 100% |
| path-command | 73.9% | | print・segmented-nav・slide-themes・title | 100% |
| xml-tree | 75.2% | | update-flow | 100% |
| deck | 76.0% | | window-init | 対象なし(全 mutant が型検査で除外) |
| visit-history | 81.3% | | | |
| tree-arrange | 82.5% | | | |
| delimited | 85.3% | | | |

## 試行のギャップ(AC #6)

- `delimited.ts:173`(単独 CR): 既存テストは `'a,b\rc,d'` の rowCount だけを見ていたが、`text[i + 1] === '\n'` → `true` でも `c` を読み飛ばして 2 行のままになる。rows を比較するよう変えて殺した。
- `delimited.ts:155`(`storedCells -= 1`)と、同じ予算を見る `:188` の `storedCells < TABLE_MAX_CELLS` → `true` / `<=`: 10 列 × 3,000 行で rows がちょうど 2,000 行(= TABLE_MAX_CELLS / 10)になるテストを足して、3 件とも殺した。
- `find.ts:54-56`(CJK などの範囲境界): **境界値のテストでは殺せない。等価 mutant である。** `neverComposesBackward` は「次の文字が前の文字と合成しない」ことが確実なときにペア判定を省く高速化で、範囲を狭める mutant(`>=`→`>`、`<=`→`<`、部分式→`false`、`||`→`&&`)は、合成しない文字をペア判定に回すだけである。ペア判定は同じ結果を返すので、変わるのは速度だけになる。範囲を広げる境界移動(0x3040・0x3100・0x4DFF・0xA000・0x80)も、該当する文字はどれも後ろから合成しないので結果は変わらない。この 11 件は理由付きで accept した。
  - 同じ行で殺せるものは殺した: 濁点・半濁点の結合文字 U+3099 / U+309A をかな範囲から除く条件(`!== 0x3099` → `true` など 3 件)。分解済みの `が` → `が`、`ぱ` → `ぱ` のテストを足した。
- 追加後の再実行(find・delimited の 2 モジュール、57 秒): 狙った mutant はすべて Killed。find 72.4%、delimited 91.3%。

**AC #6 は未チェックのまま残す。** 「CJK 範囲の境界をテストで殺す」は文面どおりには満たせないため(上記の等価性)。この扱いでよいか、AC を直すかはオーナー判断。

## accept した等価 mutant(AC #4)

17 件。すべて `reason` 付き。find.ts の範囲境界 11 件(上記)。delimited.ts 6 件: `:158` の `i < n` ガード 2 件(i >= n なら `text[i]` は undefined で区切り文字にならない)、`:164` の `>` → `>=` 1 件(等しいときは同じ値を代入するだけ)、`:170` の終端判定 3 件(区切り処理で i が n を越え、`:178` の判定で同じ表のまま抜ける)。

## 測っていないこと

- `--since main` の速度は、テストだけを変えた差分でしか測っていない(1.2 秒、mutant 0 件)。ソースを 1 行変えたときの 11 秒は試行の値である。テストだけの差分には mutant が無いので、テストを足した後は `--include` で対象モジュールを回す必要がある。AGENTS に書いた。
- 試行の `settings-sync.ts` 54.8% や `html-doc.ts` の未検出はこのタスクでは手を付けていない。
<!-- SECTION:NOTES:END -->
