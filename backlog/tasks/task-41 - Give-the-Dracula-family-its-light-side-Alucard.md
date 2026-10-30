---
id: TASK-41
title: Give the Dracula family its light side (Alucard)
status: Done
assignee: []
created_date: '2026-09-28 08:00'
updated_date: '2026-10-30 20:00'
labels:
  - feature
  - 決定先行
  - 差し込み
milestone: m-5
dependencies:
  - TASK-40.2
references:
  - src/lib/color-choice.ts
  - index.html
  - src/styles/_vars.scss
  - src/styles/global.scss
  - ../snz-design
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-40.2 the colour is two choices, a family and a light / dark mode (snz-design doc-7 §4). Dracula is one of the two families that carry only a dark side, so on Dracula the mode menu and the settings select disable Light and Auto (OS) with a reason. The Dracula project publishes an official light variant, Alucard; this task gives the Dracula family that light side, so that Light and Auto (OS) become choosable there.

Nord stays dark only: it has no official light variant (owner, 2026-09-28).

Where the change lands: a family's sides are one table in `lib/color-choice.ts` (`SIDES`) and one in the bootstrap in `index.html`, and the two copies move together; the palette is a new block beside `theme-dracula` in `_vars.scss`, selected in `global.scss` on the family and the mode attributes. Take Alucard's values from the Dracula project's official specification and name the source and version in the comment, since the values are not mallow's own.

A behaviour change to settle while starting: a stored mode the family could not draw was kept rather than rewritten (doc-7 §4.2), so an install that chose Dracula while its mode was Auto (OS) or Light has that mode stored. Once Dracula has both sides that stored mode takes effect, and such an install opens in Alucard on a light OS without the reader choosing again. This is doc-7 §4.2 working as designed, but it is a visible change and should be accepted or handled deliberately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Dracula family draws Alucard as its light side and Dracula as its dark side; Light and Auto (OS) are choosable on Dracula in both the mode menu and the settings modal, and Nord stays dark only with its reason
- [x] #2 The sides table in lib/color-choice.ts and the copy in index.html agree, and unit tests cover Dracula resolving to light and dark
- [x] #3 Every stored value opens as before or as the reading rule now decides: the pre-split 'dracula' still opens Dracula dark, and the stored Dracula + Auto (OS) / Light case is handled as decided when starting, with that decision recorded in Implementation Notes
- [x] #4 Alucard's palette values come from the official Dracula specification, cited with its source; text, code and mermaid rendering are checked in Alucard, and the print paper stays Standard Light
- [x] #5 AGENTS.md / AGENTS.ja.md and README describe Dracula as two-sided and Nord as dark only
- [x] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判断 (AC #3、2026-10-30、オーナー): 保存値が Dracula + 自動 (OS) / Light の環境が更新後に Alucard で開く変化は受け入れる。doc-7 §4.2 の「明暗の選択は書き換えない」どおりで、移行処理は入れない。Dark に固定する移行はこの規則に反し、OS追従の選択を消し、移行済みの印も要るため採らなかった。分割前の `dracula` は Dark に読むので Dark のまま (単体テストあり)。リリースノートに一文が要る。

Alucard の値は公式仕様 https://draculatheme.com/spec の生 HTML で確認した (2026-10-30)。仕様に版番号も更新日も無いので、コメントには URL と参照日を書いた。仕様に無い段階 (ink-strong, faint, surface-nested, teal-dark, accent-pressed, on-danger-soft, attention-fg と各 alpha) は mallow の値で、コメントにそう書いた。

印刷: family と mode の2属性で選ぶ Alucard のブロックは詳細度 (0,3,0) で、print.scss の `:root[data-color-family]` (0,2,0) に勝つ。そこで print.scss のリストに2属性のセレクタを足した。検証は headless Chrome の PDF を PNG にして比較した: Alucard と Standard Light はハッシュ一致、print.scss の修正を外した対照だけ不一致。

コントラスト比 (計算値): ink/bg 15.89、muted/bg 5.56、muted/surface 4.75、link/bg 5.78、link/surface 4.93、on-accent/accent 5.96、focus/bg 4.57、focus/surface 3.90、control-border/surface 4.75、faint/bg 3.83、faint/surface 3.27、danger/bg 4.85、danger/surface 4.14。danger は仕様の Red のままで surface 上は 4.5 未満。追加配色は doc-5 §3.1 の受入基準の対象外 (doc-18)。

表示の確認は一時ハーネス (Vite + Chromium、コミットせず削除) で行った: 本文・リンク・インラインコード・チェックボックス・表・コードブロック・mermaid を Alucard で描画し、mermaid は明るいテーマで描かれ、エラーなし。ModeMenu は Dracula で3項目とも選択可、Nord では Light と自動 (OS) が無効で理由つき。

測っていないもの: 実アプリ (WKWebView / WebView2 / WebKitGTK) での見た目と実際の印刷。設定モーダルは描画せず、ModeMenu と同じ `modeAvailable` / `isOneSided` を読むことをコードで確認し、Dracula の3モードは単体テストで押さえた。

snz-design 側は未更新: doc-7 §4.2 は Dracula を片側の系統として挙げており、doc-16・doc-18 にも同様の記述がある。
<!-- SECTION:NOTES:END -->
