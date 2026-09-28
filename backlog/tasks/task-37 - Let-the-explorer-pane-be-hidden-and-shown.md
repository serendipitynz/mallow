---
id: TASK-37
title: Let the explorer pane be hidden and shown
status: Done
assignee: []
created_date: '2026-09-16 00:39'
updated_date: '2026-09-28 10:06'
labels:
  - feature
milestone: m-4
dependencies: []
priority: medium
type: feature
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The explorer pane cannot be hidden. On a wide document — the 9-column table that
raised TASK-34 and TASK-35 — it holds width the document could use, and a reader
who has chosen a file does not need the tree until they choose another.

`explorerWidth` and `explorerSide` are already settings (`lib/settings.ts`),
read and written through `saveSetting` and propagated to every window by
`commit_setting`. This is a third preference beside them, not a new mechanism.

**It is the other half of what makes a wide document readable**, so its effect is
measured against the same fixture as TASK-35 rather than on its own.

## What is not obvious

- **Hiding must not lose the width.** The reader's chosen `explorerWidth` has to
  survive the round trip, so "hidden" is its own state rather than a width of 0.
- **The empty state has to stay reachable.** With no folder open, the explorer is
  where `Open Folder` and the in-app Recent Folders list live. Hidden plus no
  folder must not be a dead end.
- **A chord has to be registered even where it does nothing.** `lib/print` and
  `lib/close-window` both record the same measured lesson: registering no
  handler does not make a chord inert, it concedes the chord to the platform.
- **A menu entry is a decision, not a line.** `menu.rs` composes per platform and
  has File, Edit, Window (macOS) and Help. There is no View menu, so adding one
  changes three compositions, and on Linux muda silently skips predefined kinds
  it does not support. Settle whether this gets an entry before building one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The explorer can be hidden and shown, and the document area takes the freed width — which is the other half of what makes a wide document readable, so it is measured against the same wide-table fixture as TASK-35
- [x] #2 The state is persisted through lib/settings and propagated to every window by commit_setting, like explorerWidth and explorerSide beside it — a preference is app-wide (TASK-12.8, TASK-33) and this is not the place to introduce a per-window one
- [x] #3 Hiding does not lose the width: showing it again restores the width the reader had set, rather than resetting to the default
- [x] #4 There is a keyboard chord, and it is registered app-wide through lib/chord like the others — registering nothing concedes a chord to the platform, which is measured (Ctrl+P on WebView2, Ctrl+W on WebView2)
- [x] #5 Whether it also gets a menu entry is settled explicitly: menu.rs has no View menu today, so adding one is a composition change on three platforms and a decision, not a line
- [x] #6 The empty state still has a way back: with no folder open and the explorer hidden, Open Folder and the in-app Recent Folders list must remain reachable
- [x] #7 Every new string is added to both the ja and en dictionaries in lib/i18n.tsx; pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の決定 (オーナー, 2026-09-28): キーは CmdOrCtrl+B (VSCode に倣う)。View メニューを3プラットフォームすべてに足す。ツールバーの左端 (フォルダを開くボタンの左) に lucide panel-left の出し入れのボタンを置く。
1. 設定 explorerShown (無し = 出ている) を lib/settings に足す。explorerWidth / explorerSide と同じく saveSetting → commit_setting で保存・全窓へ伝播し、App の settings:change の分岐と起動時の読み込みにも足す。幅とは別の状態なので、隠しても explorerWidth は変わらない。
2. 出し入れのトリガー (doc-9 §6.3.1): ツールバーの icon-btn。aria-expanded と aria-controls、出ている間は面 surface-selected と輪郭 selected。右側に置いているときは panel-right の図形。隠すとき焦点がエクスプローラの中にあればトリガーへ移す。出すとき焦点はトリガーに残す。動きは付けない (即時)。
3. キー: lib/explorer-toggle に chord handler (key b, 門なし) を置き App で登録。lib/chord の createChordHandler を通すので preventDefault まで試験できる。
4. メニュー: menu.rs に TOGGLE_EXPLORER と View サブメニュー (macOS は Edit と Window の間、他は Edit と Help の間)。項目は CmdOrCtrl+B のアクセラレータを持つ普通の項目「Toggle Explorer」で、押すと焦点のある窓へ menu:toggle-explorer を送る。チェック付きにしないのは、Rust が設定の値を知る必要が生じ、settings.rs が値を読まない作りが崩れるため。
5. 空の状態: トリガーは常にツールバーにあるので、隠していてもフォルダを開く (ツールバー) と最近のフォルダ (出せば空の窓に出る、ネイティブの Open Recent も残る) へ届く。
6. 検証: pnpm lint / test / build、cargo fmt --check / check / test。ヘッドレス Chrome で、横長の表 (_sandbox/samples/table-api-endpoints.md) のビューア幅・表の見える幅を出し入れの前後で測る。幅の保持、キー、トリガーの焦点、2タブを窓に見立てた伝播を確かめる。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (オーナー, 2026-09-28)
- キーは CmdOrCtrl+B (VSCode に倣う)。
- View メニューを3プラットフォームすべてに足す (AC#5 の判断)。
- ツールバーに lucide panel-left の出し入れのボタンを置く。作業中の追加の判断で、エクスプローラを右に置いたときはボタンもツールバーの右端 (明暗メニューの右) へ移し、図形を panel-right にした。ボタンを出し入れする区画の側に置き、どれを押せば何が出るかを位置で結ぶため。フォルダを開くボタンは左端のまま。

## 変えたこと (diff から読めない理由)
- 設定は explorerShown (無し = 出ている) を explorerWidth と別に持つ。幅 0 で隠す形にしないので、隠しても幅は失われない (AC#3)。saveSetting → commit_setting で保存・全窓へ伝播し、App の settings:change の分岐 (網羅性を型が検査する) と起動時の読み込みに足した。Rust の settings.rs は値を読まないので変更なし。
- 出し入れのトリガーは doc-9 §6.3.1 に従い区画の外 (ツールバー) に置き、aria-expanded と、出ている間だけ aria-controls を持つ。出ている間は面 selection-bg と輪郭 selected (色だけで述べない)。隠すとき焦点がエクスプローラの中にあればトリガーへ移し、出すとき焦点はトリガーに残す。動きは付けず即時 (動きを減らす設定を気にする必要が無い)。
- キーは lib/explorer-toggle の chord handler (門なし) で、App が1度だけ登録する。登録しないとプラットフォームに渡る規則 (lib/chord) に加え、描画した HTML の contenteditable ではエンジンが CmdOrCtrl+B を太字に割り当てている。
- メニューは View サブメニュー (macOS は Edit と Window の間、他は Edit と Help の間) に、アクセラレータ CmdOrCtrl+B の普通の項目「Toggle Explorer」を1つ。押すと焦点のある窓へ menu:toggle-explorer を送る。チェック付きにしなかったのは、チェックがどの窓からでも変わる設定を追う必要があり、値を読まずに中継する settings.rs の作りが崩れるため。状態はツールバーのボタンが述べる。
- 新しい UI の文言は無い (ボタンの読み上げ名は既存の「エクスプローラ」、状態は aria-expanded)。メニューの語は英語のみの方針どおり。

## 確認 (2026-09-28)
環境: mallow、ブランチ feat/task-37-hide-and-show-the-explorer の ede337b (実装。18b12b2 は文書だけ)。macOS 26.6.2。Google Chrome 154.0.8037.57 のヘッドレス (Blink) — WKWebView の実窓ではない。Vite の開発サーバーに `__TAURI_INTERNALS__` の代役を差し込み、DevTools プロトコルで実キー・実ポインタを送った。commit_setting の代役は BroadcastChannel で他のタブへ settings:change を中継し、2つのタブを2つの窓に見立てた。表示言語 en、標準 Light。
- AC#1 (横長の表 _sandbox/samples/table-api-endpoints.md、表の全幅 1428px): 窓 1400px でビューアの幅 1119 → 1400、窓 1800px で 1519 → 1800。どちらも .doc-scroll の横スクロールは出ない。**ただし表が一度に見せる幅は 848px のまま変わらない** — 本文の幅の上限 (848px) が決めており、それを外すのは TASK-35 の範囲。空いた幅はビューアが受け取るところまでで、表が広く見えるようになるのは TASK-35 の後。
- AC#2: 出し入れのたびに commit_setting へ {key: explorerShown} が送られた。2つのタブで、片方の CmdOrCtrl+B がもう片方の aria-expanded と表示に反映された (両方向)。
- AC#3: つまみで 280 → 360 にしてから隠して出すと 360。隠している間も explorerWidth は送られない (送られたのは explorerShown だけ)。
- AC#4: lib/explorer-toggle のテスト5件 (CmdOrCtrl+B で毎回切り替わり preventDefault、Windows / Linux の Ctrl+B、修飾なし・Shift・Alt 付きは素通し、macOS の Ctrl+B は素通し)。ヘッドレス Chrome で Cmd+B が隠す・出すを切り替え、ツリーに焦点がある状態で隠すと焦点はトリガーへ移った。Ctrl+B (mac) は何もしない。トリガーはクリック・Enter でも切り替わる。
- AC#5: View メニューを3つの構成に足した。cargo fmt --check・cargo check・cargo test (91 件、menu_action の対応と id が絶対パスに見えないことの試験に TOGGLE_EXPLORER を足した) 通過。手元でコンパイルされるのは macOS の分岐だけで、Linux は CI の ubuntu、Windows は paper の job が型検査する。
- AC#6: フォルダ未選択で隠すと、ツールバーに出し入れのボタンとフォルダを開くボタンが残る。出すと空の窓のフォルダを開くボタンと最近のフォルダ (2件) が戻る。
- AC#7: pnpm lint (134 ファイル)・pnpm test (35 ファイル 435 件)・pnpm build 通過。
- 出ている状態のボタンの比 (標準 L / 標準 D / Solarized L / Solarized D): 図形の色 fg/選択の面 11.65 / 9.79 / 10.38 / 10.15、輪郭 selected/ツールバーの面 7.31 / 6.73 / 5.41 / 5.88、焦点の枠/選択の面 5.90 / 5.76 / 4.66 / 5.62。
- 右に置いたとき: ツールバーの並びは フォルダを開く | Open | 明暗 | エクスプローラ (panel-right)、本文は viewer | つまみ | explorer。画像は作業用ディレクトリ harness/ の toolbar-left.png・toolbar-right.png (コミットしない)。

## 測っていないこと
- WKWebView の実窓: View メニューの見え方と、⌘B がメニューの key equivalent として1回だけ効くこと (macOS はメニューが先に取るので keydown の handler は発火しない想定)。
- Linux で、GTK のアクセラレータと keydown の handler が1回の押下で両方動かないこと。出し入れは2回動くと元に戻るので、二重なら「何も起きない」に見える。GTK は窓のアクセラレータを焦点の widget より先に処理して止めるので起きない想定だが、測っていない。
- Windows (WebView2): メニューのアクセラレータが届かないのは既知 (lib/close-window) で、keydown の handler が動く想定。

## レビューと実窓の確認 (2026-09-28)
- 外部レビュー (Codex CLI, gpt-6-astra) 1回目の2件を df2d688 で直した。
  - [P2] 左側のエクスプローラを隠すと Viewer が本文の3番目の子から1番目の子へ移り、React が作り直していた。ソース / プレビューの選択・スクロール位置・再生中の動画が失われる。隠している間はエクスプローラとつまみの枠を空で残し、Viewer の位置を保つ形にした。ヘッドレス Chrome で、出し入れの前後で Viewer の DOM 要素が同じまま (左右とも) で、スクロール位置 300px も残ることを確かめた。
  - [P3] つまみに焦点があるときと、他の窓からの変更で隠れるときに、焦点がトリガーへ移っていなかった。受け渡しを保存しない側の applyExplorerShown に移し、つまみも対象にした。受け取った窓は commit_setting を送らない。
  - 2回目で指摘なし、bot が df2d688 を APPROVE。
- 実窓 (WKWebView, `pnpm tauri dev`) の確認: オーナーが OK。確かめたのは、View メニューが出て ⌘B で1回だけ切り替わること、右側に置いたときにボタンがツールバーの右端へ移ること、ソース表示のまま出し入れしても表示が保たれること。
- マージ: #68 (5fb2cda)。Linux での二重の発火と Windows は引き続き未測定。
<!-- SECTION:NOTES:END -->
