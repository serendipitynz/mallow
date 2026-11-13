---
id: TASK-52.2
title: Bundle a kinari release as mallow's copy and measure it on the three WebViews
status: Done
assignee: []
created_date: '2026-11-13 00:15'
updated_date: '2026-11-13 02:59'
labels:
  - feature
dependencies:
  - TASK-52.1
references:
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
  - src/styles/snz-tokens.css
  - src/lib/deck.ts
parent_task_id: TASK-52
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bundles kinari as decision-19 §7 settles it: mallow's copy of one kinari release, registered under the reserved name `kinari`, and measured where mallow runs. **This task waits for kinari's first release** from the kinari repository, which is outside mallow's ledger; it also depends on TASK-52.1, which reserves the name and builds the theme set the copy joins.

kinari itself — its palette, its layout, its README, its licence, its highlight.js colours for Marp's own tools — is changed in the kinari repository and nowhere else. A change mallow needs in it is made there and arrives with the next release; mallow's copy is never edited by hand.

What has to be done:
- **Copy a release into mallow's tree** as mallow's copy of kinari: its first line names the release it came from, it is updated from a release in a commit of its own (the rule `src/styles/snz-tokens.css` follows), and it is read as text and registered under `kinari`. Where in `src/` it lives, and how the version line is checked, is this task's to settle — snz-design's `vendor.mjs verify` is the model, not a requirement.
- **Check the release against what decision-19 §7 takes from it**: colours as `light-dark()` pairs, the `@supports not (color: light-dark(#000, #fff))` block giving its light side, `@size` entries for `16:9` and `4:3`, and nothing `walkDeckCss` would remove. A release missing one goes back to the kinari repository rather than being patched here.
- **Measure on a built app** (`pnpm tauri build --debug --no-bundle`), on macOS, Windows and Linux: kinari follows the drawn mode in the Slides view and in a presentation, a mode switch while a deck is shown included; its paper texture draws with no seam; and where an engine lacks `light-dark()`, the `@supports` block gives the light side.
- **AGENTS.md (en/ja)**: the kinari repository joins snz-design as a project mallow may name as an origin, in the same sentence, and mallow's copy of kinari joins the vendored copies that are never edited by hand.
- **THIRD-PARTY-NOTICES.md**: whether mallow's copy needs a line follows from the licence the kinari repository chose (decision-19 Consequences); if it does, the line is added by hand beside the generator.
- **README (en/ja)**: kinari is named as a theme a deck can ask for with `theme: kinari`, with a pointer to its repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mallow's copy of a kinari release is in the tree, its first line names the release, and it is registered under kinari
- [x] #2 The release carries what decision-19 §7 takes from it: light-dark() colours, the @supports fallback to its light side, @size entries for 16:9 and 4:3, and nothing walkDeckCss would remove
- [x] #3 A deck naming kinari, or one drawn with the default-theme preference set to kinari, follows the drawn mode in the Slides view and in a presentation
- [x] #4 On a built app on macOS, Windows and Linux, kinari follows a mode switch while a deck is shown and its paper texture shows no seam; the results are recorded in the task
- [x] #5 AGENTS.md (en/ja) names the kinari repository beside snz-design and lists mallow's copy of kinari among the copies never edited by hand; README (en/ja) names kinari and its repository
- [x] #6 Whether THIRD-PARTY-NOTICES.md needs a line for kinari is settled from its licence and recorded in the task
- [x] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. kinari リポジトリの v0.1.0 タグから写しを取る scripts/kinari.mjs（copy / verify）を書き、src/slide-themes/kinari.css に置く
2. lib/kinari が写しを ?raw で読み、@size をその写し自身から読んで DeckTheme にする。lib/deck が mallow のテーマの次に常に登録する
3. resolveDefaultTheme と設定の既定のテーマの選択肢に kinari を同梱テーマとして載せる
4. §7 の確認と版の表示の確認を src/lib/kinari.test.ts に置く
5. THIRD-PARTY-NOTICES は MIT の条件から 1 項目を生成スクリプトに手書きで足す
6. AGENTS.md / README（en/ja）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 写しの出どころ
- kinari リポジトリ（serendipitynz/marp-theme-kinari）のタグ v0.1.0（コミット 83401d7、GitHub リリース「kinari 0.1.0」, 2026-11-13）の kinari.css。作業ツリーの kinari.css / LICENSE はタグと一致していた（git diff --quiet v0.1.0）。
- 置き場所は src/slide-themes/kinari.css。src/styles/ に置かないのは、アプリのスタイルシートとして @use / import される誤りを避けるため（中の規則は Marpit がスライドへスコープする前提）。

## 版の表示の確認（AC #1）
- scripts/kinari.mjs：`copy <版>` は ../marp-theme-kinari の refs/tags/v<版>:kinari.css を写し、1 行目がその版を名指していることも確かめる。`verify` は写しの 1 行目の版のタグと改行を正規化して照合する（snz-design の vendor.mjs verify と同じ形）。
- 計測：copy 0.1.0 → verify ok。写しに 1 行足すと verify が「edited after it was copied」で落ち、copy 0.2.0 はタグが無いと落ちることを確かめた。
- CI では隣のチェックアウトが無いので、src/lib/kinari.test.ts が 1 行目の形（kinari <semver> — リポジトリ URL — MIT License）を見る。

## §7 の確認（AC #2）
- src/lib/kinari.test.ts が写しそのものを見る：readThemeMeta で @theme kinari と @size 16:9 1280×720 / 4:3 960×720、walkDeckCss で除去 0（at-rule なし・asset: URL 0・unparsed false）、section の --kinari-*（light-/dark- を除く）がすべて light-dark()、@supports は `not (color: light-dark(#000, #fff))` の 1 つだけで、その中の section がちょうど同じ名前の集合を var(--kinari-light-*) に置く。
- テストが効くことの確認：写しの @supports の条件を書き換えると light-dark テストが落ち、@size 4:3 を消して @font-face を足すとサイズとウォークの 2 テストが落ちた（確認後に copy で戻し verify ok）。
- Vitest は .css の import を ?raw も含めて空文字列にする（css.include に無い限り）。最初これで写しが空として読まれ deck テスト 36 件が落ちた。vitest.config.ts の css.include に src/slide-themes/ を挙げて解決。

## 描画への組み込み（AC #3）
- lib/kinari は lib/deck だけが import するので、写しはデッキの遅延チャンク（dist/assets/deck-*.js）にだけ入る（pnpm build の成果物で確認、index-*.js には無い）。
- lib/deck の heldThemes が [KINARI, ...フォルダのテーマ] を返し、createRenderer の登録・usableSet・サイズの判定がこれを見る。フォルダのテーマは kinari を名乗れない（予約名）ので名前の衝突はない。
- resolveDefaultTheme は同梱テーマ（BUNDLED_THEME_NAMES）を常に保持しているものとして扱い、設定の既定のテーマの選択肢にも kinari を並べる。
- deck.test.ts：「kinari は未知として報告される」テストを置き換え、theme: kinari がフォルダあり・なしの両方で kinari で描かれ通知なし、size: 4:3 が viewBox 960×720、既定のテーマが kinari のときテーマ指定なしのデッキが kinari で描かれる、を確かめる。slide-themes.test.ts に kinari が常に保持されるテストを追加。
- モードへの追従：renderDeck が出した kinari のデッキ（通常と invert の 2 枚）を静的ページにして内蔵ブラウザ（Chromium、CSS.supports('color','light-dark(#000, #fff)') が true）で開き、<html> の color-scheme を light → dark と同じ DOM のまま切り替えて計測。light: 地 rgb(244,242,236)=#f4f2ec / 文字 rgb(111,74,66)、dark: 地 rgb(34,32,30)=#22201e / 文字 rgb(221,210,200)、invert はそれぞれ逆側。紙の data: SVG は両側で background-size 480px 480px のまま残る。アプリでは color-scheme を snz-tokens.css が [data-color-mode] から <html> に置き、発表は同じ DeckView のステージを portal で出すだけで color-scheme を上書きする規則は slides.scss に無いので、スライド表示・発表・表示中のモード切り替えは同じ仕組みに乗る。
- これは Chromium での計測で、3 つの WebView ではない。AC #4 は未チェック。

## AC #4（オーナーの計測、未チェック）
pnpm tauri build --debug --no-bundle の macOS / Windows / Linux で、theme: kinari のデッキを開き：
- スライド表示中と発表中（全画面・ウィンドウ内）にツールバーでライト / ダークを切り替え、地と文字が追従し invert が逆側になること
- 紙のテクスチャに 480px ごとの継ぎ目が出ないこと（ダーク側で見えやすい）
- light-dark() 非対応のエンジン（古い WebKitGTK など）では @supports のブロックでライト側になり、地と文字が消えないこと

## THIRD-PARTY-NOTICES（AC #6）
- kinari は MIT。MIT は写しに著作権表示と許諾文を含めることを条件にしており、写しの 1 行目は「MIT License」とリポジトリしか書いていないので、通知に 1 項目足すと判断した。著作権者は mallow と同じだが、mallow 自体が MIT でフォークが再配布するので、その再配布が条件を満たす形にしておく。
- decision-19 Consequences どおり、生成スクリプトにファイルを探させず、scripts/gen-third-party-notices.mjs に手書きの項目（Files copied into the tree / kinari 0.1.0 / LICENSE 全文）を置いた。pnpm notices の差分は追加のみ（既存のテキスト id は変わらない）。
- 写しの版と通知の版が食い違うと kinari.test.ts が落ちる（0.0.9 に書き換えて落ちることを確認）。

## ドキュメント（AC #5）
- AGENTS.md / AGENTS.ja.md：独立プロジェクトの規則で snz-design と同じ文に kinari リポジトリを追加、写しの規則に kinari を 3 つ目として追記し「kinari の写し」節（更新手順・通知・テスト・?raw と Vitest の css.include）を新設、コマンド一覧に verify、lib 一覧とテスト一覧に kinari、未信頼 Markdown の境界に kinari の写しも走査しないことを追記。
- README.md / README.ja.md：機能一覧とスライドテーマ節で kinari（theme: kinari）とリポジトリへのリンク、@size が kinari にもあること。

## 検証（AC #7）
pnpm lint（188 files, no fixes）、pnpm build、pnpm test（53 files / 668 tests）すべて通過。node scripts/kinari.mjs verify ok。

## AC #4 の計測（オーナー、2026-11-13）
- ビルドしたアプリで macOS / Windows / Linux を確認し、問題なしとの報告。対象は、スライド表示中と発表中のモード切り替えへの追従と、紙のテクスチャの継ぎ目。
- 報告には、light-dark() に対応していないエンジンがあったかは含まれていない。そのため @supports によるライト側へのフォールバックが実機で働いたかは記録がない（3 環境とも対応していたなら、この経路は通っていない）。
<!-- SECTION:NOTES:END -->
