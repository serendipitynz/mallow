---
id: TASK-40.3
title: >-
  Shared design: bring the explorer, its tree and the split handle to the shared
  spec
status: Done
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-28 09:18'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/Explorer.tsx
  - src/components/FileTree.tsx
  - src/components/RecentFolders.tsx
  - src/App.tsx
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. Every tree row is a button of its own, so the tree takes as many Tab stops as it has rows, and a failure to read children is told in text alone. The split handle between the explorer and the viewer changes width only by dragging (snz-design doc-13 §4 and §7.1). TASK-37 (hiding and showing the explorer) touches the same pane; whichever lands second follows the other's shape.

snz-design references: doc-9 §6.1.1 (tree), §6.3 (panel), §6.8 (navigation; the recent-folder list is its sidebar variant without a current location), §6.4 (failure level), §5.4 (empty); doc-5 §4.1 (WCAG 2.5.7, a single-pointer alternative to dragging); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The tree is one Tab stop: up and down move between rows, right and left open, close or move to the parent, Home and End reach the first and last rows, and closing a row moves focus from a descendant to that row (doc-9 §6.1.1)
- [x] #2 Selection, hover, loading, empty and failure in the tree follow doc-9 §6.1.1, and a failure to read children carries the failure-level icon (doc-9 §6.4)
- [x] #3 The empty window and the recent-folder list follow doc-9 §6.8 and §5.4
- [x] #4 The explorer's width can be changed without dragging: from the keyboard on the focused handle, and with a single-pointer alternative (doc-5 §4.1)
- [x] #5 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [x] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ツリーを Tab の止まり1つにする (doc-9 §6.1.1)。行を button から treeitem の div へ替え、tabindex は1行だけ 0。止まる行は最後に焦点があった行 → 無ければ選ばれている行 → 最初の行。子の group は aria-owns で親の treeitem に結ぶ。キーの判定 (↑↓・→←・Home/End・Enter) は純関数 lib/tree-nav に出して Vitest で押さえる。閉じた親の子孫に焦点があれば親の行へ移す。
2. ツリーの状態 (doc-9 §6.1.1・§6.1・doc-8 §5.2): 選択は面 + 枠 + 左端 3px の帯 (--snz-selected)・語は fg-strong。字下げ 1段 = --snz-icon-size-sm、開閉の図形は --snz-figure。子の読み込み中は処理中の図形 (lucide loader-circle、動きを減らす設定では遅く回す) + 語で1行の高さを保つ。空は fg-faint の語。子の取得の失敗とルートの失敗は §6.4 の失敗の段の告知 (lucide circle-x の図形 + 語、帯と面は danger / danger-soft) を子の域へ置き、前の中身は消さない。告知の部品 Notice は失敗の段だけで作り、残りの段は TASK-40.5 が足す。
3. エクスプローラの面を §6.3 のパネルの面 (--snz-surface) にする。Solarized Light では canvas の上の hover 面が 1.02:1 で見えないため。Dracula / Nord は今のサイドバーの値のまま (--color-panel を新設し、共通の2系統だけ surface へ対応付ける)。YAML の図形の直書きの紫 #8957e5 は暗い2配色で 3:1 を割るので --color-figure にする。
4. 空の窓と最近のフォルダ (doc-9 §6.8・§5.4): 空の語を fg-faint、行き先の hover で語と図形も差し替える (パスの語は hover 時に fg-muted。Solarized Dark の fg-faint/surface-hover が 4.42 で 4.5 を割るため)。
5. 分割つまみ (doc-5 §4.1): role=separator にフォーカスを持たせ aria-valuenow/min/max・aria-valuetext・aria-controls を置く。← → で 16px ずつ (Shift で 64px)、Home / End で最小 / 最大。保存はキーを離したとき。単一ポインタの代替は着手時にオーナーと決める。幅の計算は純関数にして Vitest で押さえる。
6. 文言は ja / en の両方へ。4配色の測定点の比・キーボードの到達・環境 (doc-5 §5.3) を Implementation Notes へ。WKWebView の実窓はオーナーの確認を記録する。

7. 単一ポインタの代替は「押して掴み、押して置く」(オーナー判断, 2026-09-28。doc-9 §6.9 の並べ替えと同じ形)。つまみを動かさずに押すと掴み、次の押下の位置を幅にする。つまみをもう一度押すか Escape で取り消す。掴んでいる間は本文の上に覆いを置き、置く押下が下の部品を押さないようにする。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (オーナー, 2026-09-28)
- 分割つまみの単一ポインタの代替 (AC#4) は「押して掴み、押して置く」。doc-9 §6.9 が並べ替えで 2.5.7 に定めた形と同じで、画面に部品を足さない。設定モーダルの幅の欄・右クリックのメニューは採らなかった。
- TASK-37 (エクスプローラの出し入れ) は同じ PR にしない。TASK-40 の「1子タスク1PR」と、TASK-37 に残る判断 (キーの組み合わせ・View メニュー) のため。37 はこの PR の形に揃える。

## 変えたこと (diff から読めない理由)
- ツリーの行を button から `div role=treeitem` にし、tabindex=0 は1行だけ。止まりは「最後に焦点があった行 → 選ばれている行 → 最初の行」(lib/tree-nav の tabStopPath)。更新で行が消えても止まりが無くならない。子の域は `aria-owns` で親の行に結んだ (子の aria-level だけではどの親の子かが伝わらない)。
- 矢印で動かすだけでは選ばない (doc-9 §6.1.1)。mallow では選ぶとビューアの中身が替わるため。
- 閉じた親の子孫に焦点があれば、閉じる前に親の行へ移す。ポインタで親を押すと押した行に焦点が移るので、実際に効くのはプログラムからの click やキー以外の経路。
- 失敗の告知の部品 Notice は失敗の段だけで作った (図形 lucide circle-x、帯・図形 danger、面 danger-soft、語 on-danger-soft、role=alert)。残る3段は TASK-40.5 が足す。処理中の図形 Busy (lucide loader-circle) は動きを減らす設定で止めずに 700ms → 2000ms へ遅くする (doc-8 §6.7)。
- 子の取得に失敗しても前に読めていた子は残す (doc-9 §5.5)。読み込み中・空・失敗は子の段の字下げ + 開閉の図形の分で、行の語の頭に揃う。1段の字下げは 14px → --snz-icon-size-sm (16px)。
- エクスプローラの面を canvas から §6.3 のパネルの面 (surface) にした。canvas の上では Solarized Light の hover の面が 1.02:1 で見えなかった (今は 1.16)。`--color-panel` を足し、共通の2系統だけ surface に対応付け、Dracula / Nord は今のサイドバーの値のまま。見出しの語は fg-strong。
- YAML の図形の直書きの紫 #8957e5 をやめて --color-figure にした。Standard Dark の選択行で 2.74、Solarized Dark の面で 2.82 と 3:1 を割っていた。種別は語 (拡張子) でも述べているので色だけに頼らない。
- 最近のフォルダのパスの語は hover の面の上で fg-muted に上げる。fg-faint のままだと Solarized Dark の hover の面で 4.42 と 4.5 を割る (doc-8 §5.3)。
- 分割つまみ: role=separator にフォーカスと aria-valuenow / min / max / valuetext / aria-controls を持たせた。← → は向きのとおりつまみを 16px (Shift で 64px) 動かす (右側のエクスプローラでは ← が広げる)。Home / End で最小 / 最大。保存はキーを離したとき (押しっぱなしの繰り返しごとに Rust と全窓へ送らない)。
- 掴んでいる間は幅を動かさず、置く位置の案内線だけを出す。最初は幅をポインタに追従させていたが、つまみが常にポインタの真下に来るため、置く押下が必ず「つまみの再押下 = 取り消し」になった (下の測定で見つけて直した)。覆い (z-index 20) は .doc__bar (5) より上に置き、置く押下が操作帯のボタンを押さない。
- Biome の抑制3か所は理由を行に書いた (`ul role=tree` / `role=group` は ARIA の tree パターン、フォーカスを持つ separator は `<hr>` にできない)。

## 確認 (2026-09-28)
環境 (doc-5 §5.3): mallow、ブランチ feat/task-40.3-explorer-tree-and-split-handle の 5432e39 (実装。1ab1851 は AGENTS の文書だけ)。共通仕様 snz-design main e0176f8・tokens 0.1.1。macOS 26.6.2 (25G83)。描画エンジンは Google Chrome 154.0.8037.57 のヘッドレス (Blink) — **WKWebView の実窓ではない**。Vite の開発サーバーに `__TAURI_INTERNALS__` の代役 (read_dir_tree を作業用ディレクトリの架空のフォルダへ、失敗・空・終わらない読み込みの3つを含む) を差し込み、DevTools プロトコルで実キー・実ポインタの入力を送った。ウィンドウ 1100×760、倍率 1 (撮影のみ 2)、Retina 2560×1664。入力はキーボードとポインタ。表示言語 en (撮影は ja)。4配色。
- AC#1 (キー): Tab の止まりは ツールバー3 → ツリー1 → つまみ → 設定 の6つで、ツリーは 9 行で止まり1つ (tabindex=0 は 1/9)。↓: docs→broken、Home→docs、End→app.toml、→ で docs が開き (aria-expanded true)、もう一度 → で最初の子 sub、→ で sub が開き、→ で c.md、← で親 sub、← で sub が閉じ、↑ で docs。Enter で a.md が選ばれ (aria-selected)、子の a.md に焦点がある状態で親 docs を click すると焦点は docs へ移り docs は閉じた。Tab で外へ出て Shift+Tab で戻ると最後の行へ。ファイルでの → は何もしない。:focus-visible はキー移動で出て (内側 2px)、ポインタの押下では出ない。
- AC#2 (状態): 失敗の子の域に role=alert の告知、図形の読み上げ名「Failure」、語は「Couldn't read this folder (Permission denied (os error 13)). Close it and open it again to retry.」。空は「(empty)」1行 24px、読み込み中は処理中の図形 + 語で1行 24px。選択は面 + 1px の枠 + 左端 3px の帯。画像: 作業用ディレクトリ harness/ の mallow-standard-light-explorer-tree.png・mallow-solarized-dark-explorer-tree.png・mallow-standard-light-explorer-focus.png (コミットしない)。
- AC#3 (空の窓): 「No folder is open.」(fg-faint) + フォルダを開く + 最近のフォルダの並び (行き先の語 + パス + 案内)。画像 mallow-standard-light-explorer-empty.png。
- AC#4 (つまみ): キーで 280→296→312、Shift+← で 248、Home 180、End 600、aria-valuenow と実幅が一致。押して掴む → ポインタを 420 へ → 案内線が 420px・幅は 180 のまま → 420 を押すと幅 420 で保存。700 へ動かすと案内線は上限の 600 で止まる。Escape で取り消し (幅 420 のまま)。掴んでつまみをもう一度押すと取り消し。60px のドラッグで 420→480。掴んでいる間、操作帯の位置の最上層は覆い。
- AC#5 のコントラスト (描かれた色から WCAG 2.x、Standard L / Standard D / Solarized L / Solarized D。すべて基準以上):
  - 行の語/面 14.42 / 11.44 / 12.05 / 10.61、hover 11.52 / 10.07 / 10.41 / 9.91、選択行の語/選択の面 14.52 / 11.66 / 11.98 / 11.53、見出しの語 17.98 / 13.62 / 13.92 / 12.05 (基準 4.5)
  - 選択の枠と帯/非選択の面 7.31 / 6.73 / 5.41 / 5.88、/選択の面 5.90 / 5.76 / 4.66 / 5.62 (基準 3)
  - 焦点の枠/面 7.31 / 6.73 / 5.41 / 5.88、/hover の面 5.84 / 5.93 / 4.67 / 5.49、/選択の面 5.90 / 5.76 / 4.66 / 5.62 (① ② 3:1。③ 2px の輪)
  - 開閉の図形/面 6.55 / 6.72 / 5.73 / 4.86、/選択の面 5.29 / 5.76 / 4.93 / 4.65。種別の図形/面: フォルダ・YAML 6.55 / 6.72 / 5.73 / 4.86、Markdown・JSON 7.52 / 6.63 / 5.41 / 5.88、mermaid 6.43 / 6.90 / 5.14 / 4.05、TOML 6.78 / 6.16 / 6.17 / 5.39、Markdown/選択の面 6.08 / 5.68 / 4.66 / 5.62、YAML/hover の面 5.24 / 5.92 / 4.95 / 4.54。処理中の図形 6.55 / 6.72 / 5.73 / 4.86 (基準 3)
  - 空・子の状態の語 (fg-faint)/面 5.64 / 5.92 / 5.43 / 4.73 (基準 4.5)
  - 失敗の告知: 語/告知の面 7.59 / 8.34 / 7.04 / 8.04 (4.5)、図形/告知の面 5.50 / 6.47 / 5.20 / 6.39 (3)、帯/外の面 6.78 / 6.16 / 6.17 / 5.39 (3)
  - 最近のフォルダ: 名 14.42 / 11.44 / 12.05 / 10.61、パス・題・案内 5.64 / 5.92 / 5.43 / 4.73、hover の名 11.52 / 10.07 / 10.41 / 9.91、hover のパス 5.24 / 5.92 / 4.95 / 4.54 (4.5)
  - つまみの hover・掴んだ線/エクスプローラの面・ビューアの面 4.05 / 3.83 / 4.13 / 3.26 (3)
- AC#6: pnpm lint (132 ファイル)・pnpm test (34 ファイル 428 件、うち新規 lib/tree-nav 13 件・lib/explorer-width 7 件)・pnpm build 通過。コミットの分け目 431a9ee の単体でも tsc と test が通ることを確かめた。

## 測っていないこと (オーナーの確認待ち)
- **WKWebView の実窓での見え方とキー操作** (AC#5 の後半)。上はすべて Blink。確かめてほしい点: Tab でツリーが1つの止まりになること、↑↓→← と Home / End、つまみの ← → と「押して掴み、押して置く」、失敗の告知・読み込み中の見え方、Solarized Light での行の hover が見えること。
- VoiceOver での読み上げ (aria-owns で子の域が親の子として読まれるか、つまみの値の読み上げ)。
- Dracula / Nord の比 (doc-7 §6.3 で対象外)。新しく足した --color-selected / danger-soft / on-danger-soft の値は目で選んだだけ。
- Windows (WebView2)・Linux (WebKitGTK) での見え方。

## レビューと実窓の確認 (2026-09-28)
- 外部レビュー (Codex CLI, gpt-6-astra) 1回目の [P2]: 一度読めたフォルダが更新で読み込みに失敗すると、子の一覧が残っているため開き直しても読み直さず、告知の「閉じて開き直すと読み込み直します」が成り立たなかった。26a6751 で、開くときは直前の読み込みが失敗していれば読み直すようにした (lib/tree-nav の readsOnOpen。前に読めていた子は再試行の間も残す)。テスト2件を足し、pnpm test は 430 件。2回目で指摘なし、bot が 26a6751 を APPROVE。
- AC#5 の実窓 (WKWebView) の確認: オーナーが実機で確認し OK (2026-09-28)。
- マージ: #67 (3b6c2c7)。
<!-- SECTION:NOTES:END -->
