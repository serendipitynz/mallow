---
id: TASK-40.6
title: >-
  Shared design: bring the settings modal and the update dialog to the shared
  modal spec
status: In Review
assignee: []
created_date: '2026-09-28 03:59'
updated_date: '2026-09-29 01:15'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
  - TASK-40.2
references:
  - ../snz-design
  - src/components/SettingsModal.tsx
  - src/components/UpdateDialog.tsx
  - src/styles/app.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on TASK-40.1 and after TASK-40.2 (which adds the colour-family choice to the settings modal). Neither modal moves focus in on open, traps it, or returns it on close, and the whole surface scrolls with its heading. The update dialog removes its × at the stages that cannot be closed, and its indeterminate progress stops under reduced motion (snz-design doc-13 §4 and §10). The settings' segmented controls still have the pre-TASK-29 form. snz_studio made the same move for its modals in its TASK-61 (fixed heading, scrolling body); snz-design TASK-30 set the action area's alignment and order.

snz-design references: doc-9 §6.6 (modal), §6.12 (segmented control, as revised by snz-design TASK-29), §5.1 and §5.3; doc-8 §6.7.1 (progress); doc-16 §6.3 (focus rings inside a scroll box); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both modals move focus in on open, trap it and return it on close; Escape and the overlay click still close, and the update dialog over the settings modal still leaves the settings inert (doc-9 §6.6)
- [x] #2 When a modal is taller than the window, the heading and × stay and only the body scrolls, and a focused control is neither hidden behind the fixed areas nor clipped by the scroll box (doc-9 §6.6, doc-16 §6.3); no horizontal scroll at 360px wide or on a short window
- [x] #3 The action area follows the alignment and order of doc-9 §6.6
- [x] #4 The settings' segmented controls take the form of doc-9 §6.12: one Tab stop per group, arrows move without choosing, and the chosen surface slides, cross-fading under reduced motion
- [x] #5 At the update stages that cannot be closed, the × is handled per doc-9 §6.6 (removed, or disabled with a reason) and the choice is recorded; the indeterminate progress slows rather than stops under reduced motion (doc-8 §6.7.1)
- [ ] #6 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [x] #7 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 共通の Modal コンポーネント (components/Modal.tsx) を足す。覆い・面・見出し域 (× 付き)・本体域 (ここだけスクロール)・任意の操作域 (右寄せ、取り消し → 実行の文書順) を持ち、開くとき焦点を面/最初の入力欄へ移し、Tab を面の内側に閉じ込め、閉じるとき預けた焦点へ返す。Escape は最も後から開いたモーダルだけが受け、IME 変換中は受けない。SettingsModal と UpdateDialog は両方これに載せる。
2. 更新ダイアログ: 「あとで」→「導入する」の順で操作域へ移す。閉じられない段階 (downloading/installing/relaunching) は × を消さず aria-disabled にして、理由の語 (画面に出す) を describedby に結ぶ。段が変わって焦点の在った按钮が消えたら面へ戻す。ノート欄はスクロール箱なので tabindex=0 でキーボードから届かせる。
3. 設定モーダル: エクスプローラの位置と起動時の更新確認を Segmented (溝の上を浮いた面が動く形) に置き換える。言語は選択欄 (.select)。`.settings-group` に container-type を宣言して 22rem 以下で縦積みにする。操作域は持たない (設定は押した時点で保存され、実行と取り消しが無い)。この選択は snz-design TASK-32 が扱う論点として記録する。
4. SCSS: .modal を縦 flex にして見出しと操作域を固定、本体だけ overflow:auto。未確定の進捗の流れは reduced-motion で止めず遅くする (1.4s → 4s)。
5. 検証: pnpm lint / build / test。ブラウザ窓 (vite) で 360px 幅・低い窓・4配色のコントラスト/焦点の届き方を確かめ、Implementation Notes に記録。WKWebView の実窓確認はオーナー確認として AC#6 を未チェックのまま報告。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 実装
- 共通の `components/Modal.tsx` を足し、設定と更新ダイアログを両方これに載せた。覆い・面・見出し域(×)・本体域・任意の操作域。開くとき焦点を `[data-autofocus]`(設定は配色系統の選択欄)か面に置き、Tab を手で内側に折り返し、閉じるとき預けた焦点へ返す。預けた先が body(WebKit はポインタ押下でボタンを focus しない)のときはフッターの設定ボタンへ返す。
- Escape と Tab は「最も後から開いたモーダル」だけが受ける(トークンの配列)。設定の上に更新ダイアログが出ても Escape で両方閉じない。`covered` は `inert` としてだけ残した(ポインタと読み上げ側)。IME 変換中(`isComposing` / keyCode 229)は Escape を受けない。設定にも更新ダイアログにも入力欄は無いので実害は無いが、規則どおり置いた。
- `.modal` を縦 flex にして見出し域と操作域を固定し、本体域だけ `overflow:auto`。`scroll-padding` に焦点枠の外側分(枠の幅 + offset)を取り、焦点を受けた末尾の部品の枠が本体域の縁で切れないようにした(doc-16 §6.3)。背後のスクロールは覆いが固定でスクロール箱を持たず、ホイールの連鎖先に `.doc-scroll` が無いので止まっている(専用の凍結は書いていない)。
- 更新ダイアログ: 操作域を右寄せ、文書の順も「あとで → 導入する」(以前は逆)。閉じられない段(downloading / installing / relaunching)は × を消さず `aria-disabled` にして、理由の語(「導入が終わるまで、この画面は閉じられません。」)を本体に出し `aria-describedby` で結んだ。**× は消さず理由付きで無効にする、を選んだ**: 消すと段の切り替えで見出し域の寸法が動くこと(doc-9 §5.6)、doc-13 §10 の「消さず理由付きで無効にするか」に答えること、押せない理由をキーボードだけの利用者にも届けること(doc-8 §5.4)。段が変わって焦点のあったボタンが消えたときは `refocusKey` で面へ戻す。リリースノートの `<pre>` はスクロール箱なので `tabIndex=0` にして、キーボードからスクロールできるようにした(WebKit は自前で止まりを持たない)。
- 量が分からない進捗の流れは reduced-motion で止めず 1.4s → 5s に遅くした(doc-8 §6.7.1)。
- 設定: エクスプローラの位置と起動時の更新確認を `Segmented`、言語は選択欄(所有者の指定 2026-09-29。doc-9 §6.12 の例では言語も選択肢ボタンの組だが、選択欄でも仕様に反しない: 選択肢を同時に見せる必要が無ければ選択欄)。更新確認の語は「オン / オフ」のまま。`.settings-group` に `container-type: inline-size` を宣言し、22rem 以下で縦積みになる。
- 設定モーダルは操作域を持たない: 設定は押した時点で保存され、実行と取り消しが無い。doc-9 §6.6 は操作域を必須とするが、区画ごとに保存するモーダルの扱いは snz-design TASK-32(未着手)が書く。snz_studio の設定モーダルも同じ形(doc-17 §3)。TASK-32 が書いた後にこの差を見直す。

## 確かめたこと(Chromium のブラウザ窓。Tauri は stub。WKWebView ではない)
- 設定を開く → 焦点は配色系統の選択欄。Tab は 選択欄 → 明暗 → 位置(組で止まり1つ) → 言語 → フォルダ選択 → 更新確認(組で1つ) → 今すぐ確認 → × と回り、末尾から先頭の × へ折り返す。Escape で閉じ、フッターの設定ボタンへ焦点が返る。
- 更新ダイアログを設定の上に出す: 設定は `inert`、焦点は更新ダイアログの面。Escape は更新ダイアログだけを閉じ、焦点は開く直前の「今すぐ確認」へ返る。閉じられない段: Escape も × も何も起こさず、× は破線で `aria-describedby` が理由の語を指す。
- 幅 320×高さ 300: 本体域の scrollWidth = clientWidth(270)、文書の横スクロールなし。本体域だけがスクロールし(sh 758 / ch 191)、見出し域と操作域は残る。360 幅では位置の組が縦に積まれる。操作域は右寄せ、順序 Later > Install。
- 末尾の「今すぐ確認」を焦点で開くと、`scroll-padding` により本体域の下縁から 3px の余裕を保つ(足す前は 0 で枠が切れた)。
- `pnpm lint` / `pnpm build` / `pnpm test`(440 件)通過。

## コントラスト(doc-5 §3.2 の測定点。モーダルの面 `--color-surface-raised` 上、ブラウザ窓の computed style から算出)
| 測定点(基準) | 標準 Light | 標準 Dark | Solarized Light | Solarized Dark |
|---|---|---|---|---|
| 見出し・ラベル(4.5) | 14.42 | 11.44 | 12.05 | 10.61 |
| 補助文・区画の見出し(4.5) | 6.55 | 6.72 | 5.73 | 4.86 |
| 選択欄の輪郭(3) | 4.05 | 3.83 | 4.13 | 3.26 |
| 選択肢ボタンの組の浮いた面の輪郭 対 溝(3) | 3.42 | 4.49 | 3.64 | 3.76 |
| 焦点枠 対 面(3) | 7.31 | 6.73 | 5.41 | 5.88 |
| × の図形(3) | 6.55 | 6.72 | 5.73 | 4.86 |
| 主操作のラベル 対 面(4.5) | 7.52 | 7.91 | 5.41 | 6.79 |
| 主操作の面 対 モーダルの面(3) | 7.52 | 6.63 | 5.41 | 5.88 |
| 進捗の塗り 対 溝(3) | 6.35 | 7.77 | 4.76 | 6.79 |
無効の × は下限なし(破線 + 理由の語)。**Nord の補助文は 3.52 で 4.5 に届かない**(Dracula は 4.58)。Nord は mallow が持つ配色で AC の4配色の外、このタスクの前からある値なので手を付けていない。

## 未測定・オーナーの確認に残すもの
- **AC #6 は未チェック**: 実窓(WKWebView)での確認は済んでいない。見てほしい点: 焦点の入り・Tab の折り返し・Escape と焦点の返り、開いた選択欄のポップアップ中の Escape がモーダルを閉じないか(WebKit のポップアップが keydown を奪うかは未測定)、設定の上の更新ダイアログ、狭い窓と低い窓での本体域のスクロール、動きを減らす設定での進捗の遅さ。
- reduced-motion の進捗は CSS(`animation-duration: 5s`)を書いただけで、設定を有効にした状態では測っていない。
- キーボード到達は Chromium のブラウザ窓でのみ確認(WKWebView は wry が Tab で全操作部品へ届く設定)。環境の記録(doc-5 §5.3): Chromium(ブラウザ窓)、macOS、標準 Light を基準に4配色を computed style で測定。

## 追記(2026-09-29、オーナー指示)
- エクスプローラの位置と言語を「外観」の区画へ移し、配色・明暗と同じ行の形(ラベル左、設定右)に揃えた。起動時の更新確認の行も同じ形にした(オン/オフの語はそのまま)。狭い幅(320)では組が縦積みのまま行に収まることをブラウザ窓で確認。
<!-- SECTION:NOTES:END -->
