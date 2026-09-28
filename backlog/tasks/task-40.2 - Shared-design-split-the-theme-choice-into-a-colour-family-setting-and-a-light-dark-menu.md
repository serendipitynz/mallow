---
id: TASK-40.2
title: >-
  Shared design: split the theme choice into a colour-family setting and a light
  / dark menu
status: Done
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-28 08:00'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/components/ThemePicker.tsx
  - src/components/OpenWith.tsx
  - src/components/Toolbar.tsx
  - src/components/SettingsModal.tsx
  - src/lib/theme.ts
  - index.html
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The toolbar's ThemePicker is a value menu over all seven theme ids, and OpenWith is an action menu; neither moves focus on open, closes on Escape, or returns focus to its trigger (snz-design doc-13 §4). snz-design decided that the colour family moves to the settings modal and the toolbar button opens a value menu of the light / dark mode: Light, Dark, and following the OS (doc-13 §10, the mallow row from TASK-25).

snz-design references: doc-9 §6.11 (menu, both the action and the value variant), §6.10 (select group), §5.1 and §5.2; doc-7 §4.2, §6.2 and §6.4 ③ (theme switching and reading stored values); doc-16 §6.2 (the startup script, which index.html and lib/theme.ts both carry).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The settings modal chooses the colour family, and the toolbar button opens a value menu of Light, Dark and following the OS
- [x] #2 In a family that has only one side (Dracula, Nord) the unavailable items are disabled and carry their reason, and the current value keeps its mark even when the stored mode points at a disabled item
- [x] #3 Stored settings from before the split open in the same scheme, and nothing stored is rewritten until the user chooses again (doc-7 §6.2)
- [x] #4 Both menus (OpenWith and the mode menu) move focus to the first item on open, move with the arrows and wrap at the ends, close on Escape with focus back on the trigger, close on Tab, and draw :focus-visible on their items (doc-9 §6.11)
- [x] #5 A choice made in one window reaches every other open window, checked with two windows
- [x] #6 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [x] #7 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 保存形式 (オーナー決定 2026-09-28): localStorage に colorFamily と colorMode の2つの新キーを置き、旧 theme キーには書かない。キーが無い軸は旧 theme を doc-7 §6.2 の読み替え規則で解く。選んだ軸のキーだけを書く (欠けた軸は旧 theme の読み替え = 画面に出ていた値に落ちるので、両方書く必要が無い)
2. 規則を純関数の lib/color-choice.ts に置く (読み替え、軸ごとの判定、描かれる組、系統が持つ側)。Node で単体テストする。index.html の起動スクリプトは同じ規則の写しを持ち、互いを指すコメントを書く
3. lib/theme.ts を2軸へ: 選択 (family, mode) を持ち、描かれる組を data-color-family / data-color-mode に置く。data-theme は書かない。Dracula / Nord の SCSS と印刷の上書きを data-color-family へ付け替える
4. 窓の間: SettingChange の theme を colorFamily と colorMode の2キーへ分け、軸ごとに順序を付ける (Rust はキーを読まないので変更不要)
5. メニューの振る舞いを hooks/useMenu.ts に1つにまとめ (開いたら焦点を移す、矢印で端で回る、Home/End、Escape でトリガーへ戻す、Tab で閉じて戻さない、外側の押下で閉じる、項目は tabIndex -1)、OpenWith と明暗のメニュー (ThemePicker を ModeMenu へ改名) の両方が使う。位置の計算は純関数にしてテストする
6. 明暗のメニュー: Light / Dark / 自動 (OS)。全項目に印域、今の値にチェック (menuitemradio + aria-checked)。片側だけの系統では持たない側を aria-disabled にし、理由の語をメニュー内に出して aria-describedby で結ぶ。無効な項目も焦点を受け、選んでも閉じない。今の値が無効な項目でも印を外さない
7. 設定モーダル: 先頭に配色の区画を置き、配色系統と明暗の2つの選択欄 (doc-9 §6.10 の選択欄の組)。明暗の選択肢が減るときは選べない印と理由の語。収録外の保存値は案内を出す (doc-7 §5.1)
8. OpenWith のトリガーの無効を aria-disabled + 理由にし、焦点から外さない (doc-8 §5.4、キーボードで全操作部品へ届かせるため)
9. AGENTS.md / AGENTS.ja.md のテーマの節を2軸の形へ直す
10. 検証: pnpm test / lint / build、保存値の各行を置いて開き直す、コントラスト (doc-5 §3.2) と環境 (doc-5 §5.3)、2窓の同期、実窓はオーナー確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (オーナー, 2026-09-28)
- 保存形式 (doc-7 §6.1 が mallow に任せた点): localStorage に `colorFamily` と `colorMode` の2つの新キーを置き、分割前の `theme` キーには書かない。自分のキーを持たない軸は `theme` を doc-7 §6.2 の読み替え規則で解く。旧版の mallow へ戻せば分割前の選択で開く。
- Dracula の Alucard や Nord の明るい版は入れない。対応するなら別タスク。

## 変えたこと (diff から読めない理由)
- 規則は純関数の `lib/color-choice.ts` に置き、`index.html` の起動スクリプトが写しを持つ (互いを指すコメント付き)。系統が持つ側は両方とも表1つなので、明るい版を足すときはその表と SCSS のパレットを足す。
- 選んだ軸のキーだけを書く: 欠けた軸は `theme` の読み替え = 描かれていた値に落ちるので、doc-16 §6.2 の「両方書く」は要らない。例外は収録外の保存値 (`bogus` や未来の系統名) で、このときは初期値で描かれるため、両軸を描かれている値で書き、窓へも両軸を配る (片方を残すと選んだ軸が効かない)。
- 軸ごとの判定を組の判定より先に置く (doc-7 §4.3)。持ち越した Dracula + 自動 (OS) は収録外にせず、Dracula の暗い側で描き、保存値は残す。
- `data-theme` はもう書かない。Dracula / Nord の SCSS と印刷の上書きを `data-color-family` へ付け替えた。読み手はすべて mallow 自身のもの (global.scss・print.scss・probe) で、同じ変更の中で移した。
- 窓の間は `colorFamily` / `colorMode` の2キーで運ぶ。1つの値にすると、別々の窓で近い時刻に選んだ配色と明暗の片方が順序付けで取り消される。Rust はキーを読まないので変更なし。
- メニューの振る舞いは `hooks/useMenu.ts` に1つ。項目は tabIndex -1 で、Tab の止まりはトリガーだけ。Tab で閉じるのはブラウザが焦点を動かした後 (setTimeout 0)。先に項目を消すと Tab の起点が無くなる。預ける焦点はトリガーそのもの (doc-9 §6.11)。
- 明暗メニューの無効な項目は `aria-disabled` で焦点を受け、理由の語をメニューの下に出して `aria-describedby` で結ぶ。押しても閉じない。今の値のチェックは無効な項目でも外さない。
- 設定モーダルは doc-9 §6.11・§7 に従い、配色系統と明暗の2つの選択欄 (§6.10 の選択欄の組)。native の `select` で、選べない明暗は `disabled` の option に「(選べません)」を添えて選択されたまま出す。収録外の保存値には案内の語 (doc-7 §5.1)。
- OpenWith のトリガーは、ファイル未選択の無効を `aria-disabled` と理由の語 (visually-hidden + title) にし、焦点から外さない (doc-8 §5.4。キーボードで全操作部品へ届かせるため)。
- メニューの外周の罫を操作部品の線に、影を `--snz-shadow-raised` に、チェックの色を `--snz-figure` (Dracula / Nord は muted と同じ値を `--color-figure` で持つ) にした (doc-9 §6.11 のトークン用途)。

## 確認
### 実窓 (オーナー確認, 2026-09-28)
- 環境: macOS 26.6.2 (25G83)、WKWebView (WebKit 21624.5.1.11.3)、`pnpm tauri dev`、対象リビジョン main d492363 + 本変更 (作業ツリー)、共通仕様の写し snz-tokens 0.1.1、Retina 2560×1664 と外部 2560×1440、物理キーボードとポインタ。
- オーナーが OK とした項目: 明暗メニューのキーボード操作 (開いて今の値へ焦点・矢印が端で回る・Escape でトリガーへ・Tab で閉じて次へ・焦点の枠)、設定モーダルの2つの選択欄の描画、Dracula での無効・理由・チェックの保持・無効な項目で閉じないこと、OpenWith のキーボード操作、2つの窓の間の反映 (AC#5)、分割前の保存値で同じ配色で開くこと (AC#3)。

### ブラウザ (Claude のブラウザペイン = Chromium、Vite 開発サーバー + Tauri IPC の代役、900×640、OS は明るい側、表示言語 en、2026-09-28)。実窓の値ではない
- AC#3: `theme` に 無し / auto / light / dark / solarized-light / solarized-dark / dracula / nord / bogus を置いて開き直し、属性は standard/light (無し・auto・light・bogus)、standard/dark、solarized/light、solarized/dark、dracula/dark、nord/dark。localStorage はすべて置いたまま。
- 自動 (OS) で Dracula を選ぶと、`colorFamily=dracula` だけが書かれ `colorMode=auto` が残り、描画は dracula/dark。設定の明暗欄は「Auto (OS) (unavailable)」を選択のまま出し、理由の語が出る。
- AC#4: 両メニューで Enter / ↓ で開き先頭 (明暗は今の値) へ焦点、↑ で末尾、↓↑ が端で回る、Home / End、Escape でトリガーへ戻る、Tab / Shift+Tab で閉じて焦点を引き戻さない、項目の選択で閉じてトリガーへ戻してから実行。ポインタで開くと枠は出ず、焦点の項目に hover の面。
- AC#5 の代役: タブ2つを BroadcastChannel で窓に見立て、w1 で明暗、w2 で配色系統を変え、相手側の属性と今の値の印が追った。
- キーボード到達: Tab でフォルダを開く → OpenWith (無効でも止まり、理由が読める) → 明暗メニュー → エクスプローラの順に届く。
- コントラスト比 (描かれた色から WCAG 2.x、Standard L / Standard D / Solarized L / Solarized D):
  - 項目の文字: 14.42 / 11.44 / 12.05 / 10.61。hover・焦点の面の上では 11.52 / 10.07 / 10.41 / 9.91
  - チェックと項目の図形: 6.55 / 6.72 / 5.73 / 4.86。hover の面の上では 5.24 / 5.92 / 4.95 / 4.54
  - 理由の語: 6.55 / 6.72 / 5.73 / 4.86
  - メニューの外周の罫 (本文の地・ツールバーに対して): 4.05 / 3.83 / 4.13 / 3.26
  - 項目の焦点の枠 (hover の面に対して): 5.84 / 5.93 / 4.67 / 5.49
  - 選択欄の文字: 14.42 / 11.44 / 12.05 / 10.61。hover では 11.52 / 10.07 / 10.41 / 9.91
  - 選択欄の輪郭: 4.05 / 3.83 / 4.13 / 3.26。矢印: 6.55 / 6.72 / 5.73 / 4.86
  - 選択欄の焦点の枠 (モーダルの面に対して): 7.31 / 6.73 / 5.41 / 5.88
  - 説明の語: 6.55 / 6.72 / 5.73 / 4.86
- 自動の検査: pnpm lint、pnpm test (32 ファイル 408 件。新規 `color-choice.test.ts`・`menu-nav.test.ts`)、pnpm build 通過。Rust は変更なし。

## 測っていないこと
- 上のコントラスト比の WKWebView での値 (実窓は目視の確認のみ)。Dracula / Nord の比 (doc-7 §6.3 で対象外)。
- 保存できないとき (doc-7 §5.3) と読めない保存先 (§5.2) を画面で伝えること。反映は続くが、伝える経路はまだ無い (doc-9 §7 の告知域)。
- WebView2 と WebKitGTK での `select` の描画とメニューの操作。
- 背後がスクロールしてトリガーが外れたら閉じる規則 (doc-9 §6.11): ツールバーはスクロールしないので該当しない。
- snz-design の mallow の適用記録は、まだ存在しない (TASK-40.1 で別セッションに回した分)。
<!-- SECTION:NOTES:END -->
