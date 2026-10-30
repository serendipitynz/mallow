---
id: TASK-45
title: Put back and forward buttons in the toolbar
status: Done
assignee: []
created_date: '2026-10-30 04:01'
updated_date: '2026-10-30 05:00'
labels:
  - feature
milestone: m-5
dependencies:
  - TASK-44
references:
  - src/components/Toolbar.tsx
  - src/App.tsx
  - src/components/icons.tsx
  - src/components/OpenWith.tsx
  - >-
    backlog/tasks/task-44 -
    Go-back-and-forward-through-the-files-a-window-has-shown-and-remember-how-each-was-being-read.md
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-44 gave each window a visit history, reachable from the keyboard (`Cmd+[` / `Cmd+]` on macOS, `Alt+Left` / `Alt+Right` on Windows and Linux), the mouse's side buttons and the View menu. Nothing on screen says the history exists: a reader who uses neither the chords nor the menu bar, or whose mouse has no side buttons, has no way to find it. This task adds the on-screen route — a back button and a forward button in the toolbar.

The buttons are a fourth entry to the same move, not a second implementation: they call the `go(direction)` `App` already hands the chords, the side buttons and the `menu:back` / `menu:forward` events, and they enable and disable on the same `canGoBack` / `canGoForward` that `report_history_moves` sends to the menu.

They are icon-only buttons in the sense of snz-design doc-8 §6.2, so they carry a word for the reader even though none is drawn, and where there is nowhere to go they are disabled in the way doc-8 §5.4 asks: shaped and worded, still focusable, the reason reaching the reader — the `aria-disabled` form `OpenWith`'s trigger already uses, not the `disabled` attribute. The toolbar's layout is an app-specific exception in snz-design's adoption record for mallow (doc-18), so where the pair sits is mallow's to decide; the rows for the toolbar's buttons in that record gain one when this lands, on the snz-design side.

To settle at the start: the pair's place in the toolbar (the lead group beside Open folder, where a browser puts them, is the default, and the explorer toggle's rule of sitting at the end on the explorer's side has to be kept), and the Lucide glyph (`arrow-left` / `arrow-right` or `chevron-left` / `chevron-right`).

Out of scope: a long-press or right-click list of the history entries, and showing the history anywhere else.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The toolbar carries a back button and a forward button; pressing one moves the window's visit history one step, through the same move the chords, the side buttons and the View menu use
- [x] #2 Each button has a label that reaches the reader in both ja and en, and a tooltip that names the platform's chord (⌘[ / ⌘] on macOS, Alt+← / Alt+→ on Windows and Linux)
- [x] #3 Where there is nowhere to go the button is disabled per snz-design doc-8 §5.4 — it keeps the focus, shows the disabled shape, and its reason in words reaches the reader — and its state agrees with the View menu's Back / Forward in every window
- [x] #4 The icons are Lucide path data copied into components/icons.tsx, with no new dependency
- [x] #5 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 着手時の判定: 配置はツールバー先頭グループ、エクスプローラのトグル (左側時) の直後・フォルダを開くの前。図形は lucide arrow-left / arrow-right (ツリーの展開に chevron-right を使っており、別の意味で同じ図形が並ぶのを避ける)。オーナー確認済み。
2. icons.tsx に ArrowLeftIcon / ArrowRightIcon を lucide の座標のコピーで追加。
3. lib/history-nav に方向ごとの和文・英文ラベル用キーと、プラットフォームごとのコード表記 (⌘[ / ⌘] と Alt+← / Alt+→) を返す純関数を足し、単体テストを書く。
4. Toolbar に戻る・進むボタンを足す。App の go と canGoBack / canGoForward をそのまま渡す (メニューへ report_history_moves している値と同じ)。無効は OpenWith と同じ aria-disabled + 視覚的に隠した理由 + aria-describedby。押しても aria-disabled のときは何もしない。
5. i18n の ja / en に語ラベルと無効理由を追加。
6. pnpm lint / build / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判定 (オーナー確認済み、2026-10-30):
- 配置はツールバー先頭グループの、エクスプローラのトグル (左側時) の直後・フォルダを開くの前。Finder / Safari / ブラウザと同じ先頭側。トグルがエクスプローラ側の端に立つ規則はそのまま (左なら先頭、右なら末尾)。
- 図形は lucide の arrow-left / arrow-right。chevron 系はツリーの展開に chevron-right を既に使っており、別の意味の同じ図形が並ぶのを避けた。

実装:
- ボタンは App の `go` と `canGoBack` / `canGoForward` をそのまま受ける。メニューへ `report_history_moves` している値と同じ変数なので、どのウィンドウでも View メニューの Back / Forward と状態が一致するのは構造による (別に計算しない)。
- 無効は OpenWith のトリガーと同じ `aria-disabled` + 視覚的に隠した理由 + `aria-describedby`。`disabled` 属性を使わない理由は §5.4 に加えてこの部品固有のものがある: 戻るを押して先頭に着いた瞬間、押したボタン自身が無効になるので、`disabled` だとフォーカスが body へ落ちる。aria-disabled のときの押下は何もしない (`go` 側も `canGo` で弾くが、ボタン側でも呼ばない)。
- ツールチップのコード表記は `lib/history-nav` の `historyChordLabel` に置き、`historyChordDirection` と同じファイルで持つ。単体テストを追加。
- 理由の語は ja「戻る先のファイルがありません」/ en「No file to go back to」(進むも同形)。

検証:
- pnpm lint / pnpm build / pnpm test (41 files, 518 tests) が通る。
- 実ウィンドウでの確認はしていない。AC #1〜#3 (押して1歩動く・ja/en の語と各プラットフォームのコード表記のツールチップ・無効時にフォーカスが残り理由が読み上げへ届く・複数ウィンドウで View メニューと一致) はオーナーの実窓確認に残す。

実窓確認 (オーナー、2026-10-30): AC #1〜#3 を実際のウィンドウで確認済み。PR #82 でマージ。
<!-- SECTION:NOTES:END -->
