---
id: TASK-29
title: Stop mermaid reverting to source after it renders on session restore
status: Done
assignee: []
created_date: '2026-09-06 03:42'
updated_date: '2026-09-25 12:32'
labels:
  - bug
milestone: m-4
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reproduced 2026-09-06 (macOS, `pnpm tauri dev`): with a markdown document containing mermaid restored at launch as the previously open file, **the diagram renders and then reverts to its own source a moment later**. Selecting another file and opening it again renders it and it stays. `_sandbox/samples/print-pagebreaks.md` is the document; `_sandbox/samples/mermaid-min.{md,mmd}` are minimal probes made while diagnosing it.

**The symptom is a diagram being taken back, not a diagram that never appeared, and the distinction is the whole of the diagnosis.** `renderMermaid` replaces `<pre class="mermaid">` with a `<div class="mermaid-rendered">` on success, and nothing in `lib/mermaid` puts a `<pre>` back — so source text after a successful render means the article's HTML was re-injected (`dangerouslySetInnerHTML`) or the element was remounted. It also means the module loaded and the syntax parsed, both of which are exonerated the moment anything renders. Writing this up as "mermaid does not render" is what produced two wrong diagnoses before the reproduction arrived, which is why the referent table fixes **描画後の差し戻し** as its own referent.

**Three candidates are already eliminated by reading, so do not spend the round re-checking them.** The custom-emoji config bump cannot be it: `App.tsx` awaits `applyEmojiDir` *before* it selects the restored file, so the emoji table is in place before the document renders. The restore effect cannot be running twice: its three dependencies (`openTree`, `expandPaths`, `applyEmojiDir`) are all `useCallback`s with empty or stable deps. And the watcher's reload cannot be it: `source` is a string, so an unchanged re-read does not re-run the render effect.

**A fourth read-only hypothesis is not an answer.** The remaining candidate — that the enhancement effect has no cancellation guard where the render effect has one, so a slow first `import('mermaid')` can let a stale pass complete against a DOM it no longer owns — has the right shape and is *not* an observation. Instrument it: the reproduction is reliable, so logging when `result` changes, when a `renderMermaid` pass starts and finishes, and when the article's HTML is written will name the cause in one run.

**Why it was expensive to diagnose is itself part of the fix.** `void renderMermaid(article)` in `MarkdownView` and `void renderMermaid(host)` in `MermaidView` carry no `.catch`, while `openUrl` and `printWindow` a few lines away in the same file do. A failure surfaces only as an unhandled rejection, nothing appears on screen, and the reader cannot tell a broken render from a document mallow does not support.

Found while measuring printing (TASK-27 / TASK-28) and **unrelated to it**: what reaches paper is what is on screen, and the print stylesheet cannot restore an element the app replaced. Milestone deliberately unassigned — it is pre-existing, it self-heals on reopen, and whether it belongs in v0.8.0 is a release-scope call rather than a technical one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A markdown document containing a mermaid diagram, restored at launch as the previously open file, shows the diagram and keeps showing it - reproduced first, then fixed
- [x] #2 The cause is identified by instrumentation rather than by reading. Three candidates were already eliminated by reading (the custom-emoji config bump is awaited before the file is selected, the restore effect's deps are all stable so it runs once, and the syntax is exonerated the moment a diagram renders), so a fourth read-only hypothesis is not an answer
- [x] #3 renderMermaid's failures stop being swallowed: the two call sites (MarkdownView and MermaidView) handle the rejection the way openUrl and printWindow beside them already do. Without this the next occurrence is as hard to diagnose as this one
- [x] #4 Whether the enhancement effect needs a cancellation guard is decided on the evidence, not assumed - the render effect has one and this one does not, which is the shape of the symptom, but that is a candidate and not an observation
- [x] #5 Whether a reader is told the diagram could not be drawn is decided. Today source text is indistinguishable from a document mallow does not support
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 計測（一時的な debug_trace コマンド + App/MarkdownView の render・article の MutationObserver・renderMermaid 開始/終了）で差し戻しの原因を特定する（済: React 19 が再レンダーごとに新しい {__html} オブジェクトを見て innerHTML を書き直す）
2. MarkdownView の {__html} を result に対して useMemo し、DOM の書き込みと enhancement effect の再実行を同じ result の変化に揃える
3. renderMermaid の失敗を握りつぶさない: 2 つの呼び出し元で .catch(console.error)
4. 描画に失敗したブロックの直前に注記（i18n、mermaid のエラー文つき）を置く。読み込み失敗は全ブロックに注記して reject
5. キャンセルガードは計測結果から不要と判断し、追加しない
6. 計測を外し、同じ復元シナリオで再計測して図が残ることを確認。lint/build/test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 原因（計測で特定）

一時的な `debug_trace` コマンド（eprintln するだけ。コミットしていない）を足し、App の再レンダーごとに変わった state、MarkdownView の render 回数、article への MutationObserver（mermaid 関連ノードの追加・削除）、renderMermaid の開始と終了、1 秒ごとの `pre.mermaid` / `.mermaid-rendered` の数をログに出した。`pnpm tauri dev`、macOS、settings.json の `windows` を `_sandbox/samples/print-pagebreaks.md`（mermaid 2 図）に向けて起動した。

修正前の 1 回目の計測で再現した:
- 11482ms: renderMermaid が完了し `rendered=2`
- 11888ms: App が再レンダー（`useFileTree` の state 変化のみ）→ MarkdownView render #3。result は変わっていないのに、article に `+[PRE.mermaid×2] -[DIV.mermaid-rendered×2]` の書き戻しが起きた
- enhancement effect は再実行されず、以後の probe はずっと `pre=2 rendered=0`

仕組み: React 19.2.7 は `dangerouslySetInnerHTML` を **オブジェクトの同一性** で比較し、異なれば `innerHTML` を無条件に書き直す（`react-dom-client.development.js` の汎用 updateProperties → setProp で確認）。`{ __html: … }` がリテラルだったので、ビューより上で再レンダーが起きるたびに記事が書き戻されていた。一方 effect は `[result, mode]` 依存なので再実行されない。復元時にだけ目立ったのは、起動直後は tree の展開・watch・復元完了・更新チェックなど App の state 変化が続くため。手で開き直したときは App が静かなので残って見えた。**同じ仕組みでコードブロックのコピーボタンも消えていた**。また、アウトラインの開閉など MarkdownView を再レンダーさせる操作でも起こりえた（そちらは計測していない）。

## 修正

- `{ __html }` を `result` で useMemo した。DOM を書き込むタイミングと enhancement effect を再実行するタイミングが、同じ `result` の変化に揃う。キーを HTML 文字列にしなかったのは、同じ HTML で新しい result が来た場合も effect は再実行されるため。そのとき effect が見る DOM は、強化済みではなく新しく書かれたものであるべき。
- 修正後の再計測（同じシナリオ）: render #3・#4 が起きても mutation は発生せず、15 秒間 `pre=0 rendered=2` のまま。

## AC#3: reject の扱い

MarkdownView と MermaidView の 2 つの呼び出し元で、openUrl と同じ形の `.catch(console.error)` を付けた。unattended 側は catch 済みの promise を待つだけになった。renderMermaid 自体は、mermaid モジュールの読み込みに失敗したときに限って reject する（全ブロックに注記を付けてから）。個々の図の失敗は注記を付けて次の図へ進む。

## AC#4: キャンセルガード

**付けないと判断した。** 計測では、renderMermaid は 1 回だけ走り、接続中の article に対して完了していた（`connected=true`）。差し戻しは完了した**後**の React による書き戻しで、古いパスが残っていたわけではない。result が途中で変わった場合も、古いパスの `block` は innerHTML の書き換えで DOM から外れており、`replaceWith` は何もしない。無駄になるのは CPU 時間だけ。

## AC#5: 読者への通知（ユーザー判断: 失敗したブロックに注記を付ける）

- 描画に失敗した `pre.mermaid` の直前に `p.mermaid-error` を置く。文言は i18n の `mermaidFailed`（ja/en）に mermaid のエラー文を付けたもの。ソースはそのまま残す。
- `suppressErrorRendering: true` を追加した。計測すると、失敗時の mermaid は自分のエラー図の一時コンテナ `div#dmermaid-svg-0` を `<body>` 末尾に残していた（修正前からの挙動）。画面上は高さの制約で見えないが、print.scss が高さの制約を外すと紙に出る。追加後は `body` に残るのは Vite の script だけになった。
- 確認（2 ウィンドウ復元）: `.md` では正常な図は描画され、壊れた図だけに注記が付いた。`.mmd` でも注記が付いた。
- 注記は enhancement effect の依存 `t` で言語切替に追従する（effect が再実行され、失敗ブロックの描画を再試行して注記を書き直す）。言語切替そのものは計測していない。

## 検証

- `pnpm lint` / `pnpm build` / `pnpm test`（385 件）通過。Rust の差分はない。
- 変更したコードは DOM 依存で、Node 環境のテストスイートでは届かないため、ユニットテストは追加していない。上の計測が検証になる。
- Windows / Linux は計測していない（React 側の仕組みはプラットフォームに依存しない）。

## スコープ外（報告のみ）

`SourceView` の `<div dangerouslySetInnerHTML={{ __html: html }} />` も同じ形で、App の再レンダーのたびに Shiki の HTML（最大で入力の約 14 倍）を書き直している。DOM を後から書き換えないので図が消えるような症状はないが、再パースの負荷とテキスト選択が外れる可能性がある。

失敗時の注記の見た目は、マージ時にユーザーが目視で確認済み（2026-09-26）。
<!-- SECTION:NOTES:END -->
