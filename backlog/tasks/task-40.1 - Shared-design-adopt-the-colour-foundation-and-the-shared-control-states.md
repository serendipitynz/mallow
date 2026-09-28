---
id: TASK-40.1
title: 'Shared design: adopt the colour foundation and the shared control states'
status: In Review
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-28 05:34'
labels:
  - design
milestone: m-4
dependencies: []
references:
  - ../snz-design
  - src/styles/_vars.scss
  - src/styles/global.scss
  - src/styles/print.scss
  - src/lib/theme.ts
  - index.html
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First subtask of TASK-40. It brings the trial (TASK-39) onto main, moves the vendored token copy to the current release, and gives the basic controls the shared states. The screen subtasks (TASK-40.2 to TASK-40.6) build on it.

The trial branch `trial/snz-design-tokens` is not turned into a PR: cherry-pick its commits (TASK-39's ledger entry included) onto this subtask's branch and mark TASK-39 Done as a trial, the way snz_studio took in its trial. The trial's copy `src/styles/snz-tokens.css` has a hand-written first line, so it does not pass the verify step; replace it with `vendor.mjs copy` instead of editing it. Comments that cite snz-design use the form `snz-design doc-N §X` (doc-16 §6.4).

snz-design's adoption record for mallow is created alongside this subtask (doc-16 §10).

snz-design references: doc-16 §6, §7.2, §10, §11; doc-15 §7 and §8 (vendoring and verify); doc-8 §5.1, §5.3, §5.4, §6.1 to §6.3 (basic controls); doc-7 §6.2 (reading stored values); doc-14 §7 (the mallow row); doc-4 §5.2 (the document, code and diagram rendering to keep).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The trial's changes reach this branch by cherry-pick and TASK-39 is Done; src/styles/snz-tokens.css comes from node ../snz-design/tokens/vendor.mjs copy at the latest tokens release and passes vendor.mjs verify
- [x] #2 Standard Light / Dark and Solarized Light / Dark draw the shared values, Dracula and Nord keep their palettes, and every stored theme value opens as before without being rewritten (snz-design doc-7 §6.2)
- [x] #3 Buttons take the variants of snz-design doc-8 §6.1 (primary, normal, danger), so the update dialog's main action no longer borrows .is-active; hover and press change the surface and never the position
- [x] #4 Every focusable control draws the shared focus ring on keyboard focus and not on pointer press (doc-8 §5.1); disabled controls draw the dashed outline at 0.45 opacity and keep the default cursor (doc-8 §5.4); surfaces and controls take the shared radii
- [x] #5 The palette of the printed paper (keep the pre-trial light values, or align it with Standard Light) is decided with the owner and recorded, and the split handle's hover is checked on the shared colours (snz-design doc-14 §7)
- [x] #6 Markdown, code, mermaid, HTML, CSV / TSV and XML views are checked in the four schemes and in Dracula and Nord
- [x] #7 AGENTS.md and AGENTS.ja.md gain a section saying the shared design lives in snz-design beside this repository, that doc-16 and the adoption record for mallow are read before a screen is built or changed, and that the vendored copy is never edited by hand (doc-16 §11)
- [x] #8 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 写しの更新 (独立 commit): vendor.mjs copy 0.1.1 で snz-tokens.css を置き直し、印刷用に _snz-tokens.scss も同じ版から写す。verify を両方に通す。global.scss の自前の color-scheme 宣言は写しが持つので消す
2. 印刷の紙: theme-print を _snz-tokens.scss の $snz-colors standard/light からコンパイル時に作る (オーナー決定 2026-09-28)。dark 配色の画面から紙が light のまま出ることを確かめ、TASK-39 AC#3 の証跡にする
3. ボタンの変種: .btn を通常、.btn--primary (更新ダイアログの主操作。.is-active の借用をやめる)、.btn--danger を用意。hover / 押下は面だけを動かし (surface-hover / surface-pressed、主操作は accent-hover / accent-pressed)、位置は動かさない。Dracula / Nord にも押下の面を足す
4. 横断規則: アプリの枠の操作部品すべての :focus-visible を 2px solid 焦点色 offset 1px に揃える (スクロールする箱の中は内側に描く)。無効は破線 + 0.45 + 既定カーソル。角丸は操作部品 radius-sm、面 (ポップアップ・モーダル) radius-md。文書の中の描画は対象外
5. 分割つまみの hover を共通の値で見直す (焦点色がベタ塗りになったため)
6. 試験ブランチのコメントを snz-design doc-N §X の形に揃え、AGENTS.md / AGENTS.ja.md に共通デザインの節を足す
7. 4 配色 + Dracula / Nord で各ビューを確認、pnpm test / lint / build
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (オーナー, 2026-09-28)
- 印刷の紙の配色 (AC#5): 標準 Light へ揃える。`_snz-tokens.scss` も 0.1.1 から写し、theme-print を `$snz-colors` の standard/light からコンパイル時に作る。
- snz-design の「mallowの共通デザイン適用記録」(doc-16 §10) は別セッションで作る。この PR は mallow 側だけを扱う。
- doc-16 §2.2・§6.4・§11 は「mallow では snz-design を名指ししない」と書いているが、本タスクの本文と AGENTS.md の Conventions の変更 (名指しを認める) に従った。doc-16 の該当節は snz-design 側で改訂が要る。

## 変えたこと (diff から読めない理由)
- 写し: `vendor.mjs copy 0.1.1` で `snz-tokens.css` と `_snz-tokens.scss` を置き、`verify` は両方一致。写しが `color-scheme` を明暗属性から宣言するので、global.scss の自前の宣言は消した (CHANGELOG 0.1.0 の利用側の作業)。
- `--color-*` と役割の対応を `$shared-roles` の map 1つにし、画面用 (`var(--snz-*)`) と紙用 (コンパイル時の値) の両方をそこから作る。紙と画面で対応がずれない。
- `@use './snz-tokens'` は隣の `snz-tokens.css` (素の CSS) を読んで `$snz-colors` が未定義になったので、`./_snz-tokens.scss` と明示した。
- ボタン: `.btn` (通常)・`.btn--primary`・`.btn--danger`。更新ダイアログの主操作は `.is-active` の借用をやめて `.btn--primary`。hover / 押下は面だけを動かす (0.1.1 の surface-pressed / accent-pressed)。Dracula / Nord には accent-pressed・on-accent・pressed-bg を足した。`.btn--danger` を使う画面はまだ無い (取り消せない操作のボタンが今の mallow に無い)。
- 横断規則: `focus-ring` / `disabled-control` の mixin。スクロールする箱の中の行 (ツリー・メニュー項目・最近のフォルダ・設定ツリー・アウトライン) は枠を内側に描く (doc-16 §6.3)。メニュー項目には :focus-visible が無かったので足した。コードブロックと mermaid のコピーボタンも通常のボタンの形へ (輪郭を操作部品の線へ)。
- 角丸: 操作部品は radius-sm (6px)、面 (ポップアップ・モーダル・ビューアの枠と告知の帯) は radius-md (10px)。Markdown の本文の中の描画 (コードブロック・画像・mermaid) は doc-4 §5.2 の保持対象なので変えていない。
- 分割つまみの hover: 焦点の色が半透明から濃いアクセントになり、hover が焦点に見えるので、操作部品の線 (line-control) に替えた。
- unattended/run.ts: 試験ブランチは `data-theme` だけを置いていたため、`--theme dark` が明暗属性に届かず、紙の検査の dark 側が暗い経路を通らなかった。App から `applyTheme` を AppSeam で渡す (run.ts が lib/theme を直接読むと、Node で走る run.test.ts が `window` で落ちる)。

## 確認 (2026-09-28, macOS 26.6.2)
- 環境: Claude のブラウザペイン (Chromium) で Vite の開発サーバーを開き、`__TAURI_INTERNALS__` の代役 (作業用ディレクトリのスクリプト。read_dir_tree / read_file を実ファイルへ中継) を差し込んだ。800×600、OS は明るい側。WKWebView の実窓ではない。
- AC#2: 保存値 無し / auto / light / dark / solarized-light / solarized-dark / dracula / nord / bogus を置いて開き直し、属性は standard/light (無し・auto・bogus・light、OS が明るいため)、standard/dark、solarized/light、solarized/dark、dracula/dark、nord/dark。保存値はすべて置いたまま。
- コントラスト比 (描かれた色から WCAG 2.x、Standard L / Standard D / Solarized L / Solarized D): ボタンの文字 14.42 / 11.44 / 12.05 / 10.61、hover 11.52 / 10.07 / 10.41 / 9.91、押下 10.70 / 9.08 / 9.05 / 8.07、ボタンの輪郭 4.05 / 3.83 / 4.13 / 3.26、主操作の文字 7.52 / 7.91 / 5.41 / 6.79 (hover 9.73〜7.26、押下 10.80〜8.26)、危険色の文字 6.78 / 6.16 / 6.17 / 5.39、焦点の枠 (本文の地) 7.31 / 6.73 / 5.41 / 5.88・(サイドバー) 6.63 / 7.71 / 4.76 / 6.79・(選択行) 5.90 / 5.76 / 4.66 / 5.62、分割つまみの hover (サイドバー) 3.68 / 4.39 / 3.64 / 3.76。
- 状態: Tab で移ったボタンにだけ外側の枠が出る。主操作の hover で面が1段濃くなる。無効の Clear は cursor default・opacity 0.45・dashed。モーダルの角丸 10px、ボタン 6px。
- AC#6: Markdown (コード・mermaid・表・引用)、HTML (rendered.html)、CSV (sales.csv)、XML (attrs.xml・Info.plist) を Standard L/D・Solarized L/D・Dracula・Nord で目視し、読めない組は無かった。mermaid とコードの明暗は明暗属性に従った。
- AC#5 と紙: 無人ビルドで print-pagebreaks.md を `--theme light` / `--theme dark` で書き出し、measure-paper.mjs は両方全項目通過 (14 ページ、文字高 18.55 / 基準 18.56)。PDF の塗り色は dark でも本文 #232a36・リンク #14549e・区切り線 #d7dbe2 (標準 Light)。dark では mermaid が暗い側、コードが単色 — 暗い経路を通ったうえで紙が明るい。
- pnpm lint / pnpm test (30 ファイル 385 件) / pnpm build 通過。

## 測っていないこと
- WKWebView の実窓での比と見え方 (上はすべて Chromium)。2 つの窓の間の反映。Dracula / Nord の比 (doc-7 §6.3 で対象外。hover の面が半透明なのでこの測り方では出ない)。
- 無効の部品がフォーカスを受けて理由を語で持つこと (doc-8 §5.4) は、画面ごとの子タスク (TASK-40.3〜40.6) に残した。今の無効は native の `disabled` のままで、フォーカスから外れる。
- dark の紙で mermaid が暗い側のまま印刷される点は試験前と同じ挙動で、変えていない。
<!-- SECTION:NOTES:END -->
