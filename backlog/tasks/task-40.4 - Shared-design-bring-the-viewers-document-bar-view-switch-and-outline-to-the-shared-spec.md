---
id: TASK-40.4
title: >-
  Shared design: bring the viewer's document bar, view switch and outline to the
  shared spec
status: In Review
assignee: []
created_date: '2026-09-28 03:59'
updated_date: '2026-09-28 20:16'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/Viewer.tsx
  - src/components/Outline.tsx
  - src/components/MarkdownView.tsx
  - src/styles/markdown.scss
  - src/styles/source.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The switch between preview and source (and the other views) is a row of aria-pressed buttons in .seg, though it swaps what the same place shows, which is a tab list in the shared spec. The outline shows its current location with a line and colour but no surface, and its toggle sits in the sticky document bar outside the outline it removes (snz-design doc-13 §4 and §7.1). The document bar's behaviour from TASK-20 (heading jumps clear the bar) and TASK-22 (the bar never paints over the toolbar's menus) is kept.

snz-design references: doc-9 §6.7 (tabs), §6.8 (navigation, current location), §6.3.1 (showing and hiding a region); doc-8 §6.2 (icon-only button); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The view switches in the Markdown, config, table, XML and HTML views are read as tabs and move with the arrows inside the group (doc-9 §6.7)
- [x] #2 The outline's current location carries the surface as well as its band and aria-current (doc-9 §6.8)
- [x] #3 The outline toggle states whether the outline is shown, and focus has a defined destination when the outline goes away (doc-9 §6.3.1)
- [x] #4 The document bar's icon-only buttons follow doc-8 §6.2, heading jumps still clear the sticky bar, and the bar still never covers the toolbar's menus
- [ ] #5 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [x] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 表示切替をタブにする (doc-9 §6.7)。5ビュー (Markdown・設定・表・XML・HTML) の .seg + aria-pressed を共通部品 ViewTabs (role=tablist / tab、aria-selected・aria-controls) に替える。Tab の止まりは選ばれたタブ1つ (tabindex のロービング)、← → は端で止まり、Home / End で端へ。移すだけでは選ばない (Enter / Space / 押下で選ぶ)。キーの判定は純関数 lib/tab-nav に出して Vitest で押さえる。
2. 面 (tabpanel) を操作帯の下の中身を包む要素として置き、aria-labelledby で選ばれたタブに結び、tabindex=0 にする。ソース表示・表のように中に止まりが無い面へも Tab で入れ、キーボードで本文をスクロールできるようにするため。切替の無い状態 (構文エラー・描画を省いた HTML) では tabpanel にしない。
3. タブの見え方: 選ばれたタブは図形 fg-strong + 下端 4px の帯 (selected)、選ばれていないタブは図形 fg-muted で面なし、hover は surface-hover、組と面の境に line-control の罫。設定モーダルの .seg は触らない (TASK-40.6)。
4. アウトラインの現在地 (doc-9 §6.8): 面 surface-selected + 左端 3px の帯 selected + 語 fg-strong、aria-current=location。行き先の語は fg、hover は surface-hover。狭い幅でアウトラインが本文の上へ回ったときの面を surface (パネルの面) + line-control にする (surface-alt の上では Solarized Light の hover が見えないため)。
5. アウトラインの出し入れ (doc-9 §6.3.1): トリガーに aria-controls を足し、出ている間は面 surface-selected + 輪郭 selected (TASK-37 のエクスプローラのトリガーと同じ形)。アウトラインを DOM で本文より前に置き、読み順をトリガー → タブの組 → アウトライン → 本文にする (見た目の位置は grid のまま)。アウトラインが焦点を持ったまま消えるとき (別の窓からの切替・見出しが減った再読み込みを含む) は、焦点をトリガーへ、トリガーも消えるなら選ばれたタブへ移す。
6. 操作帯のアイコンのみボタン (doc-8 §6.2) を照らし、足りないものを直す。見出しへの移動が帯を避けること (TASK-20) と、帯がツールバーのメニューを覆わないこと (TASK-22) を確かめる。帯の下に隠れる焦点 (doc-5 §3.2 フォーカスの被り) も測る。
7. 文言は ja / en の両方へ。4配色の測定点の比・キーボードの到達・環境 (doc-5 §5.3) を Implementation Notes へ。WKWebView の実窓はオーナーの確認を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (2026-09-29)
- Shift+Tab で本文のリンクが操作帯の下に完全に隠れる不具合 (2.4.11 の未達。今回の変更前から) は、この PR で直す (オーナー判断)。帯の高さを見出しの scroll-margin-top からスクロール枠の scroll-padding-top へ移した。
- 表示切替のタブは図形だけのまま (語を足さない)。doc-8 §6.2 の形 (aria-label + title) で読み上げの語を持つ。語を足すと操作帯の幅が変わるため。

## 変えたこと (diff から読めない理由)
- 表示切替を共通部品 ViewTabs (role=tablist / tab) にした。Tab の止まりは選ばれたタブ1つ (tabindex のロービング)。← → は端で止まり、Home / End で端へ。移すだけでは選ばない (Enter / Space / 押下で選ぶ。doc-9 §6.7)。↑↓ は受けない (横並びの組なので、ページのスクロールに残す)。判定は純関数 lib/tab-nav。
- 面は ViewPanel (role=tabpanel、aria-labelledby で選ばれたタブ、tabindex=0)。中に止まりが無いソース表示・表へも Tab で入れ、そこからキーで本文をスクロールできる。切替が無い状態 (設定・XML の構文エラー、描画を省いた HTML) では tabpanel にしない。
- タブの見え方は下端 4px の帯 (selected) + 図形 fg-strong。未選択は面なしで図形 fg-muted。組と面の境の罫 (line-control) は、帯と図形で選択が読めるので装飾の区切り線として扱った (doc-5 §3.2)。設定モーダルと更新ダイアログの .seg は触っていない (TASK-40.6)。
- アウトラインの現在地は面 surface-selected + 左端 3px の帯 + 語 fg-strong、aria-current は true から location へ。行き先の語を fg-muted から fg へ、hover に surface-hover の面 (doc-9 §6.8)。見出し「目次」は fg-strong (§6.3 のパネルの見出し)。狭い幅で本文の上へ回ったときの面を surface-alt からパネルの面 (--color-panel) + line-control へ (surface-alt の上では Solarized Light の hover が見えない。今は 1.16)。
- トリガーは aria-controls を持ち、出ている間は面 surface-selected + 輪郭 selected (TASK-37 のエクスプローラのトリガーと同じ形)。出ているときも hover・押下で面が動く。
- アウトラインを DOM で本文より前に置いた。読み順はトリガー → タブの組 → (面) → アウトライン → 本文。見た目の位置は grid のまま。§6.3.1 の「トリガーと区画を読み順で隣り合わせに」は、間にタブの組が1つ挟まる。トリガーをタブの右へ移せば隣り合うが、ソース表示へ切り替えるとトリガーが消えてタブが押した指の下から横へ動くので採らなかった。
- アウトラインが焦点を持ったまま消えると、焦点をトリガーへ、トリガーも一緒に消えたら (見出しが減った再読み込み) 選ばれたタブへ移す (hooks/useOutlineFocusReturn)。Outline の layout effect の片付けで「焦点が中にあった」を記録し、移す先はビューの layout effect で決める。片付けの時点では、同じ commit でトリガーも消えるかがまだ分からないため。別の窓からの切替もこの1か所で覆う。
- 操作帯の面の不透明度を 72% → 88%。帯の下を真っ白な内容が通ると (暗い配色での HTML ビューの白い枠) 図形の比が Solarized Dark で 2.06 まで下がっていた。下が純白・純黒でも4配色の図形と選択の帯が 3:1 を保つ境は 85% (Solarized Dark 3.09、計算)。88% で最小 3.39 と余裕を持たせた。それまではタブが .btn の不透明な面に載っていたので、この PR でタブの面を外したことで顕在化した。
- 焦点の被り: .doc-scroll:has(.doc__bar) に scroll-padding-top: var(--doc-bar-height) を置き、見出しの scroll-margin-top は 1.5rem だけにした (.html-frame も同じ)。Outline の着地位置の読み戻しは padding + margin。見出しへの移動の着地位置は変更前と同じ (下の測定)。
- 操作帯のアイコンのみボタン (トリガー・全展開・全折り畳み) は TASK-40.1 の .icon-btn のままで doc-8 §6.2 を満たしていた (読み上げの語・30px 角・隣との間 8px・hover / 押下の面・外側の焦点の輪)。図形の色は fg-muted で、共通4配色では --snz-figure と同じ値。

## 確認 (2026-09-29)
環境 (doc-5 §5.3): mallow、ブランチ feat/task-40.4-viewer-bar-tabs-and-outline。共通仕様 snz-design main e0176f8・tokens 0.1.1。macOS 26.6.2 (25G83)。描画エンジンは Google Chrome 154.0.8037.57 のヘッドレス (Blink) — **WKWebView の実窓ではない**。Vite の開発サーバーに __TAURI_INTERNALS__ の代役 (作業用ディレクトリ。見出し 14 個の長い Markdown・見出し1つの Markdown・JSON・壊れた JSON・CSV・XML・見出し 9 個の HTML) を差し込み、DevTools プロトコルで実キー・実ポインタの入力を送った。ウィンドウ 1100×760 (狭い幅は 900)、倍率 1 (撮影のみ 2)。入力はキーボードとポインタ。表示言語 en。4配色 + Dracula・Nord の目視。
- AC#1: 5ビューとも role=tablist「View mode」+ role=tab 2つ、面は role=tabpanel で選ばれたタブに aria-labelledby。Markdown で: 選ばれたタブから → で Source へ焦点 (選択は Preview のまま)、もう一度 → で動かず、← / Home / End、→ + Enter で Source が選ばれ面がソース表示、tabindex は 0 が選ばれたタブだけ、Tab で面へ、面から PageDown と ↓ で scrollTop 62 → 659、Shift+Tab で選ばれたタブへ戻る、← + Space で Preview。設定・表・XML・HTML でも → + Enter で切替、Tab で面へ。壊れた JSON では tablist も tabpanel も無い。Tab の順 (Markdown): ツールバー4 → ツリー1 → つまみ → トリガー → タブ → 面 → アウトラインの行き先 → 本文のリンク。設定・XML は全展開 → 全折り畳み → タブ → 面 → ツリーの行。
- AC#2: 現在地に aria-current=location、面・帯・fg-strong の語。
- AC#3: トリガーは aria-expanded と aria-controls (=アウトラインの id、HTML でも一致)。焦点がアウトラインの行き先にある状態で別の窓から消す (settings:change を送る) → 焦点はトリガー (Markdown・HTML)。トリガーを Enter → 出て焦点はトリガーのまま、Tab でタブ → 面 → アウトラインの最初の行き先。見出し1つへの再読み込みでアウトラインとトリガーが消える → 焦点は選ばれたタブ。Enter で消す → 焦点はトリガーのまま。
- AC#4: 見出しへの移動の着地 (帯の下端 62px、動きを減らす設定): Markdown Section 2 / 4 / Detail 9 = 86.4 / 85.7 / 115.3 px、HTML Part 2 / 5 / 7 = 85.7 / 86.1 / 85.8 px、現在地も同じ。変更前と変更後で全く同じ値 (Detail 9 は文書の末尾で下へスクロールしきれない位置、変更前から)。ツールバーの明暗のメニューと「開く」のメニューを本文をスクロールした状態で開き、帯と重なる範囲 100 点すべての最上層がメニュー。焦点の被り: 本文の最後のリンクから Shift+Tab 25 回で帯の下に完全に隠れたリンクは変更前 4 件 → 変更後 0 件 (帯の縁に接する1件のみ)。前向きの Tab 25 回は変更前後とも 0 件。
- AC#5 のコントラスト (描かれた色から WCAG 2.x、Standard L / Standard D / Solarized L / Solarized D。すべて基準以上):
  - 選ばれたタブの図形/帯の面 17.98 / 13.62 / 13.92 / 12.05、未選択の図形 6.55 / 6.72 / 5.73 / 4.86、hover の図形/hover の面 11.52 / 10.07 / 10.41 / 9.91 (3)
  - 選択の帯/帯の面 (非選択の同じ箇所) 7.31 / 6.73 / 5.41 / 5.88 (3)。組の罫 (装飾) 4.05 / 3.83 / 4.13 / 3.26
  - 帯の下が純黒 / 純白のとき: 未選択の図形 4.98 / 7.15 / 4.36 / 5.29・6.55 / 4.60 / 5.78 / 3.39、選択の帯 5.56 / 7.16 / 4.12 / 6.40・7.31 / 4.61 / 5.46 / 4.10、選ばれたタブの図形 13.67〜8.41 (3)。HTML の白い枠を帯の下へスクロールした実測も白の行と同じ値
  - トリガー (出ている): 図形/面 11.65 / 9.79 / 10.38 / 10.15、輪郭/帯の面 7.31 / 6.73 / 5.41 / 5.88、hover の図形 11.52 / 10.07 / 10.41 / 9.91。消えているとき・全展開の図形/帯の面 6.55 / 6.72 / 5.73 / 4.86 (3)
  - アウトライン: 行き先の語/地 14.42 / 11.44 / 12.05 / 10.61、見出しの語 17.98 / 13.62 / 13.92 / 12.05、現在地の語/現在地の面 14.52 / 11.66 / 11.98 / 11.53、hover の語/hover の面 11.52 / 10.07 / 10.41 / 9.91 (4.5)。現在地の帯/地 7.31 / 6.73 / 5.41 / 5.88、/現在地の面 5.90 / 5.76 / 4.66 / 5.62 (3)。狭い幅: 外周の罫/地 4.05 / 3.83 / 4.13 / 3.26、帯/パネルの面 7.31 / 6.73 / 5.41 / 5.88、hover の面/パネルの面 1.25 / 1.14 / 1.16 / 1.07
  - 焦点の枠/帯の面・本文の地 7.31 / 6.73 / 5.41 / 5.88、/現在地の面 5.90 / 5.76 / 4.66 / 5.62、/hover の面 5.84 / 5.93 / 4.67 / 5.49 (① ② 3:1。③ 2px の輪)
  - 画像: 作業用ディレクトリ harness/ の mallow-{standard,solarized}-{light,dark}-viewer-bar.png (未選択のタブに焦点)・mallow-solarized-dark-html-under-bar.png・mallow-solarized-light-narrow-outline.png・mallow-{dracula,nord}-viewer-bar.png・menu-Light-or-dark.png (コミットしない)。
- AC#6: pnpm lint (138 ファイル)・pnpm test (36 ファイル 440 件、うち新規 lib/tab-nav 5 件)・pnpm build 通過。

## 測っていないこと (オーナーの確認待ち)
- **WKWebView の実窓での見え方とキー操作** (AC#5 の後半)。上はすべて Blink。確かめてほしい点: 5ビューの表示切替が ← → で動き Enter / Space で選べること、Tab でタブ → 面 → 中身と進むこと、面に焦点を置いて ↓ / PageDown で本文がスクロールすること、アウトラインの現在地の面と帯、トリガーの出ている見え方、Shift+Tab で本文のリンクが帯の下に隠れないこと、アウトライン (Markdown・HTML) から見出しへ移動したとき帯の下に隠れないこと、ツールバーのメニューが帯に覆われないこと (TASK-22 の再現手順: メニューを開いたまま窓を広げてスクロールを無くす)。
- VoiceOver での読み上げ (タブの「選択」の読み上げ、aria-current=location、トリガーの展開の読み上げ)。
- Dracula / Nord の比 (doc-7 §6.3 で対象外。目視のみ)。
- Windows (WebView2)・Linux (WebKitGTK) での見え方と、:has() の対応 (WebKitGTK 2.42 以降が必要)。
- ソース表示では面 (tabindex=0) と Shiki の pre (Shiki が付ける tabindex=0) で Tab の止まりが2つ続く。pre は横スクロールの止まりなので残した。
<!-- SECTION:NOTES:END -->
