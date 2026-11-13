---
id: TASK-52.1
title: >-
  Choose a deck's slide theme from mallow's and a slide theme folder, with a
  default-theme preference
status: Done
assignee: []
created_date: '2026-11-13 00:15'
updated_date: '2026-11-13 01:50'
labels:
  - feature
dependencies: []
references:
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
  - src/lib/deck.ts
  - src/lib/deck-css.ts
  - src/lib/custom-emoji.ts
  - src/lib/settings.ts
  - src/components/SettingsModal.tsx
parent_task_id: TASK-52
priority: medium
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds decision-19 §1–§6: the set of themes a deck can name, the default-theme preference, the slide theme folder and `@size`. Read decision-19 and decision-18 before starting; this task builds what they settle.

Today `lib/deck` builds one Marpit renderer per slide size with mallow's slide theme as the only theme and as `themeSet.default`, and records every theme name a deck asks for so the notice can name it. After this task the renderer's theme set holds mallow's slide theme (`default`) and every folder theme, `themeSet.default` follows the default-theme preference, and the name `kinari` is reserved for the copy TASK-52.2 bundles. Bundling kinari is not this task's: it waits for a release from the kinari repository.

What has to be built:
- **The default-theme preference** `defaultSlideTheme`, a store-backed preference that propagates through `saveSetting` and `settings:change` as the custom emoji folder does, and joins the `SettingChange` switch in `App`. Absent means mallow's slide theme. A stored name no longer held draws with mallow's slide theme and is shown as missing in Settings, not rewritten.
- **The slide theme folder** `slideThemeDir`, chosen in Settings with the folder dialog and granted with `allow_media_dir`. A theme is a `.css` file directly inside it carrying `@theme <name>`; `default` and `kinari` are reserved; two files claiming one name register neither. It is read when chosen, when a window starts, and each time a deck's Slides view is entered. Settings lists each registered name with its file and each skipped file with its reason.
- **The walk on a folder theme**: `walkDeckCss` over the theme's CSS before it is registered, with `url()` resolved against the theme file's own directory. What it removed is listed in Settings beside that theme, not in a deck's notice.
- **`@size`**: under a theme other than mallow's slide theme a deck's `size` takes the theme's `@size` entry of that name, and a theme with no entry draws at its own `section` size with the size reported. mallow's slide theme keeps its two generated sizes. The renderer cache, today keyed on size and the markdown config version, has to key on what the theme set now depends on as well.
- **The notice**: the theme entry is listed only for a name mallow does not hold, and `deckFeature.theme` says which theme was drawn instead, in ja and en.

**kinari's draft is the test theme**: `_sandbox/marp-theme/kinari.css`, copied into a slide theme folder under another `@theme` name (`kinari` is reserved), exercises the folder, the walk, `@size`, `light-dark()` under both modes and the default-theme preference with a real theme. It is not committed here.

To settle at the start and record in the notes: where the slide theme settings sit in the settings modal (a section of their own or beside the custom emoji folder), and how the pure parts — reading `@theme` and `@size` out of a file's text, the reserved and conflicting names, the fallback when the preference names nothing held — are split from the Tauri layer so they are unit-tested under Node, as `lib/custom-emoji` is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A deck naming default or a registered folder theme is drawn with it, in the Slides view and in a presentation
- [x] #2 A deck naming no theme or an unknown one is drawn with the default-theme preference; absent, that is mallow's slide theme; the notice lists an unknown name and says which theme was drawn
- [x] #3 The slide theme folder is chosen in Settings, registers the .css files carrying @theme directly inside it, refuses default and kinari, registers neither of two files claiming one name, and is re-read when Slides is entered
- [x] #4 Settings lists each registered folder theme with its file, each skipped file with its reason, what the walk removed from a theme, and a stored default-theme preference naming nothing held as missing
- [x] #5 A folder theme's CSS passes through walkDeckCss before it is registered, its url()s resolved against the theme file's directory and an asset: URL it wrote removed
- [x] #6 Under a theme other than mallow's slide theme a deck's size takes the theme's @size entry, and a size with no entry is reported
- [x] #7 kinari's draft, placed in the slide theme folder under another name, draws in both colour modes and serves size: 4:3 from its @size entry
- [x] #8 Both preferences reach every window, and every new label reaches the reader in ja and en
- [x] #9 pnpm lint, pnpm build and pnpm test pass; @theme and @size parsing, the name rules and the preference fallback are unit-tested
- [x] #10 AGENTS.md (en/ja) and README (en/ja) describe the slide theme folder and state that a folder theme's CSS is walked and contained as a deck's CSS is
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rust: add list_slide_theme_files(path) in commands.rs (regular .css files directly inside, sorted), registered in lib.rs, with a unit test. .css stays out of file_kind so the tree is unchanged.
2. lib/slide-themes (pure, Node-tested): read @theme / @size from a file's comments with Marpit's own meta regex; register a folder from {path, text}[] — walkDeckCss with url() resolved against the file's directory, reserved default / kinari, two claimants register neither, skipped files with their reason, what the walk removed per theme; resolve the default-theme preference (absent or not held → default, the stored name reported missing).
3. lib/deck: renderDeck takes the theme set (folder themes + default name); the renderer cache keys on the theme set and the markdown config version; a size variant appends the theme's @size entry as :root width/height; the theme notice lists only a name not held and carries the theme drawn; a size with no entry reports drawing at the theme's own size.
4. lib/slide-theme-folder (Tauri layer): a store of the folder, its load and the preference; apply / reload / choose functions, allow_media_dir on the folder, persistence via saveSetting in the commit, generation-guarded like the emoji folder.
5. Settings: defaultSlideTheme and slideThemeDir in Settings, the SettingChange switch in App, the mount-time read; a Slide themes section of its own after Custom emoji (settled 2026-11-13 with the owner).
6. DeckView: re-read the folder each time Slides is entered, render with the store's theme set, labels for the new notice wording in ja and en.
7. Tests, lint, build; manual check with kinari's draft under another name; AGENTS.md / README (en/ja).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと（2026-11-13、オーナー確認済み）

- 設定モーダルの置き場所: カスタム絵文字の後に独立した「スライドテーマ」セクションを置く。既定のテーマの選択欄、フォルダの選択 / 解除、登録したテーマ・使わなかったファイル・走査で除去したものの一覧をまとめた。
- 純粋部分と Tauri 層の分け方: `lib/slide-themes`（テーマ名・予約名・既定のテーマのフォールバック、型。軽い）、`lib/slide-theme-css`（`@theme` / `@size` の読み取り、フォルダのファイルの登録と `walkDeckCss`。postcss を使うので必要時に読み込む）、`lib/slide-theme-folder`（Tauri 層のストア）。`.css` は `read_dir_tree` の対象外なので、Rust に `list_slide_theme_files`（フォルダ直下の `.css` を名前順に返す）を足した。`file_kind` に css を足す案は、ツリーに表示ビューのないスタイルシートが並ぶため退けた。
- 当初は `slide-themes` 1 つにまとめていたが、ストアが静的に import すると postcss がエントリチャンクに入るため 2 つに分けた。ビルド後に `CssSyntaxError` を含むチャンクが `deck-css-*.js` だけであることを確認した。

## 実装の要点（diff から読めないもの）

- `@theme` / `@size` は Marpit 自身のメタ正規表現（`lib/postcss/meta.js`）で読む。Marpit が登録する名前と mallow が数える名前を一致させるため。`@size` の幅と高さは Marpit が px に換算できる絶対単位だけを受け付け、それ以外のエントリは捨てる（値が長さ以外を CSS に持ち込まないためでもある）。
- サイズの切り替えは、テーマの CSS の末尾に `:root { width; height }` を足した版を、サイズごとのレンダラーに登録する。`section` ではなく `:root` にしたのは、テーマ自身が `:root` にサイズを書いていても Marpit のサイズ検出とカスケードの両方で勝つため。出力 CSS で `:where(section):not([\20 root]) { width: 960px }` が `section { width: 1280px }` より後かつ詳細度が高いことを確認した。
- レンダラーのキャッシュは markdown の設定バージョンとテーマの組（オブジェクトの同一性）で切り替える。ストアはテーマの中身と既定名が変わらない限り同じオブジェクトを返すので、Slides に入るたびの読み直しで変更がなければデッキは再描画しない。既定名が組にない場合の補正も WeakMap で同一性を保つ。
- フォルダの読み込みは世代番号で直列化し、新しい選択だけが確定・保存する（カスタム絵文字と同じ）。Slides に入ったときの読み直しは、読み込み中ならそれを待つだけにした。読み直しが世代を進めると、直前のフォルダ選択の保存が取り消されるため。
- 起動直後、フォルダを読み終える前は、保存済みの既定のテーマを「見つかりません」と表示しない（まだ分からないだけなので）。

## AC の根拠

- #2: `deck.test.ts` の「the theme set」で、テーマ未指定 → 既定のテーマ、未知の名前 → 既定のテーマで描き通知に `{ name, drawn }`、組にない既定名 → mallow のテーマ、`kinari`（未同梱）は未知として通知、を確認。通知の文言は ja / en に `deckFeature.themeDrawn` を追加し、`deckFeature.size` を「テーマ本来のサイズで表示」に改めた。
- #5: `slide-theme-css.test.ts` で、`@font-face` / `@import` の除去、`url(img/grain.png)` がテーマのファイルのディレクトリ基準の asset: URL になること、テーマが書いた asset: URL の宣言の除去、`data:` の維持を確認。
- #6: `deck.test.ts` で、`@size 4:3` を持つテーマは viewBox が `0 0 960 720`、エントリのないテーマは自身の `section` のサイズ（800×800）で描き `{ kind: 'size' }` を通知、mallow のテーマは従来どおり 16:9 / 4:3、を確認。
- #7: `_sandbox/marp-theme/kinari.css` を `@theme kinari-draft` に変えて `_sandbox/task-52.1/themes/` に置き、`registerFolderThemes` → `renderDeck` を通した。除去なし（at-rule 0・asset: URL 0）、`@size` は 16:9 / 4:3 を読み取り、`theme: kinari-draft` + `size: 4:3` で viewBox `0 0 960 720`、テーマ未指定 + 既定のテーマ `kinari-draft` で kinari-draft に描画、`theme: kinari` は未知として kinari-draft で描いたと通知。出力を headless Chrome で `color-scheme: light` / `dark` の両方で撮り、両モードとも紙の地・見出し色・注記の箱が `light-dark()` の各側で描かれることを目視した（`_sandbox/task-52.1/shot-*.png`）。アプリ上ではなく headless Chrome での確認。
- #9: `pnpm lint`・`pnpm build`・`pnpm test`（52 ファイル 660 件）、`cargo fmt --check`・`cargo check`・`cargo test`（114 件）が通る。
- #10: AGENTS.md（en/ja）の lib 一覧・`commands.rs`・未信頼 Markdown の境界・`saveSetting` の段落・テスト一覧、README（en/ja）の Slides の項目・「Slide themes」節・Security・永続化の項目を更新した。

## 未確認（オーナーの実機確認待ち）

- #1・#3・#4・#8 は GUI での確認がまだ。描画と規則は単体テストで確かめたが、アプリ上での次の動作は見ていない: Slides 表示と発表でフォルダのテーマが描かれること、設定でのフォルダ選択と一覧（登録・スキップ理由・除去したもの・見つからない既定のテーマ）、テーマファイルを編集してから Slides に入り直すと反映されること、2 つのウィンドウで両方の設定が伝わること。

## オーナーの実機確認（2026-11-13、マージ後）

- #1・#3・#4・#8 をオーナーがアプリ上で確認した。kinari のリポジトリの `kinari.css`（`@theme kinari`）を置いたフォルダでは、予約名として外れ、設定にその理由が出ることも確かめた。kinari を `theme: kinari` でそのまま使うには TASK-52.2 の同梱が要る。
<!-- SECTION:NOTES:END -->
