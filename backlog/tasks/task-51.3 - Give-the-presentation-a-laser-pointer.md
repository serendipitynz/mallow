---
id: TASK-51.3
title: Give the presentation a laser pointer
status: Done
assignee: []
created_date: '2026-11-11 01:30'
updated_date: '2026-11-12 20:18'
labels:
  - feature
dependencies:
  - TASK-51.2
references:
  - src/components/MarkdownView.tsx
parent_task_id: TASK-51
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While presenting (TASK-51.2), the presenter can switch the mouse cursor to a laser pointer: a bright dot that follows the pointer over the slide, with the system cursor hidden while it is on. It is drawn over the slide by the app and never touches the slide's own DOM, so the slide does not re-render as the pointer moves.

To settle at the start: how it is switched on (a key such as L as a toggle, holding a key or the mouse button, or both), its colour and size against both light and dark slides, and whether it leaves a short fading trail. The pointer is off when a presentation starts and is turned off when it ends.

It is a mouse feature: on a touch screen or with no pointer movement there is nothing to show, and that is acceptable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 During a presentation the laser pointer can be switched on and off, and while on, a dot follows the pointer over the slide with the system cursor hidden
- [x] #2 The dot stays visible against both light and dark slides
- [x] #3 Moving the pointer does not re-render or mutate the slide's DOM
- [x] #4 The pointer is off when a presentation starts and when it ends
- [x] #5 How it is switched on is shown to the reader (a tooltip or the presentation's help), in both ja and en
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib/laser: L の判定、軌跡の点の寿命（通常 0.3s・Shift 中 1.1s）と間引き、不透明度・太さの計算（純粋関数、単体テスト）
2. DeckView: 発表中だけ laser 状態を持つ（発表の開始・終了で off）、L でトグル、ポインター位置は ref に保持
3. LaserPointer（body へのポータル、pointer-events: none）: 点は div を transform で動かし、軌跡は canvas を rAF で描く。React の状態は動かさず、スライドの DOM に触れない
4. 発表中に cursor: none、開始時に Esc・F・L のヒントを数秒表示してフェード、発表ボタンのツールチップに L の行（ja/en）
5. README（en/ja）・AGENTS の DeckView の項を更新、lint/build/test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと（オーナー判断、2026-11-13）
- 切り替え: 発表中に `L` でトグル（Cmd/Ctrl/Alt 付きとキーリピートは無視、Shift 付きは受ける）。マウスボタンの押下は「クリックで次へ」と衝突するので使わない。`F`（全画面⇄ウィンドウ）では状態を保ち、発表の開始と終了で必ず off。
- 見た目: 赤（rgb(255 48 48)）の直径 14px の点に白い 2px のリング、外側に薄い黒の線と赤のグロー。スライドの拡大縮小には連動しない固定サイズ。
- 軌跡: 付ける。通常は 0.3s で消え、Shift を押しながら動かした点は 1.1s 残る（オーナー指定の 1.0〜1.2s）。寿命は点ごとに持つので、長い軌跡の途中で Shift を離しても先に置いた部分はそのまま残る。
- 案内（AC #5）: 両方の発表ボタンのツールチップに「発表中は L でレーザーポインター」の行を追加し、発表開始時に Esc・F・L のヒントを画面下に約 4 秒表示して 1 秒でフェードアウトする（F では再表示しない）。Esc と F はこれまで README 以外に説明がなかったので一緒に載せた。

## 実装
- `lib/laser`（純粋関数）: L の判定、軌跡の点と寿命、強さ（1→0）、生きている点の抽出。単体テスト 6 件。
- `LaserPointer`: `<body>` へのポータルで、点は div の `transform`、軌跡は canvas を rAF で描く。React の状態を一切動かさないので、動かしてもスライドは再レンダリングされない。軌跡が消えたら rAF も止まる。
- ポインター位置は発表中ずっと ref に記録し、L を押した瞬間に最後の位置へ点を出す（動かすまで点が出ない状態を避けるため）。
- 発表中にレーザーが on のときは `.deck-presentation--laser` で `cursor: none !important`（デッキ自身の CSS やリンクの cursor より優先させるため）。

## 計測（AC #1〜#5）
アプリ本体ではなく、Vite dev サーバーに一時ハーネス（DeckView を Tauri API のスタブ付きで描画、計測後に削除・コミットなし）を置き、アプリ内ブラウザ（Chromium 系）で確かめた。
- AC #1: 発表開始直後はレーザーなし → L で `.laser` が出て、点は最後のポインター位置に表示。`.deck__stage` と見出しの computed cursor が `none`。もう一度 L で消える。キーリピートと Cmd+L では切り替わらない。発表外の L は何もしない。
- AC #2: 明るいスライド・invert の暗いスライド・`backgroundColor: #d22` の赤いスライドでスクリーンショットを撮り、点はどれでも見えた（赤では白いリングで見える）。**赤いスライドでは赤い軌跡は見えにくい**（AC は点についてなので対象外として残した）。
- AC #3: 発表全体（`.deck-presentation` の subtree、childList・attributes・characterData）に MutationObserver を付けて 60 回 pointermove を送り、記録 0 件。`.marpit` の innerHTML も同一ノードのまま不変。
- AC #4: on のまま F → 発表は続きレーザーも on。Esc で発表終了と同時に `.laser` が消え、再開時は off（クラスも外れ、cursor は default）。
- AC #5: ヒントに「Esc End / F Full screen / window / L Laser pointer (hold Shift while moving for a longer trail)」が表示され、5.5 秒後には DOM から消えた。ja・en とも i18n に追加。
- 軌跡: Shift 付きの点を含めて描いた直後に canvas のピクセルがあり、400ms 後も Shift 部分が残り、1.3 秒後には 0。

## 見ていないもの
- WKWebView・WebView2・WebKitGTK のビルド済みアプリ／dev での手確認（特にネイティブ全画面での `cursor: none` と点の追従）はオーナー確認待ち。
- 日本語 IME が有効なときの L（key が `Process` になる可能性）は確かめていない。

## 検証
- pnpm lint / pnpm build / pnpm test（50 ファイル 634 件）すべて通過。Rust の変更なし。

## レビュー（PR #94、Claude Code CLI レビュアー、2 回）
- Codex の残量が 12%（下限 15%）だったため Claude Code CLI がレビュー。
- 1 回目: [P2] 1 件・[P3] 2 件。すべて b8f7296 で修正。
  - [P2] 2 本の Shift の線の間にある短い軌跡が消えると、生き残った点同士が直線でつながっていた → 点に連番 `seq` を持たせ、`lib/laser` の `trailSegments` が連続した点の間だけ線分を返す。指摘の手順を単体テストで再現。
  - [P3] 発表開始後にマウスを動かさず L を押すと、カーソルは消えるのに点が出なかった → 位置が未知ならウィンドウ中央に点を出す。
  - [P3] 開始時のヒントが `animationend` でしか消えなかった → タイマー（5.5 秒）でも消す。
- 2 回目: 全件解消として b8f7296 に APPROVE（ボット）。pnpm test は 50 ファイル 636 件で通過。
<!-- SECTION:NOTES:END -->
