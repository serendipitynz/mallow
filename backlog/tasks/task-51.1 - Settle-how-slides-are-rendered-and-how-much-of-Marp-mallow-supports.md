---
id: TASK-51.1
title: Settle how slides are rendered and how much of Marp mallow supports
status: Done
assignee: []
created_date: '2026-11-11 01:30'
updated_date: '2026-11-12 08:41'
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
- [x] #1 Both routes are measured on the points listed, against the built app's CSP, and the numbers are recorded in the task
- [x] #2 A decision records the route, the supported Marp subset, the slide size and scaling, the theme rule, and how unsupported features are reported
- [x] #3 If the route adds a production dependency, the owner has approved it before anything depends on it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
decision-18 に記録した。計測は 2026-11-12。

## 実デッキの使用機能（AC #1, 決定 §2・§3 の根拠）
GitHub コード検索 `"marp: true" extension:md` の上位 300 件から 1 リポジトリ 1 件の 275 件を取得し、先頭 front matter に `marp: true` を持つ 222 件を集計（スライド数の中央値 11）。デッキ単位の割合: theme 指定 79%（default 74 / gaia 24 / uncover 18 / その他の名前 60、未指定 46）、paginate 68%、_class 42%（lead 32% / invert 14% / title 12%）、デッキ CSS 44%、生 HTML 38%（div・br・span が中心）、front matter の footer 28% / header 21%、画像サイズ指定 30%、![bg] 26% / 分割背景 22%、ディレクティブ以外のコメント 26%、size 18%（16:9 35 件 / 4:3 5 件）、数式 13〜17%（math ディレクティブ / `$…$` パターン）、画像フィルタ 7%、fit 4%、mermaid 1%。集計は正規表現によるもので、生 HTML と数式のパターン値は過大評価を含みうる。

## marp-core 4.4.0（ルート a）
- バンドル: mallow の vite ビルドで unattended チャンクに入れて 3,695,786 B（gzip 1,224,405 B）。アプリ本体の entry チャンクは 877,901 B（gzip 296,315 B）。esbuild 単体の内訳は mathjax-full 1.75 MB・highlight.js 1.06 MB・katex 266 KB で、`math: false` でも静的 import のため残る。
- HTML: 既定 allowlist は `<div>`・`<img src>` を通し、`onclick`・`onerror`・`a href` は落とした。`html: false` で生 HTML は mallow と同じくエスケープされる。`<style>` は html オプションに関係なく常に解釈される。
- 絵文字: 既定では cdn.jsdelivr.net の twemoji 画像になる（CSP 下で実際に読み込まれた）。`emoji: { shortcode: true, unicode: false }` で Unicode 文字になる。
- 配線: Node で `marp.use()` により Shiki・mermaid フェンス・markdown-it-emoji（カスタム定義）がスライド内に出ることを確認。
- ライセンス: marp-core は MIT。推移依存に BSD-3-Clause（highlight.js）、Apache-2.0（mathjax 一式）、PSF-2.0 / Python-2.0（argparse）など。

## Marpit 3.2.3（ルート c、採用）
- esbuild で markdown-it を external にして 278,084 B（gzip 81,164 B）。内訳は postcss-selector-parser 66 KB・js-yaml 62 KB・postcss 55 KB・marpit 54 KB。
- Node で mallow の markdown-it 14.2.0 インスタンスを `markdown` に渡せる（`marpit.markdown === md`）。`html: false` で生 HTML はエスケープされたまま、Shiki・mermaid フェンス・markdown-it-emoji がスライド内に出る。
- Marpit は渡されたインスタンスにプラグインを入れる。2 つの Marpit に同じ md を渡すと 1 つ目のプラグインが残ることを観測したので、決定 §1 で「プレビューのキャッシュとは別インスタンス」とした。
- Marpit 3 に `<style>` を切るオプションは無い。`md.block.ruler.disable('marpit_style_parse')` で切れるが、`<style>` が本文テキストとして残り、`style:` ディレクティブの CSS は残る。決定ではデッキ CSS を適用する側を選んだので、この経路は使わない。
- Marpit は markdown-it `^14.3.1` を要求し、mallow は `^14.2.0`。

## ビルド済みアプリの CSP 下（AC #1）
`git worktree` で main を使い捨てにして marp-core を追加し、`src/unattended/run.ts` を計測コードに差し替えて `MALLOW_UNATTENDED=1 pnpm tauri build --debug --no-bundle --no-sign` でビルドし、結果を `unattended_finish` の stderr で受け取った（worktree は削除済み、コミットなし）。macOS / WKWebView のみ。
- 対照: 先に挿入したインライン `<script>` が `script-src-elem` で拒否され、CSP が効いていることを確認。
- marp-core の出力（既定・絞り込みの両方）: section が 1280px で組まれ 640 幅のコンテナに 640×360 で縮小された。`_backgroundColor` のインライン style が適用された（rgb(18, 52, 86)）。出力内のインライン `<script>` は実行されず、バンドルした `@marp-team/marp-core/browser` は違反なしで動き `marp-pre` を定義した。インラインの onclick・onerror は実行されなかった。
- デッキ CSS: セレクタは `div.marpit > svg > foreignObject > section` 配下にスコープされた。`@font-face` は data: もリモートもアプリ文書全体の FontFace として登録され、リモートの読み込みは `font-src` で拒否された。`@import` はスタイルシート先頭に巻き上げられ、リモートは `style-src-elem` で拒否された。CSS 中の `url(https://…)` とインラインの `background-image` は違反を出さなかった。
- 違反はここに挙げた計測用のものだけで、Marpit / marp-core の出力自体からは出なかった。

## 着手時に決めたこと
- 3 つ目のルート（Marpit + mallow の markdown-it）を計測中に見つけ、オーナーが 2026-11-12 に採用と本番依存への追加を承認した（AC #3）。依存の追加と THIRD-PARTY-NOTICES の再生成は TASK-51.2。
- デッキ CSS はスコープして適用、`@font-face` と `@import` は除去して通知、という境界の拡大もオーナー判断で決めた（決定 §6）。

## 計測していないこと
- Windows (WebView2) と Linux (WebKitGTK) での CSP 下の挙動。決定 §6 は macOS の計測に依っている。
- WKWebView / WebKitGTK で inline SVG のスライドが正しく描画されるか（marpit-svg-polyfill の要否）。今回はバウンディングボックスのみ確認し、描画結果は見ていない。TASK-51.2 で計測する。
- `contain: paint` でデッキの `position: fixed` がアプリ画面に出ないことは、まだ確認していない。TASK-51.2 で確認する。
- alerts・タスクリスト・lone images・local images の各プラグインが Marpit 経由で動くか。

補足: worktree で `pnpm add` したとき、pnpm のメタデータキャッシュが古く `argparse@^3.0.3` が見つからないと失敗した。`--config.cache-dir` を別にしたら解決したので、TASK-51.2 で同じエラーが出たらキャッシュを疑う。

## レビュー 1 回目で追加した計測（2026-11-12、Node、Marpit 3.2.3 + markdown-it 14.2.0、html: false）
- HTML コメントのディレクティブは html: false でも効く（`_class: lead` で class が付き、`header:` が次のスライドに引き継がれる）。Marpit がコメントを自前で解釈するため。
- `_backgroundColor: #123456` のような引用符なしの色は、Marpit 既定の `looseYAML: false` では `#` が YAML のコメントとして読まれ、無視される。`looseYAML: true`（marp-core の既定）なら適用される。決定 §1 に `looseYAML: true` を加えた。
- Marpit 3.2.3 のパッケージ内に `inlineStyle` オプションは無い（パッケージ全体を grep して該当なし）。
<!-- SECTION:NOTES:END -->
