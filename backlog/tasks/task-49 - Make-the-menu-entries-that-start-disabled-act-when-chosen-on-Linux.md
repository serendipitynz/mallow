---
id: TASK-49
title: Make the menu entries that start disabled act when chosen on Linux
status: Done
assignee: []
created_date: '2026-11-04 20:47'
updated_date: '2026-11-05 04:42'
labels:
  - bug
milestone: m-7
dependencies: []
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On Linux, choosing Edit → Find…, Find Next or Find Previous, or View → Back or Forward, from the menu bar does nothing (owner's round, 2026-11-05, Ubuntu 24.04 on VMware Workstation 17 Player, the TASK-47 build). The same actions work from their chords on Linux (TASK-47 AC #1, #4; TASK-44 AC #2), and every entry works from the menu on macOS and Windows.

What the five entries share is not established. One shape they all have: each is built with `.enabled(false)` in `menu.rs` and enabled later by `apply_focused_gates` through `set_enabled`, while an entry enabled from the start — Toggle Explorer — has not been reported as failing. A second candidate is the routing: `emit_focused` resolves its target with `focused_window`, and whether a GTK window still reports itself focused while its menu is open is unmeasured. Neither has been checked. `Export as PDF…` starts disabled too, and whether it acts when chosen from the Linux menu is not recorded anywhere — checking it is the cheapest way to tell the two candidates apart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause is identified on Linux and recorded on this task, with what was measured
- [x] #2 On Linux, Edit → Find…, Find Next and Find Previous and View → Back and Forward act when chosen from the menu, in a window whose view has find or whose history has somewhere to go
- [x] #3 Every other menu entry that starts disabled (Print… is refused on Linux by design; Export as PDF…) is checked on Linux and its outcome recorded
- [x] #4 macOS and Windows keep working from the menu
- [x] #5 cargo fmt --check, cargo check and cargo test pass inside src-tauri/, and pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 仮説（ソース読みで最有力）: Linux の tao は is_focused() を gtk::Window::is_active() で答え、GDK はメニューのグラブ中フォーカスがグラブ先へ移ったものとして扱う（X11 では NotifyGrab の FocusOut で toplevel の has_focus を落とす）。メニューをクリックで選ぶと、イベントが handle_event に届く時点でどのウィンドウも focused を報告せず、emit_focused が黙って何もしない。アクセラレータ経由（チョード）はグラブが無いので届く。この仮説は「無効で始まる」5 項目に限らず、Toggle Explorer / Open… / Settings… / Close Window もクリックでは失敗すると予測する。
2. menu.rs に menu_window を追加: フォーカス中のウィンドウ、無ければ Linux に限り最後にフォーカスされた生存ウィンドウ（session::most_recent_window）。判定は純関数 menu_target にして単体テスト。handle_event の全経路と apply_focused_gates、open_recent の has_focused_window をこれに揃える。macOS / Windows は従来どおりフォーカス中のウィンドウのみ。
3. フォールバックを取ったときに stderr に 1 行出す。これが Linux 実機での計測そのもの（クリックのたびにこの行が出れば仮説 1 が確定、出ずに失敗するなら別原因）。
4. Linux 実機ラウンド（所有者）: Find / Find Next / Find Previous / Back / Forward / Export as PDF… / Toggle Explorer / Close Window をメニューから選び、stderr と結果を記録。XDG_SESSION_TYPE も記録。
5. fmt / check / test と pnpm lint / build / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 原因（AC #1）

Linux ではメニューをポインタで選ぶと、イベントが `handle_event` に届く時点でどのウィンドウもフォーカスを報告しておらず、`emit_focused` が送り先を見つけられずに黙って捨てていた。

- tao は Linux の `is_focused` を `gtk::Window::is_active` で答える（tao-0.35.3 `src/platform_impl/linux/window.rs:582-584`）。開いているメニューがフォーカスを持つので、持ち主のウィンドウはアクティブでなくなる。item の `activate` はメニューが閉じるときに走り、tauri はイベントを 1 ループ後に配送するため、ウィンドウがフォーカスを取り戻す前に届く。
- アクセラレータ（チョード）はメニューを開かないので届いていた。症状と一致する。
- 「無効で始まる」は原因ではなかった。muda の GTK 実装は sensitive と無関係に `activate` を接続し、`set_enabled` は全ウィンドウの GTK 項目に反映する（muda-0.19.3 `src/platform_impl/gtk/mod.rs:683-690`, `:1099-1128`）。この原因は Toggle Explorer / Open… / Settings… / Close Window / Open Recent の置き換えもクリックでは失敗させていたはずで、報告がなかったのは試されていなかったため。

計測（2026-11-05、所有者、Ubuntu 24.04 on VMware Workstation 17 Player、`XDG_SESSION_TYPE=wayland`、`pnpm tauri dev`）: フォーカスを報告するウィンドウが無いままメニューイベントが届いたら 1 行出す一時ログ（e2e8798、4a9fedc で revert）を入れて各項目をクリックした。貼られたのは `menu event "view:toggle-explorer" arrived with no window reporting focus` の 2 行で、ほかに実行した項目の行も出ていた、と所有者は記憶から報告している（VM を落としたため全文は再取得していない）。X11 の GDK がグラブ中のフォーカスをグラブ先に移ったものとして扱うことはソースで読めるが、Wayland での仕組み（xdg_popup のグラブがキーボードフォーカスを取る）は実測していない。

## 修正

`menu_window` を追加: フォーカスを報告するウィンドウ、無ければ **Linux に限り** 最後にフォーカスされた生存ウィンドウ（`session::most_recent_window`）。判定は純関数 `menu_target` にして単体テスト 2 件。`handle_event` の全経路、`apply_focused_gates`、`open_recent` のフォーカス有無の判定をこれに揃えた。ゲートも同じ答えを読むので、項目は操作先のウィンドウについて有効になる。macOS / Windows でフォーカスが無いのは全ウィンドウ最小化か別アプリの背面にあるときで、見えないウィンドウを操作させないためフォールバックしない（従来どおり）。送り先が見つからないイベントは stderr に記録するようにした（以前は無音）。

## AC

- #2 / #3: 同じ Linux ラウンドで Edit → Find… / Find Next / Find Previous、View → Back / Forward、File → Export as PDF…、View → Toggle Explorer、File → Close Window がメニューから全て動作。Print… は Linux では設計上常に無効（`PRINTING_IS_REACHABLE`）で、今回の変更対象外。
- #4: 所有者が macOS と Windows でメニューから動作を確認（2026-11-05）。
- #5: `cargo fmt --check` / `cargo check` / `cargo test`（113 件）、`pnpm lint` / `pnpm build` / `pnpm test`（563 件）が通過。

## 未計測

- 2 ウィンドウで、フォーカスしていない方のメニューバーを直接クリックした場合。そのウィンドウの Focused(true) がメニューのグラブより先に届かなければ、最後にフォーカスされた別のウィンドウに配送される可能性がある。
<!-- SECTION:NOTES:END -->
