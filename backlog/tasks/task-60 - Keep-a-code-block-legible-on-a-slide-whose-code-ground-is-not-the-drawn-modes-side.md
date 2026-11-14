---
id: TASK-60
title: >-
  Keep a code block legible on a slide whose code ground is not the drawn mode's
  side
status: Done
assignee: []
created_date: '2026-11-13 23:05'
updated_date: '2026-11-14 08:18'
labels:
  - bug
dependencies: []
references:
  - src/styles/slides.scss
  - src/lib/deck.ts
  - src/slide-themes/kinari.css
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a kinari slide with the `invert` class, a code block's tokens are drawn for the wrong side of the paper and are close to unreadable (v0.14.0): in Light mode the slide and its code ground are dark while the tokens keep github-light's colours, so `console.log(…)` is near-black on near-black; in Dark mode the slide is light and the tokens are github-dark's pale colours on a pale ground.

**Why the colours are what they are.** mallow highlights code with Shiki for decks too (decision-18 — the deck renderer is built by the preview's factory), so every token carries an inline github-light colour and a `--shiki-dark` value, and `slides.scss` swaps to the dark one under the app's `on-dark` rule. decision-19 §5 settled exactly that: *code blocks keep following the drawn mode whatever the theme*. Two things meet that rule here:
- **kinari's code ground follows the slide, not the mode.** Its `pre` background is `--kinari-code-ground`, and `section.invert` swaps every `light-dark()` pair, so on an inverted slide the ground is the other side's while Shiki's tokens stay on the drawn mode's side. mallow's own theme does not hit this, because its `pre` keeps `--color-surface` under `invert`; a folder theme with a dark `pre` in Light mode would hit it with no `invert` at all.
- **kinari's own token palette never applies.** kinari colours the highlight.js classes (`.hljs-keyword`, `.hljs-string`, …) that Marp CLI and the VS Code extension emit; Shiki emits none, so `--kinari-code-keyword` and its siblings are unused in mallow. That is by design on kinari's side (decision-19 §7: the hljs colours are for Marp's own tools), so **nothing here is a change to the kinari repository**.

So decision-19 §5 is the thing to amend: the rule was written without `invert` in view, and "follow the drawn mode" is only right while the theme's code ground follows the drawn mode too.

Directions to weigh at the start, none chosen:
- Pick Shiki's side per code block from the slide rather than from the app — e.g. from the computed colour of the `pre` ground after Marpit's CSS applies — so a token's side follows the ground it sits on, under any theme.
- Give themes a way to state their code side (a class or custom property mallow reads), which is a new contract decision-19 §5 says mallow does not offer today.
- Emit highlight.js-compatible classes for decks so a theme's own palette applies. decision-18 rejected statically importing highlight.js (1.0 MB) and this would be a second highlighter, so it needs a reason the other two lack.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Under kinari, a code block on an invert slide is legible in Light and Dark modes, with its tokens drawn for the side of its ground
- [x] #2 Code blocks on ordinary slides under kinari and mallow's theme look as they do now
- [x] #3 decision-19 §5 is amended to say what decides a code block's side under a theme
- [x] #4 No change is made to mallow's copy of kinari, and no highlighter is added unless the amended decision gives the reason
- [x] #5 Checked on the three WebViews in both modes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 方向 1 を採る: コードブロックごとに、その地の算出背景色 (pre から section まで、最初に塗られた祖先へ半透明を合成) の輝度から Shiki の側を決め、pre に data-code-side=light|dark を書く。読めなければ属性なしで描画モードに従う (今の挙動)
2. 色の読み取りは 1px canvas で正規化 (rgb / oklch / color() のどれでも) し、合成と輝度判定は純関数として lib に置いて Vitest で固定
3. SlideStage の layout effect でスライドごとに測り、描画モードの変化 (onThemeChange) と配色の選択変化 (onColorChoiceChange) で測り直す
4. slides.scss: on-dark の入れ替えを data-code-side=light の pre から外し、data-code-side=dark の pre はモードによらず --shiki-dark にする
5. decision-19 §5 と最後の Consequence (片面のフォルダテーマ) を Amendment で改める。hljs 互換クラスや 2 つ目のハイライタは採らない理由も書く。kinari のコピーには触れない
6. pnpm lint / build / test。3 つの WebView × 両モードの確認 (AC #5) はオーナーに残す
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の方向はオーナーと合意して 1 (地の色で判定) を採った (2026-11-14)。2 はテーマ側の新しい約束で、kinari のリリースが要るため AC #4 の範囲では kinari が直らない。3 は 2 つ目のハイライタになり、読めるかどうかには不要。

- `lib/code-side`: pre から slide の section まで算出背景色を 1px canvas で sRGB に正規化し (rgb / color() / oklch のどれで直列化されても読めるように)、半透明の層を外側の不透明な層へ重ねて地を求める。相対輝度が黒と白の文字のコントラストが等しくなる点 (√(1.05×0.05)−0.05 ≈ 0.179) より下なら dark。不透明な層が section までに無ければ属性を付けず、今までどおり描画モードに従う
- `SlideStage`: スライドごと (html / css の変化) と、描画モードの変化 (onThemeChange) と配色の選択変化 (onColorChoiceChange) で測り直す。ファミリーの変更は側を変えずに地を塗り替えうるので、選択変化も聞く
- `slides.scss`: data-code-side=dark はモードによらず --shiki-dark。on-dark での入れ替えは属性の無いブロックだけ
- decision-19: §5 と最後の Consequence に改訂への参照を足し、末尾に Amendment を追加。kinari のコピーは無変更で、ハイライタも足していない
- Marpit の split 背景はコンテンツ層の section が `background: transparent !important` (advanced_background.js) なので、透明な pre がそこに載ると描画モードにフォールバックする。改訂に書いた

計測 (アプリ外のハーネス): renderDeck で kinari / mallow のテーマのデッキ (通常 + invert、JS のコードブロック) を描き、ビルド済みの app CSS と transpile した code-side を当てて Playwright 1.62.1 の WebKit と Chromium で各トークンの算出色と地のコントラストを測った。両エンジンで同じ値:
- kinari invert: 修正前の最低コントラスト Light 1.01 / Dark 1.22 → 修正後 3.07 / 4.38 (通常スライドの Dark / Light と同じ)
- kinari 通常・mallow のテーマ 通常 / invert: 修正前後で算出色・コントラストが同一 (kinari Light 4.38 / Dark 3.07、mallow Light 3.86 / Dark 3.59)。最低値は github のコメント色で、今と同じ
- 単体テスト 9 件 (地の合成、輝度の境目、kinari と Shiki の地)。lint・tsc・vite build・全 680 テストが通る

残したもの: AC #1・#2 はハーネスでは満たしているが、アプリ内の配線 (SlideStage の effect、モード切り替え時の測り直し) は通していないので、オーナーの確認待ち。AC #5 (3 つの WebView × 両モード) は未計測。
pnpm 経由の lint / build / test は、pnpm 実行前のインストール検査がロックファイルの minimumReleaseAge 違反 (plugin-opener 2.7.3 など 4 件) で止まるため、node_modules/.bin のツールを直接実行した。

オーナーの目視確認 (2026-11-14): kinari と mallow のテーマのデッキ (通常 + invert、コードブロック) を Light / Dark で表示し、macOS (WKWebView)・Windows (WebView2)・Linux (WebKitGTK) で同等の出力を確認した。どの組み合わせでもトークンの側がコードの地の明るさに合い (mallow のテーマの invert を Dark で見たときの、明るいスライド上の暗い地を含む)、通常スライドは従来どおり。表示中のモード切り替えでの測り直しも macOS で確認。AC #1・#2・#5 を満たす。
PR #123 でマージ。
<!-- SECTION:NOTES:END -->
