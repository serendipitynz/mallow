---
id: TASK-61
title: Sort and filter the explorer tree
status: In Review
assignee: []
created_date: '2026-11-13 23:05'
updated_date: '2026-11-16 10:35'
labels:
  - feature
dependencies: []
references:
  - src-tauri/src/commands.rs
  - src/hooks/useFileTree.ts
  - src/components/Explorer.tsx
priority: low
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The explorer lists a folder's entries in one fixed order — directories first, then files, each group case-insensitively by name (`read_dir_tree` in `commands.rs`) — and shows every entry of a supported kind. A folder with many documents offers no way to narrow it or to bring the latest edits to the top (requested 2026-11-14 while using v0.14.0).

What was asked for: **sorting** by name, by kind, by creation date and by modification date, and **filtering**.

To settle at the start:
- **What filtering means**: a text filter on names (matching inside collapsed folders or only in loaded ones — the tree is lazy, so a match in a folder never expanded is not known without reading it), a filter by kind (Markdown only, config only, …), or both.
- **Where sorting happens and what it needs**: the tree's entries carry no dates today, so creation and modification times have to come from `read_dir_tree`. Creation time is not available on every Linux filesystem (`Metadata::created` errors there), so its absence needs a defined place in the order.
- **Whether the choice is per window, per folder or app-wide**, and whether it is a preference that propagates (`settings.rs`) like the explorer's width and side.
- **Where the control sits** and how it reads from the keyboard: the explorer header has the folder name only, and a new control there follows snz-design (doc-9 for menus and segmented controls; check the adoption record for mallow first). Directories-first stays or becomes part of the choice.
- How the live watch (`fs:change`) and `useFileTree.refresh` keep the chosen order and filter when entries change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 What filtering means, where the sort and filter state lives and whether it propagates are settled and written in the task
- [ ] #2 The tree can be sorted by name, kind, creation date and modification date, with entries lacking a creation time placed by a stated rule
- [ ] #3 The tree can be filtered as settled, and the live watch keeps the order and the filter when entries change
- [ ] #4 The control follows snz-design and is fully usable from the keyboard
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の決定 (オーナー判断、2026-11-16):
- 絞り込みは名前だけ。種別の絞り込みは作らない。名前の部分一致 (NFKC と小文字で畳んで比べる) で、探すのは読み込み済みの範囲だけ。中身を読んでいないフォルダは「一致があり得る」として残す。名前が一致したフォルダはその中身を絞らずに出す。
- 並べ替えはアプリ全体の設定 (`explorerSort`、settings.json) で、`saveSetting` で全窓へ配る。絞り込みは窓ごとで保存せず、別のフォルダを開くと外れる。
- 並べ替えは 名前 (A→Z)・種別 (固定の種別順、同じ種別は名前順)・作成日 (新しい順)・更新日 (新しい順) の4つで、向きは固定。フォルダは常に先頭で、フォルダどうしは名前順。日時を持たない項目は、日時を持つ項目の後ろに名前順で置く。

手順:
1. Rust: `FileEntry` に `modified` / `created` (エポックからのミリ秒、取れなければ null) を足す。順序はフロントの1か所で決めるため、`read_dir_tree` の並べ替えを外す。
2. TS: 純関数のモジュールに並べ替えの比較・絞り込み・保存値の読み替えを置き、ツリーの見せ方 (根と子の並び) を1つ導く。単体テストを付ける。
3. Explorer: 見出しに並べ替えの値のメニュー (doc-9 §6.11、アイコンのみボタン)、その下に名札付きの1行入力の絞り込み (doc-8 §6.3、Escape で外さない、消す操作はボタン)。導いた見せ方を `visibleRows` と `FileTree` の両方に渡す。絞り込みの結果が空なら条件を述べて外す操作を置く (doc-9 §5.4)。
4. App: `explorerSort` の読み込み・受け取り・保存。live watch は描画時に並べ・絞るので refresh 後も保たれる。
5. i18n (ja/en)・アイコン・SCSS・AGENTS.md / AGENTS.ja.md。
6. pnpm lint / build / test、cargo fmt --check / check / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の決定 (オーナー判断、2026-11-16。AC #1):
- 絞り込みは名前だけ (種別の絞り込みは作らない)。名前の部分一致で、NFKC と小文字に畳んで比べる (全角と半角・大文字と小文字を区別しない)。探すのは読み込み済みの範囲だけ。
  - 中身を読んでいないフォルダは、一致があり得るので残す。
  - 読んだフォルダは、名前が一致したとき (中身を絞らずに出す)、中に残るものがあるとき、開いているときに残す。開いているフォルダを残すのは、絞り込み中に未読のフォルダを開くと読み込みが走り、一致が無ければフォルダがフォーカスごと消えるため。中身が絞り込みで空になったフォルダは「（空）」ではなく「（一致なし）」と述べる。
- 並べ替えはアプリ全体の設定 `explorerSort` (settings.json) で、`saveSetting` で全窓へ配る。絞り込みは窓ごとで保存しない。入力した値は開いているフォルダに結び付け、別のフォルダを開くと外れる。
- 並べ替えは 名前 (A→Z)・種別 (固定の種別順、同じ種別は名前順)・作成日 (新しい順)・更新日 (新しい順) の4つで、向きは固定。フォルダは常に先頭で、フォルダどうしはどの並び順でも名前順にする (フォルダの日時は自分の一覧が変わった時刻で、中のファイルを編集しても変わらないので、日時で並べても最新の編集が上に来ない)。日時を持たない項目は、日時を持つ項目の後ろに名前順で置く。

実装:
- Rust: `FileEntry` に `modified` / `created` (エポックからのミリ秒、取れなければ null) を足した。シンボリックリンクは辿った先の日時を取り、取れなければリンク自身の日時を取る。順序はフロントの `lib/tree-arrange` だけが決めるので、`read_dir_tree` の並べ替えを外した。名前順は旧実装と同じ比べ方 (小文字で比べ、同じなら元の名前で比べる) なので、既定の並びは変わらない。
- `lib/tree-arrange` (純関数): 比較・絞り込み・保存値の読み替え (`readTreeSort`。範囲外の値は名前順として読む)。`arrangeTree` が根と子の並びを1つ導き、Explorer はそれを `visibleRows` と `FileTree` の両方に渡す。矢印キーの移動と描画が同じ並びを見る。
- Explorer: 見出しの下にツール行を置いた。名札付きの1行入力 (doc-8 §6.3) と、並べ替えの値のメニュー (doc-9 §6.11、アイコンのみボタン)。トリガーの読み上げの語と title は「並べ替え: 更新日」のように今の値を含む。
  - Escape では絞り込みを外さない (doc-9 §6.1)。外す操作は入力欄の × と、結果が空のときの「絞り込みを外す」ボタン (doc-9 §5.4。掛かっている条件を述べる)。どちらで外しても焦点は入力欄へ移る。
  - IME の変換中は絞り込みを更新しない。
  - ポップアップは最小幅を 150px にした (エクスプローラは最小 180px で、はみ出しは切り取られるため)。
- live watch: 並べ替えと絞り込みは描画時に掛けるので、`refresh` が項目を差し替えても同じ並びと絞り込みになる。`useFileTree` は変えていない。

検証 (2026-11-16、macOS):
- biome ci は通過。info が 1 件出るが、biome.json の schema の版と CLI 2.6.6 の食い違いで、この task の前からある。
- tsc は通過。vite build も通過。
- vitest は 56 ファイル 703 件が通過した。そのうち tree-arrange は 17 件で、4つの並び順・作成日時が無い項目の位置・読んだ / 未読 / 開いているフォルダの絞り込み・全角の畳み込みを確かめる。
- cargo fmt --check・cargo check・cargo test (128 件) が通過した。Rust 側の新しいテストは、更新日時が返ることと、日時が取れないときに null になることを確かめる。
- `pnpm <script>` は使えなかった。ロックファイルの minimumReleaseAge の検査で止まるためで、2026-11-10 公開の @tauri-apps/plugin-opener 2.7.3・plugin-store 2.5.1・electron-to-chromium 1.5.479 が掛かる。この task とは関係ないので、`node_modules/.bin` の同じコマンドで代えた。

測っていないこと (オーナーの確認待ち):
- 実窓での見え方とキーボード操作 (AC #4)。ツール行の幅 (エクスプローラの最小幅 180px で、名札・入力欄・× ボタン・並べ替えボタンが収まるか)、値のメニューの開閉とフォーカス、Tab の順序 (入力欄 → × → 並べ替え → ツリー)。
- AC #2・#3 も実窓ではまだ見ていない。並べ替えの切り替え、2つの窓の間で並べ替えが反映されること、ファイルを足し消ししたときに並びと絞り込みが保たれること。
- Linux で作成日時が取れないファイルシステムでの並び。
- snz-design の適用記録 (doc-18) の更新はこの task の範囲外で、マージ後に行が要る。

オーナーの依頼による変更 (2026-11-16、PR レビュー後):
- 絞り込みの入力欄を常には出さないようにした。見出しのフォルダ名の右端に、絞り込みの出し入れのボタン (Lucide funnel) と並べ替えのボタンを置く。
- 出し入れは doc-9 §6.3.1 に従う。出ている間は押された面と輪郭で示し、`aria-expanded` と `aria-controls` を付ける。出すと入力欄に焦点を入れ、隠すと焦点をボタンへ戻す。
- 入力欄を隠しても絞り込みは残る。絞り込みが掛かっている間は、ファンネルをアクセント色で塗りつぶし、ボタンの語にも「「x」で絞り込み中」と述べる。塗りつぶしにするのは、状態を色だけで述べないため (1.4.1)。
- 虫眼鏡ではなくファンネルにしたのは、Cmd/Ctrl+F の文書内の検索がすでに「検索」の語を持ち、虫眼鏡がそれに見えるため。
- 見出しのボタンは 24px にし、見出しの余白に食い込ませて見出しの高さを保った。mallow はタッチを対象にしないので、押せる範囲の規則 (doc-8 §5.7) は適用外。
- 未計測: アクセント色の図形と選択の面の比、実窓での見え方。
<!-- SECTION:NOTES:END -->
