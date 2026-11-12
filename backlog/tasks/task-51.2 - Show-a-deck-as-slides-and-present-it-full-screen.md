---
id: TASK-51.2
title: Show a deck as slides and present it full-screen
status: Done
assignee: []
created_date: '2026-11-11 01:30'
updated_date: '2026-11-12 19:08'
labels:
  - feature
dependencies:
  - TASK-51.1
references:
  - src/components/MarkdownView.tsx
  - src/components/Segmented.tsx
  - src/lib/chord.ts
  - src/hooks/useViewMemory.ts
  - src-tauri/capabilities/default.json
parent_task_id: TASK-51
priority: medium
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds the view TASK-51.1 decided on. decision-18 is the decision: Marpit on mallow's own markdown-it, the supported subset and the notice that names what is not, the slide size and scaling, mallow's slide theme, and the deck's CSS applied scoped to its slides. Read it before starting; this task builds what it settles and does not reopen it.

decision-18 also leaves this task four things it could not measure, and the rest of the decision rests on them: whether the deck CSS walk holds on the engine's own CSSOM in all three WebViews (if not, `postcss` as a direct dependency needs the owner's approval first); whether WKWebView and WebKitGTK paint Marpit's inline SVG correctly or need `@marp-team/marpit-svg-polyfill` (a second dependency needing its own approval, with §4's CSS-transform fallback if it is needed and not approved); that `contain: paint` on the slide host keeps a deck's `position: fixed` from drawing over the app; and how a deck behaves under the built app's CSP on Windows and Linux, since every CSP measurement so far is macOS. Where to hook the image-token rule (§2) and the deck CSS walk (§6) into Marpit is also this task's to build and verify.

A `marp: true` document gains a third choice in the markdown view switch beside preview and source: Slides. It shows one slide at a time scaled to the view, with the slide number, and moves with the arrow keys, Page Up / Page Down, Space / Shift+Space, Home / End and on-screen previous / next buttons. A document without `marp: true` does not offer the choice.

Present enters a full-screen presentation of the current slide: the window goes full-screen (`core:window:allow-set-fullscreen` is not in the capability today and has to be added), the toolbar, explorer and document bar are hidden, the same keys move between slides, a click advances, and Escape leaves and puts the window back as it was.

To settle at the start: the chord that starts presenting (a browser-like F5 or Cmd+Enter / Ctrl+Enter, checked against what WebView2 binds, which lib/chord's rule says to consume rather than concede), and whether the slide reached is remembered by the view memory TASK-44 keeps per file.

What find, the outline, Print… and Export as PDF… do while Slides is shown has to be decided rather than left to fall out: the print gate is "markdown in preview", which Slides is not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A marp: true document offers Slides in the markdown view switch; other documents do not
- [x] #2 Slides shows one slide at a time scaled to the view, with its number, and moves by the listed keys and the on-screen buttons
- [x] #3 Present shows the current slide full-screen with the app's chrome hidden, moves by the same keys and a click, and Escape restores the window as it was
- [x] #4 What find, the outline, Print and Export as PDF do while Slides is shown is decided and written down, and the menu's gates agree with it
- [x] #5 Every new label reaches the reader in both ja and en
- [x] #6 pnpm lint, pnpm build and pnpm test pass; the slide split and navigation logic are unit-tested
- [x] #7 The four measurements decision-18 left to this task are done against a built app and recorded in the task: the deck CSS walk on the engine's CSSOM in all three WebViews, whether WKWebView and WebKitGTK need marpit-svg-polyfill, that contain: paint keeps a deck's position: fixed inside the slide host, and the deck's behaviour under the CSP on Windows and Linux
- [x] #8 @marp-team/marpit is added with mallow's markdown-it range raised to ^14.3.1 and THIRD-PARTY-NOTICES.md regenerated; any further dependency (the polyfill, a direct postcss) has the owner's approval before it is added
- [x] #9 AGENTS.md's untrusted-Markdown boundary and README Security state what a deck's CSS can reach, as decision-18's Consequences set out
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. markdown.ts を createMarkdownIt ファクトリにし、デッキ用インスタンスでは画像の render ルールを外す
2. lib/deck: Marpit（inlineSVG・looseYAML・printable:false）、独自テーマ、size/math カスタムディレクティブ、画像トークン規則、デッキ CSS の走査フック、通知の機能収集
3. lib/deck-css: postcss でデッキ CSS を走査（at-rule の許可リスト、url() と文字列を decision-17 で解決・拒否）
4. lib/slide-nav・lib/present（キーと発表コード）と単体テスト
5. DeckView（スライド表示・発表オーバーレイ・全画面の出入り・ポリフィル）と MarkdownView の 3 つ目のモード、ビューメモリにスライド番号
6. App に発表コード、capability に allow-set-fullscreen、i18n、slides.scss
7. AGENTS / README（en/ja）、THIRD-PARTY-NOTICES 再生成、ビルド済みアプリで macOS 計測
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと（オーナー判断、2026-11-12）
- 発表のコード: 全画面は `Cmd/Ctrl+Enter`、ウィンドウ内は `Shift+Cmd/Ctrl+Enter`。WebView2 は F5 を再読み込みに使い、Ctrl+Enter は使っていない。lib/chord の規則どおり全ビューで消費する。メニュー項目は作らない（Rust 側のゲートは不要）。
- ウィンドウ内の発表（作業中にオーナーから追加要望）: 2 つの入口に加え、発表中は `F` で全画面とウィンドウを切り替える。どちらもツールバー・エクスプローラ・文書バーを隠し、Esc で終了してウィンドウを元の状態（開始時の全画面か否か）に戻す。
- ビューメモリ: モード `slides` とスライド番号（`FileViewState.slide`）を記憶する。
- スライド表示中: 検索・アウトライン・Print・Export as PDF は使えない（AC #4）。検索対象を登録せず、markdown プレビューの判定も立てないので、既存の `report_find_available` / `report_markdown_preview` によるメニューのゲートがそのまま従う。AGENTS の DeckView の項に記載。
- スライド表示の選択肢はプレビュー・ソースの後ろ（3 番目）。デッキを開いても既存の 2 つの位置が動かないようにするため。

## decision-18 が残した計測（AC #7）
### デッキ CSS の走査: CSSOM は成り立たない → postcss（オーナー承認済み）
- `new CSSStyleSheet().replaceSync('@import url(x.css); @font-face{…} @media{…} h2{background:url(…)} @keyframes k{…} @layer l{…}')` を WKWebView（macOS 26.7.3、Swift の WKWebView ハーネス）とヘッドレス Chrome で実行。どちらも `@import` を跡形なく捨て、残り 5 規則だけを返した。除去はされるが通知（§3）で名指しできない。シリアライズもエンジン差あり（`from` → `0%`）。
- オーナーが postcss（^8.5、Marpit 経由ですでにツリーにある 8.5.32 と同一でロックファイルに重複なし）を直接依存として承認。走査は Node でテスト可能になり、Marpit 自身のスコープ処理と同じパーサで読む。Windows / Linux で CSSOM を計測する必要はなくなった。
- フックは `marpit_style_assign` の直前のコアルール。`marpit_style` トークンの content と `style` グローバルディレクティブを 1 回ずつ走査し、テーマのパックには触れない（単体テスト「does not report the theme pack」）。パック後の全セレクタが `div.marpit` 配下であることも確認（at-rule なし）。
- url() に加えて `image-set()` / `src()` の文字列引数も URL として扱う。それ以外の文字列でも asset: URL に復号されるものは宣言ごと除去する（カスタムプロパティ経由の `image-set(var(--x))` を塞ぐため）。CSS エスケープ（`\61sset:`）は復号して判定。
### inline SVG とポリフィル: WKWebView では必要 → @marp-team/marpit-svg-polyfill 2.1.0（オーナー承認済み、MIT・依存なし）
- Marpit の inline SVG スライドを 640×360 に縮小して表示すると、WKWebView では foreignObject の中身が縮小されず 1280×720 のまま切り取られた（Chrome は正しく縮小）。
- ポリフィル自身の非同期判定（キャンバス描画テスト）は macOS 26 の WebKit を「不要」と誤判定して何もしない。同期版 `polyfills()`（navigator.vendor で判定）の `webkit()` を直接呼ぶと Chrome と一致した。DeckView はスライド切替・リサイズ・mermaid 描画後にこれを呼ぶ。`observe()` は毎フレーム rAF で走り続けるので使わない。
- **WebKitGTK は未計測で、ここに要注意点がある**: WebKitGTK も vendor が "Apple Computer, Inc." なので修正が当たる。WebKitGTK にこのバグが無ければ二重に縮小される。Linux で 1 枚目が枠に収まって正しい大きさかを見る必要がある。
### contain: paint
- ビルド済みアプリ（macOS）で、`<style scoped>` の `position: fixed; top: 0; left: 0` の見出しがスライドの左上に置かれ、ツールバーやアプリ画面には出なかった。
### CSP 下の挙動
- macOS: `pnpm tauri build --debug --no-bundle --no-sign` のアプリで、相対パスの `![bg right]`、デッキ CSS の `url(img/stripe.png)`、mermaid、Shiki のコード、invert / lead が描画された。`@import`・`@font-face` は除去されて通知に出た。
- **Windows (WebView2) と Linux (WebKitGTK) は未計測**。計測用デッキは `_sandbox/handoff/task-51.2/deck.md`（img/ に画像 2 枚）。

## macOS で見たもの・見ていないもの
- ビルド済みアプリを HOME を分けて起動し（オーナーの settings.json に触れないため）、`screencapture -l` でウィンドウだけを撮影した。スライド表示の切替、6 枚それぞれの描画、全画面の発表（ツールバー等が消え、終了後にウィンドウが元に戻る）、ウィンドウ内の発表（同上、ウィンドウサイズは不変）を確認。スライド送りと発表の開始・終了は計測専用の一時コード（autoplay、計測後に削除済み、コミットなし）で動かした。
- osascript のクリックは 1 回目だけ通り、以降は「assistive access がない」で拒否された（権限は変えていない）。そのため **アプリ上でのキー操作（矢印・PageUp/Down・Space・Home/End）、前後ボタン、発表中のクリックで次へ、Esc、F、発表コードは手で確かめていない**。キーの解釈とコードはそれぞれ単体テストで確認済み。AC #2・#3 はこの手確認待ちで未チェック。
- 1 回目のクリック直後、Slides ボタンにフォーカスが残り、矢印がセグメントコントロールのフォーカス移動に使われてスライドが動かなかった。スライド本体を `tabIndex={-1}` にして、クリックでフォーカスがスライドへ移るようにした（修正後の手確認は未実施）。
- 全画面時の Esc が macOS のネイティブ全画面で WebView に届くかは未確認。

## その他の判断
- Marpit は渡された markdown-it にプラグインを入れるので、デッキ用は `createMarkdownIt({ localImageRule: false })` で別インスタンスを作る（サイズごとに 1 つ、カスタム絵文字の設定変更で作り直し）。画像の decision-17 処理は `marpit_parse_image` 直前の inline ruler2 ルールでトークンに 1 回だけ行う。拒否した src は削除ではなく空文字にする（Marpit の画像パースが src を無条件に読み、null で例外になったため）。
- `size: 4:3` はデッキのどこにでも書けるので、16:9 で描画してディレクティブを見てから 4:3 用レンダラで描き直す。
- テーマ名は Marpit が未知の名前を黙って捨てるため、`themeSet.has` を包んで要求された名前を記録して通知に出す。raw HTML は markdown-it の HTML_TAG_RE で判定（`a < b` やエスケープした `\<div>` は対象外）。
- バンドル: Marpit・postcss・js-yaml は `lib/deck` を動的 import にして別チャンクにした（deck チャンク 417 KB / gzip 140 KB）。エントリは 878 KB → 893 KB（DeckView・ポリフィル・判定関数ぶん）。静的 import のままだとエントリが 1,315 KB になっていた。
- markdown-it は ^14.3.3 になった（pnpm add markdown-it@^14.3.1 が解決した版。AC #8 の「^14.3.1 以上」を満たす）。THIRD-PARTY-NOTICES.md は再生成（Marpit・ポリフィル・postcss 系・js-yaml 5・argparse 3 などが追加）。
- アウトラインのトグル・検索・印刷・PDF はスライド表示ではそもそも出ない／無効（上記）。

## 検証
- pnpm lint / pnpm build / pnpm test（49 ファイル 625 件）すべて通過。Rust の変更は capability の 1 行だけで、`pnpm tauri build --debug --no-bundle --no-sign` が通ったことで確認。
- 追加した単体テスト: deck（分割・ディレクティブ・4:3・ノート・画像の解決と拒否・デッキ CSS・通知の各機能）、deck-css、slide-nav、present。

## レビュー（PR #93、Claude Code CLI レビュアー、2 回）
- 1 回目: [P2] 1 件・[P3] 5 件。すべて修正（e07e728・4c2e9ea）。
  - [P2] 発表中に設定（Cmd/Ctrl+, やメニュー）や更新ダイアログが開くと、inert な #root の中、発表の下に隠れて開き、isModalOpen() が true になって Esc を含む全キーが止まっていた。Modal がフォーカスを取る前に onModalOpening のリスナーを呼び、発表中ならそこで inert を同期的に外して発表を終えるようにした。開く側を止めるより、起動時の更新チェックも同じ形で扱えるため。
  - [P3] 発表中の発表コードが場所を変えなかった → 発表中の場所の変化にウィンドウが追従し、F も同じ状態を通すようにした。
  - [P3] markdown-it の lib/common/html_re.mjs（公開 API ではない）を実行時に import していた → CommonMark §6.6 から開始・終了タグのパターンを lib/deck に書いた。
  - [P3] デッキ描画が見出しスラッグの状態を引き継いでいた → resetHeadingState() をデッキ描画ごとに呼ぶ。
  - [P3] 数式はディレクティブだけで判定 → DeckFeature のコメントに明記（`$…$` の検出は対象外）。
  - [P3] 解釈できない CSS が通知なしで消えていた → cssUnparsed を通知に追加（ja/en）。
- 2 回目: 全件解消として 4c2e9ea に APPROVE（ボット）。CI は frontend・rust・paper（3 OS）すべて通過。

## オーナーによる確認（2026-11-13、AC #2・#3・#7）
- macOS・Windows・Linux の dev で確認: スライドの検出とスライド表示への切り替え、キー操作（矢印・Page・Space・Home/End）・前後ボタン・クリックで次へ・Esc・F、全画面の発表と Esc での終了、発表をやめた後も同じスライドが表示されたままになること。すべて問題なし。
- Windows（WebView2）・Linux（WebKitGTK）のビルド済みアプリで計測用デッキを開き、CSP 下で `![bg right]` の相対パス画像、デッキ CSS の `url(img/stripe.png)`、`@import` / `@font-face` を名指す通知を確認。Windows は UNC パス上のフォルダでも相対画像が解決された（`http://asset.localhost` が CSP を通過）。
- WebKitGTK にも WebKit 向けの SVG 補正（ポリフィルの webkit()）が当たるが、スライドは枠に収まり正しい大きさで描かれ、二重縮小は起きていない。
- これで AC #7 の 4 項目は次のとおり: CSSOM の走査は WKWebView と Chromium で成り立たないと計測して postcss に置き換え（Windows / Linux での CSSOM 計測は不要になった）、ポリフィルは WKWebView で必要・WebKitGTK でも問題なし、contain: paint は macOS のビルド済みアプリで確認（Windows / Linux は dev で確認）、CSP 下の挙動は 3 環境のビルド済みアプリで確認。
<!-- SECTION:NOTES:END -->
