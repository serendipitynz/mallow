# AGENTS.ja.md

> English: [AGENTS.md](AGENTS.md)

このリポジトリで作業するエージェント／コントリビュータ向けのガイドです。**mallow** は
独立した軽量デスクトップ Markdown / 設定ファイルビューワです。利用者向けの概要は
[README.ja.md](README.ja.md) を参照してください。

## コマンド

```sh
pnpm install
pnpm tauri dev      # ホットリロード付きで起動
pnpm build          # フロントの型チェック(tsc) + バンドル(vite)。FE 変更の検証用
pnpm test           # フロントのユニットテスト(Vitest, 単発実行)。watch は pnpm test:watch
pnpm lint           # Biome の lint + フォーマット + import 順の検査（書き換えなし）
pnpm lint:fix       # Biome の安全な修正を適用し、import を並べ替え、整形する
pnpm format         # 整形のみ
pnpm lint:ci        # CI が走らせるもの (biome ci)。書き換えず、error で落ちる
pnpm tauri build    # リリースビルド + バンドル
./scripts/macos-sign-build.sh   # 署名 + 公証済みの macOS ビルド（.env.signing が必要）
pnpm tauri icon src-tauri/icons/app-icon.png   # 全アプリアイコンの再生成
pnpm notices        # THIRD-PARTY-NOTICES.md を再生成（同梱する依存ライセンス）
pnpm release 0.4.0  # 全箇所のバージョン更新 + コミット + タグ（--push で push まで）
cargo check         # src-tauri/ 内で実行し Rust を検証
cargo test          # src-tauri/ 内で実行し Rust のユニットテストを走らせる
cargo fmt           # src-tauri/ 内で実行し Rust を整形（--check で検査のみ）
```

## スタック

Tauri v2 (Rust) + Vite + React + TypeScript + SCSS。**Tailwind は不使用。**

## アーキテクチャ

**フロントエンド (`src/`)**
- `App.tsx` — 最上位の状態: フォルダを開く、選択、ファイル監視の配線、エクスプローラの
  幅/左右、mount 時に開く処理、設定モーダルの開閉（フッターのボタン・`menu:settings`
  イベント・`Cmd/Ctrl+,` ショートカットのいずれからも開く）、起動時の更新確認
  （その処理の後ろへ遅らせる。`autoCheckUpdates` 設定で切れる）。
  フォルダに辿り着く 2 経路 — フォルダ選択と、作られた／復元されたウィンドウが
  受け取る initial location — は `openLocation` という 1 つの手順を通る。
  mount 時の効果は `take_window_init` へ initial location を要求し、
  保存されたフォルダはもうどこからも読まない。表示中のフォルダと選択を見る効果 1 つが
  restored session への報告で、**呼び出し箇所ではなく述語**として書いてある。
- `hooks/useFileTree.ts` — ファイルツリーの集中管理（展開集合・子マップ・`refresh`・
  `expandPaths`）。ツリーコンポーネントはこれに制御される。
- `hooks/useUpdater.ts` — 更新確認・導入の同意・再起動（tauri-plugin-updater +
  tauri-plugin-process）。更新確認から導入の同意までの間 `Update` ハンドルを保持する。
- `hooks/useWindowEvent.ts` — **このウィンドウだけ**でイベントを購読する。
  ウィンドウごとに配るすべての emit のフロント側の半分（メニューのものと、
  `fs:change` で `lib/watch` が確立した対）。
- `components/` — Explorer/FileTree、Viewer（種別でルーティング）、MarkdownView、
  ConfigView/ConfigTree、SourceView（共通・行番号付き）、TableView（csv/tsv）、
  XmlView/XmlTree（xml/plist/xsd/xsl）、HtmlView（sandbox 付き srcdoc フレーム +
  ソース切替）、ErrorBanner（構文エラー表示の共通部品）、MermaidView、
  MediaView（画像/PDF/動画を asset protocol 経由で表示）、Outline、Toolbar、
  OpenWith、ThemePicker、SettingsModal、UpdateDialog（入る版・同意・進行状況）、
  icons（Lucide の SVG をインライン化・ランタイム依存なし）。
- `lib/` — `markdown`（markdown-it パイプライン）、`shiki`（ハイライタ singleton +
  `stripPreBackground`）、`mermaid` + `mermaid-copy` + `codeblock`（命令的 DOM 強化）、
  `frontmatter`、`config-parse`、`source-cap`（ソースビューの上限）、
  `delimited`（CSV/TSV パーサ + 表ビューの上限）、
  `xml-tree`（XML DOM → 上限付きツリーモデル + parsererror 文言の解析）、
  `html-doc`（HTML の markup 変換 + 描画上限）、
  `html-headings`（フレーム内の見出しへの id 付与）、
  `html-notice`（描画した文書が通知バーのどの行を持つか）、
  `clip`（値の切り詰め・共通）、
  `custom-emoji`（ユーザーの絵文字フォルダ →
  ショートコード表）、`heading`（`Heading` 型・注入する lookup root・純関数の座標変換）、
  `scroll`（スクロール位置保持）、`watch`、
  `settings`（plugin-store）、`settings-sync`（変わった設定 1 件が全ウィンドウへ届く道）、
  `outline-pref`（アウトラインの開閉。全ウィンドウで 1 つ）、
  `theme`、`i18n`（ja/en 辞書 + provider/hooks。言語は
  localStorage に永続化）、`update-flow`（更新確認と導入の状態・ダウンロード量の
  積算）、`chord`（アクセラレータの一致判定と、アプリ全体の chord handler・その 3 値）、
  `markdown-preview`（`Print…` と `Export as PDF…` が共有する唯一のゲートと、
  それを 2 つのメニュー項目へ押し出す購読）、
  `close-window`（`CmdOrCtrl+W`。macOS 以外ではウィンドウを閉じる**唯一の**経路。
  下の gotcha を見る）、
  `print` / `pdf-export` / `new-window` / `close-window`（各入口のキー・ゲート・理由。
  後ろ 2 つは閉じるゲートを持たない）、
  `build-flags`（Vite が置き換える無人書き出しのスイッチ）、
  `render-signal`（描画済みの本文が変化し終わった時点）、
  `file`、`path`、`tauri`（invoke ラッパ）、`types`。
- `unattended/` — 無人書き出しのドライバ（TASK-30）。`App` の `if (UNATTENDED)` からしか
  到達せず、通常のバンドルには入らない。
- `styles/` — SCSS: `_vars`（パレット + `on-dark` mixin）、`global`、`app`、
  `markdown`、`config`、`source`、`html`、`table`、`xml`。

**バックエンド (`src-tauri/src/`)**
- `commands.rs` — `read_dir_tree` / `read_file` / `path_exists` / `allow_media_dir`
  を素の `std::fs` で実装（fs プラグインは使わない）。ユーザーが選んだ任意フォルダを
  スコープ設定なしで扱える。`allow_media_dir` は開いたフォルダに asset protocol の
  スコープを広げ、その中の画像/PDF/動画を `convertFileSrc` で表示できるようにする。
- `watch.rs` — `notify` の再帰ウォッチャで、ウィンドウごとに 1 つ持つ。
  watcher registry（`WatcherRegistry`。ウィンドウラベルをキーにする）がハンドルを保持し、
  `start_watch` は呼び出したウィンドウの分だけを差し替え、`stop_watch` はその分だけを外す。
  閉じたウィンドウの分は `lib.rs` のアプリ全体の `WindowEvent::Destroyed` フックが
  （受け取られなかった initial location と一緒に）落とすので、
  設定ファイルのウィンドウと実行時に作ったウィンドウが同じ経路を通る。`fs:change` の emit は
  `emit_to` で行う — **それだけでは何も分離しない**ので、下の gotcha を読む。
- `window.rs` — `open_window` / `take_window_init` と、その 2 つが location を
  受け渡す `WindowInitRegistry`。`open_window(location, label)` は設定ファイルの
  ウィンドウの `WindowConfig` を clone してラベルだけ上書きしてウィンドウを作るので、
  作られたウィンドウは設定のサイズ・最小サイズ・タイトルを手で写すことなく持つ。
  `label` は TASK-12.7 の復元経路だけが渡す。その経路には呼び出し元のウィンドウが
  無いので、素の関数 `create_window` を呼ぶ。スロットの再利用・1 回だけの受け渡し・
  ずらし規則は下の gotcha にある。
- `recent.rs` — `record_recent` / `list_recent` / `clear_recent`。settings.json の
  `recentFolders`（新しい順・上限 10・フォルダのパスのみ）を tauri-plugin-store の
  Rust API 経由で所有する。**Rust が持つのは、記録が read-modify-write だから** —
  JS 側では読み・差し替え・書き戻しが間にロックの無い 3 手になるので、2 つの
  ウィンドウが同時に記録するとエントリが落ちる。加えて、これを読むサブメニューは
  どのみち Rust で作る（TASK-12.4）。`RecentLock` がそのロックで、store は `get` と
  `set` のそれぞれをロックするが、その間の判断はロックしない。`with_recorded` が
  並び替え・重複排除・上限の純関数、`folders_from` が保存値を読む純関数で、
  どちらも app handle 無しで単体テストされている。**同じフォルダの 2 通りの綴りは
  2 エントリになる** — 比較はダイアログが返した文字列そのままで、
  大文字小文字を区別しないのは OS ではなくボリュームの性質だから。
  **存在しなくなったフォルダの除去はサブメニュー構築時にだけ行う** —
  ファイルシステムに触る検査なので、一覧が表示される直前に走る。`pruned_folders` が
  その唯一の場所で、`existing_folders` がその純粋な規則。`list_recent` は除去しない。
  **`record_recent` はサブメニューを更新する前に `RecentLock` を解放する** —
  体裁ではなく、メニューの変更はどれもメインスレッドを待つのに対し、
  `Clear Recent` はそのメインスレッドで同じロックを取るからである。
- `menu.rs` — ネイティブメニューと、そのイベントの配送先の解決。
  **`cfg` で隠すのではなくプラットフォームごとに組む。** `menu_action` が
  id → 動作の純粋な対応、`recent_label` が最近のフォルダの表示文字列の純関数、
  `focused_window` がすべてのメニューイベントが配送先を決める
  `webview_windows()` の走査、`MenuState` がメニュー構築後に変わるもの
  （Open Recent サブメニュー・`Clear Recent`・アクティブビューでゲートされる 2 項目）。
  **ゲートはウィンドウごと**（`report_markdown_preview`）で、メニューはそうではない。
  3 環境で何がどう違い、なぜそうなのかは下の gotcha にある。
- `session.rs` — restored session。settings.json の `windows` キーで、quit 時に
  開いていたウィンドウ 1 つにつき 1 エントリ（`{ label, folder, files, active }`）を
  **最後にフォーカスされたものが末尾**の順で持つ。`report_window_content` が
  「表示中のフォルダか選択が変わったとき」にウィンドウが呼ぶコマンド、
  `note_window_created` / `note_window_focused` / `note_window_destroyed` が
  アプリ全体のフック、`flush_at_exit` が `RunEvent::Exit` で走る。
  **Rust が持つ理由は `recentFolders` と同じ** — 複数ウィンドウが 1 つの配列を
  read-modify-write するとエントリが落ちる — そのうえここでは 1 つの mutex が
  ライブ集合と store への書き込みの両方を覆う。`open_restored_windows` が
  保存順に 1 エントリ 1 ウィンドウを作り、`init()` はプラグインで、store と
  window-state の間という登録位置が load-bearing である（下の gotcha）。
  純関数群は app handle 無しで単体テストされている。
- `settings.rs` — `broadcast_setting`。あるウィンドウで変わった設定 1 件を
  全ウィンドウへ運ぶ中継。**設定値は持たない** — settings.json のキーを所有するのは
  `recent.rs` と `session.rs` — 運ぶ変更は不透明な JSON なので、設定の一覧が
  ここに二度書かれることはない。ここだけブロードキャストが正しい理由と、
  発信元を外すのが emit ではなく label である理由は下の gotcha にある。
- `editors.rs` — `detect_editors` / `open_in_editor` / `reveal_in_os` /
  `open_in_default_app` を `std::process` で実装（OS ごとに `cfg` で分岐）。
  最後のものはファイルをその種別に登録された OS のハンドラへ渡す。
  tauri-plugin-opener ではなくここにあるのは、あのプラグインのパススコープを満たすには
  `allow_media_dir` の隣に 2 つ目の実行時スコープ機構が要るため（decision-3）。
  **Windows では `rundll32 url.dll,FileProtocolHandler` を使う。思いつく 2 つの綴りは
  どちらもパスの扱いを誤る** — `explorer <file>` はコンマで分割し（実測: `a,b.html` で
  ハンドラではなく Explorer のウィンドウが開いた）、`cmd /C start` は `Command` が
  quote する規則ではなく `cmd` 自身の規則で読み直す。
- `print.rs` — `print_window`。呼び出し元の webview ウィンドウを
  `WebviewWindow::print()` へ渡す（decision-13）。**ただし Linux では呼ばずに拒否する** —
  2026-09-07 実測: GTK のダイアログが開いたまま返らない。コンポジタが「応答なし」と判断し、
  Wait は効かず、ダイアログ自身の Cancel も押せず、Force Quit しか出口が無い。
  実プリンタを設定した状態でも `--debug --no-bundle` のビルドでも再現した。
  ガードが実行時のプラットフォーム判定ではなく `cfg` なのは、**fail open してはならない**ため。
  Linux の分岐は macOS / Windows ではコンパイルされないので、**そこでの `cargo check` は
  この分岐について何も言わない。****文書ではなくウィンドウで命名している** —
  エンジンがページ割りするのは `<body>` 全体なので、文書を約束する名前は最も肝心な境界で
  偽になり、印刷用スタイルが入っても真にはならない。`print()` 自体は `cfg(desktop)` だが
  こちらは括らない。括るとモバイルビルドが実行時の「コマンドが無い」になり、
  括らなければコンパイルが落ちる。
- `pdf.rs` — `write_window_pdf`。呼び出し元ウィンドウの PDF を、各環境の印刷
  **パイプライン**を通して書く。**印刷 UI は一切出さない**（decision-14）。macOS は
  `NSPrintSaveJob` を設定した `NSPrintOperation`、Windows は WebView2 の `PrintToPdf`、
  Linux は WebKitGTK の `print()`（`run_dialog()` ではない）。**印刷が完走するのは
  3 環境のうち 1 つだけ**だから存在する機能で、印刷を置き換えるのではなく並存する入口である
  — **Linux ではこれが紙への唯一の道**になる。`print_window` と同じ理由でウィンドウで命名した。
  3 つの分岐が共通に抱える確認事項は **`@media print` が当たるか**で（下の落とし穴を見る）、
  それが macOS で `WKWebView.createPDF` を採らない理由でもある。
- `lib.rs` — プラグイン登録（opener, dialog, store, **session**, window-state,
  updater, process。decision-11 によりどれも `cfg(desktop)` で括らない。
  session の位置は load-bearing —下の gotcha を読む）、`invoke_handler`、
  ウィンドウごとの `Destroyed` / `Focused(true)` フック、restored session を
  flush する `RunEvent::Exit` コールバック、id を `menu.rs` に渡すだけの 1 行に
  なった `on_menu_event`、そしてメニューを組んでから**すべての**ウィンドウを作る
  `setup`（設定ファイルのウィンドウは `"create": false` を持つ）。
  **メニューはどのウィンドウよりも先に組む** — 後から作られたウィンドウは生成時に
  アプリ全体のメニューを取り、Windows と Linux ではメニューバーがウィンドウのもの
  だから。**無人ビルドはメニューを組まない** — session を登録しないのと同じ理由である。

## 規約

- SCSS のみ。Tailwind は決して導入しない。
- `src-tauri/target` はコミットしない（ビルド成果物・git 無視済み）。
- mallow は独立プロジェクトとして扱う。コード/コメント/ドキュメントに外部プロジェクトを
  「由来」として記述しない。
- production 依存の追加前に確認する。
- 第三者ライセンス通知（`THIRD-PARTY-NOTICES.md`）は `pnpm notices`
  （`scripts/gen-third-party-notices.mjs`）で生成し、`bundle.resources` でアプリに
  同梱する。依存を変更したら再生成する。

### lint とフォーマット

**lint / フォーマットの依存は Biome だけで、今後もそうする。** devDependency 1 件
（ルートの `biome.json`）で TypeScript・TSX・JSON の lint・整形・import 順をまとめて見る。
Prettier や ESLint を併置しない。Rust は `rustfmt.toml` に基づく `cargo fmt` が担当し、
rustfmt はツールチェーン同梱なので依存は増えない。

設定は Biome の既定（タブ・ダブルクォートを前提とする）ではなく、**既にあるコードに
合わせて選んである**: `indentStyle: space`・`indentWidth: 2`・`lineWidth: 120`・
`quoteStyle: single`・`semicolons: always`。この値なら追跡中の JSON は 1 行も変わらない。
`rustfmt.toml` は `max_width` を 120、`use_small_heuristics` を `"Max"` にしつつ
`chain_width` を 72 に固定する — コンパクトな struct literal を保ち、**かつ**手で折られた
メソッドチェーンをそのまま残せる唯一の組み合わせである。

**対象範囲は `biome.json` の明示的な include 一覧と明示的な exclude 一覧**で、推測の余地を
残さない。対象: `src/**/*.ts(x)`（ユニットテストを含む）・`scripts/*.mjs`・
`vite.config.ts`・`vitest.config.ts`・`package.json`・`tsconfig*.json`・
`.vscode/extensions.json`。対象外: `src-tauri/**`（rustfmt の領分であり、Biome の JSON
フォーマッタは同ディレクトリの 1 行 1 要素の `icon` と `permissions` 配列を 1 行に潰す）、
および `.scss` と `.md`。生成物は `vcs.useIgnoreFile` が `.gitignore` を読むことで
カバーされるので、`dist/` と `src-tauri/target` に別途一覧は要らない。
`src-tauri/gen/schemas` は `src-tauri/.gitignore` で無視され、かつ include 一覧の外にある。

**SCSS と Markdown は意図的に未整形であり、設定漏れではない。** Biome は SCSS の
パースと整形を「進行中」、lint を「未着手」としている。`.scss` を渡すと黙って
スキップされ、CSS パーサに食わせるため改名すると `_vars.scss` で 199 件、
`global.scss` で 40 件のパースエラーになる。ここの SCSS 1,688 行は `//` コメント 116・
`@use` 5・`@mixin` 7・`@include` 10・`$変数` 24・`#{}` 補間 6 を使っており、CSS ではない。
以前もスタイルシートを整形するものは無かったので後退ではなく、Biome のロードマップは
SCSS を最も要望の多い機能として着手済みとしている。**SCSS のためだけに Prettier を
足さない** — Biome を選んで避けた 2 ツール構成を、そもそも誰も整形していなかった
ファイルのために復活させることになる。Markdown も同じ状態で、重要度はさらに低い
（追跡中の `.md` の大半は台帳のタスクで、整形は無意味な差分を生むだけである）。

**stylelint は実測のうえで見送った。新しい根拠なしに再検討しない。** stylelint は
フォーマッタではなく linter で（スタイル系ルールは v15 で非推奨・v16 で削除）、
整形の穴は埋まらない。チェッカーとしても何も見つけなかった:
`stylelint-config-recommended-scss` は 6 ファイル全体で 1 件だけ報告し、それは
誤検出である（通常の `//` コメントブロック内の空の `//` 行に対する
`scss/comment-no-empty`）。`stylelint-config-standard-scss` は 85 件報告するが
欠陥は 1 件もない — 62 件は kebab-case を要求して、このコードベースが意図して
使っている BEM の `__element` / `--modifier` 命名を否定する。14 件は `//` コメントの
前に空行を求め、6 件は CSS キーワードの小文字化（フォント名・`optimizeLegibility`・
`currentColor`）を求める。`-webkit-backdrop-filter` に対する
`property-no-vendor-prefix` の助言はここでは**明確に誤り**で、このアプリの macOS
WebView は WKWebView である。実効的な安全網は既に動いている: `sass` は未定義変数・
不正な `@use`・構文エラーで `pnpm build` を落とす。スタイルシートが現在の規模を大きく
超えるか、著者が 2 人目になったときに限り再検討する。

**suppression。** ルールが特定の行について誤っているときは、ルールごと off にせず
その場で `biome-ignore` に理由を書いて抑制する — グローバルに off にすると、次の
根拠のない事例が黙って通ってしまう。仕組みで 2 点、いずれも気づくのに 1 往復かかる
ので書いておく: `//` 形式は `biome-ignore` の行がコードの**直前行**でなければ効かない
ので、複数行の理由は `/* … */` を使う。また JSX の**属性**に対して報告される診断は、
要素の上ではなくその属性の直前にコメントを置く必要がある（要素の上に置くと、
フォーマッタが要素を折り返した時点で離れてしまう）。

### コーディングスタイル

**以下の規約が拘束するのは新規コードと変更したコードであり、既存ツリー全体ではない。**
規約を満たすためだけに、触っていないコメントを書き直したりコードを再構成したりしない。
規約より前からあるものの出来が悪いと感じたら、ついでに書き換えるのではなく指摘する。
具体的には、シグネチャを言い換えただけの doc コメント、`src/` / `scripts/` / SCSS にある
`// ---- Section ----` 形式の区切りバナー、`src/hooks/useFileTree.ts:5-7` にある解決しない
プラン識別子の引用は、いずれも周辺コードが別の理由で編集されるまでそのまま残す。

Comments と Functions の規約は機械的に検査されない。コメントがコードの言い換えに
なっていないか、抽出が実際に何かを改善したかを判定できる linter は存在しない。これらは
レビューで守る規約であり、網羅的なスタイルガイドではなく、レビュアーが現実的に保持できる
範囲に絞って書いてある。

**Comments** — レビュアーが担保する。

- 既定ではコメントを書かない。明確な命名と構造を優先する。
- コメントは英語で書く（リポジトリ内の全言語に適用: TypeScript, Rust, SCSS,
  `scripts/*.mjs`）。
- コメントを書く価値がある場合は、**なぜ**そうしたか、必要なら**なぜそうしなかったか**を
  説明するものを優先する。採った方針の理由、および自明な代替案を却下した理由を含める。
  `src/lib/markdown.ts:40-47`（prototype pollution）と `src/lib/mermaid.ts:27-32`
  （`securityLevel: 'sandbox'` を使わない理由）が手本となる形。
- コメントはコード自身が表現できないものにだけ使う: 意図、制約、不変条件、外部要件、
  自明でないトレードオフ。
- コードの動作を単に言い換えるだけのコメントは書かない。
- API doc コメントも同じ規約に従う。名前・型・シグネチャから読み取れることは書かない。
  コードで表現できない、呼び出し側に関わる契約だけを書く: 振る舞いの保証、事前条件、
  副作用、エラー semantics、互換性の制約。

**Control flow** — Biome の `style/useBlockStatements` が `error` で機械的に強制する。

- 制御フローの本体は常に明示的なブロック構文で書く。言語が波括弧の省略を許す箇所も含む。

**Functions** — レビュアーが担保する。

- ブロックが一貫した、名前を付けられる責務になっているときに関数として抽出する。
- 抽出は抽象度・可読性・テスト容易性を改善するために行う。行数を減らすためだけに
  行わない。
- 呼び出し箇所の数はどちらの方向にも判断根拠にならない。2 箇所から呼ばれること自体は
  抽出を正当化せず、1 箇所しかないことは抽出を否定しない。
- 密結合で些末な処理は、抽出すると局所性を失う・無意味な間接化が増えるなら、その場に
  置いておく。

## 実装メモ / 注意点

- **拡張子→種別の対応表は 2 箇所に書かれており、両方を同時に動かす必要がある。**
  `commands.rs` の `file_kind` はそもそもツリーに出るかどうかを決め、`lib/file.ts` の
  `kindFromName` はそれを写して、セッション復元が裸のパスから `FileEntry` を組み立て
  られるようにする。片方だけに種別を足すのは中途半端な実装ではなく壊れた状態で、
  Rust 側だけならファイルは一覧に出るのに開けず、TypeScript 側だけなら復元が
  ツリーに出せない文書を選ぶ。TS 側が Rust の `None` を `null` として写しているのは
  このためで、追加は必ず `case` であって `default` 分岐の変更ではない。
  種別が触る 7 箇所は doc-1 にあり、この 2 つはその最初の 2 箇所。
- **ファイル読み取りの失敗は素の文字列にならない。** `read_file` は
  `Result<String, ReadError>` を返す。`ReadError` は serde のタグ付き列挙型で、
  `kind` は `invalidUtf8` / `binary` / `tooLarge` / `io` の 4 値（decision-5）。
  `lib/tauri.ts` の `readFile` は reject せず
  `{ ok: true, text } | { ok: false, error }` を **resolve する** — TypeScript は
  reject 値を型付けできないので、判別可能ユニオンを resolve することが、呼び出し側に
  失敗の分岐を `tsc` で強制する唯一の手段になる。写した型・デコーダ・文言の選択は
  `lib/read-error.ts` にあり、Tauri API を import しないので Node 環境で単体テスト
  できる。`tooLarge` と `io` はバックエンドの文言をそのまま表示し、`invalidUtf8` と
  `binary` は `lib/i18n` で文言を持つ。バイナリ形式の追加は `BINARY_MAGICS` に 1 行
  足すだけ。**UTF-8 BOM は `read_file` で除去する** — 下流のパーサで再度剥がさない。
- Markdown は**実行時に WebView 内でレンダリング**する（ビルド時ではない）。
  `renderMarkdown` は `{ html, headings }` を返し、先頭の front-matter（YAML `---` /
  TOML `+++`）は key/value テーブルとして抽出表示する。
- Markdown の HTML は `dangerouslySetInnerHTML` で注入。命令的強化（コードコピー、
  mermaid 描画、外部リンク横取り）は `[result, mode]` 依存の `useEffect` で実行する。
  プレビュー↔ソース切替で article が再マウントされるため、強化処理を再実行する必要が
  ある。**`mode` を依存配列に残すこと。**
- **未信頼 Markdown の境界**（`dangerouslySetInnerHTML` を安全に保つための前提。README
  の "Security" 参照）: markdown-it は `html: false` で動かすため、文書中の raw HTML は
  テキストにエスケープされ、生きた DOM にはならない。markdown-it 既定の `validateLink`
  が危険な scheme（`javascript:` / `vbscript:` / `file:` / 画像以外の `data:`）を除去する。
  `MarkdownView` のクリックハンドラは `http(s)` のみ OS ブラウザへ転送し、`#anchor` は
  スクロール、それ以外の scheme は不活性にする。mermaid は `securityLevel: 'strict'`
  （`sandbox` は iframe 化で SVG 再描画 / コピー機能が壊れるため不可）。`tauri.conf.json`
  の CSP が第二層: `script-src` に `'unsafe-inline'` / `'unsafe-eval'` を入れない（`'self'`
  と Shiki の WASM 正規表現エンジン用の `'wasm-unsafe-eval'` のみ）。`style-src` は Shiki /
  mermaid が inline `style` 属性を出力するため `'unsafe-inline'` を維持する。`eval` /
  `new Function` を要する、またはリモート資産を取得する依存を追加する場合は CSP の見直しが
  必要。
- **未信頼 HTML の境界**（描画表示。decision-3 を decision-9・decision-10 が改訂。README
  の "セキュリティ" 参照）: 文書は `sandbox="allow-same-origin"` かつ `allow-scripts`
  **無し**の iframe へ `srcdoc` で流し込む。文書中のスクリプトは一切実行されない一方、
  親からは `contentDocument` を読み書きできる — アウトライン・高さの実測・リンクの扱いは
  すべてこれに乗っている。2 つのフラグは対であって独立した選択ではない: 両方揃うと文書が
  自分の sandbox を外せてしまい、same-origin がある状態でフレーム内のスクリプトは
  アプリ origin のスクリプトになる（そこでは `read_file` がスコープも capability も無い
  素の `std::fs`）。`allow-forms` / `allow-popups` / `allow-top-navigation` を切ってあるのも
  同じ理由。`srcdoc` 文書は親の CSP も継承し、それが第二層になる — **ただし 2 層は同じ
  広さではないので「独立した 2 層」と書いてはいけない**: inline `<script>`・`on*` 属性・
  `javascript:` URL・リモートの `<script src>` は sandbox **と** CSP の両方が止めるが、
  相対パスの `<script src="./x.js">` を止めるのは **sandbox だけ**である。`srcdoc` は
  それをアプリ自身の URL に対して解決し、`script-src 'self'` がそれを通すため
  （decision-3 の表）。**要素の許可リストもサニタイザも無い。** 変換が取り除くのは
  `<iframe>` / `<frame>`（`asset:` を指す入れ子フレームは自身の CSP を持たない文書を
  読み込むので、その下位資源の読み込みが CSP の外にも通知バーの数の外にも出る）と
  `<base>`（書き換えが解決するすべての参照を差し替えてしまう）の 2 種、それに属性 1 個 —
  `<area>` の app-origin な `href`（TASK-25）で、これは遷移の修正であって封じ込めの修正では
  ない（辿った先はアプリのシェルが sandbox 付きフレームの中で白く出るだけで、逃走ではない）。
  3 つとも描画・遷移・ネットワークの都合であってサニタイズではない。`<object>` / `<embed>` は
  `object-src 'none'` が既に覆うので何も要らない。**ネットワークへの露出は残り、それは
  許容済み**: `img-src` が `https:` を運ぶのでリモート画像は読み込まれ、`<style>` ブロックや
  `style` 属性の `url(https://…)` も同じく読み込まれる。CSS は sandbox で塞がらない側路で、
  DOMPurify を入れても塞がらなかった類のもの。Markdown が既に持つ露出と同じなので、
  外向きリクエストの種類は増えていない。**後から `allow-scripts` を足すのは 1 行の変更では
  ない** — `allow-same-origin` がある以上、失敗の形は壊れたウィジェットではなく任意の
  ローカルファイル読み出しになる — ので、それ自体の decision を要する。
- **`pnpm tauri dev` のデスクトップ実行には CSP が一切無く、開発中はこの第二層が
  丸ごと存在しない。** `set_csp` は Tauri が資産を配る経路でしか走らず、dev の WebView は
  Vite の `devUrl` を直接読み込み、`index.html` は CSP の `<meta>` を持たず、`devCsp` も
  未設定。壊れているのではなく最初から無いという点が厄介で、目に見える失敗より悪い —
  CSP に依存した境界は dev では正常に見え、ビルド済みアプリで破れる。**封じ込めが CSP に
  依存するものは `pnpm tauri build` で確認する** — `--debug --no-bundle` で足り、これは
  dev ビルドではない。**`devCsp` を設定しても dev に CSP は付かない**（TASK-7 で確定）:
  この値を読むのは `AppManager::csp` だけで、そこへ入る経路は `get_asset` しかなく、
  デスクトップの dev 実行は主文書でそこを通らない。
  すぐ隣にもう 1 つ罠がある: `style-src` の `'unsafe-inline'` は、そのディレクティブに
  nonce か hash が入った時点で効かなくなり、tauri-codegen は `index.html` に見つけた
  inline `<style>` の hash を追加する。つまり `index.html` に inline `<style>` を置くと
  Shiki・mermaid・すべての inline `style` 属性が一度に壊れる。これは `index.html` に
  対する恒常的な制約として扱う。
- **メディア（画像/PDF/動画）** は `MediaView` が Tauri の asset protocol
  （`convertFileSrc` → `asset:` URL）でディスクから直接描画する。バイトは JS を通らない
  ため、`read_file` の 10 MiB テキスト上限は適用されず、`Viewer` はメディア種別ではテキスト
  読み込みをスキップする。asset protocol には `protocol-asset` cargo feature と
  `tauri.conf.json` の `assetProtocol.enable` が必要。スコープは空から始まり、開いたフォルダ
  ごとに `allow_media_dir`（`App.tsx` が開いた時とセッション復元時に呼ぶ）で広げる。CSP は
  `img-src` / `media-src` / `frame-src` に `asset:` / `http://asset.localhost` を許可する
  （frame は WebView 内蔵 PDF ビューア用）。これは未信頼 Markdown の境界を広げない:
  `html: false` と `validateLink` が `asset:` scheme を弾くため、文書側から `asset:` 参照を
  出すことはできず、メディアはツリーで選んだファイルのみ読み込まれる。対応可否はプラット
  フォームの WebView に依存する（heic/heif は `file_kind` で macOS に限定。PDF は一部 Linux の
  WebKitGTK では非対応）。`<img>` / `<video>` は復号失敗時にフォールバック文言を出す。
  `<iframe>`（PDF）は信頼できるエラー信号がないため、空表示になることがある。
- **先頭のドットは再帰許可だけでは届かない。`assetProtocol.scope` が `[]` ではなく
  オブジェクトなのはこのため。** `allow_media_dir` が呼ぶ `Scope::allow_directory` は
  `<dir>/**` の glob を積み、スコープの照合は `glob::MatchOptions` で行われる。その
  `require_literal_leading_dot` は unix で `true`、Windows で `false` が既定
  （tauri 2.11.3 の `src/scope/fs.rs`）。この既定のもとで `*` と `**` はドットで始まる
  パス要素をすべて拒むので、`.assets/` の中の画像も、文書の隣の `.hidden.png` も 403 で
  拒否され、WebView には壊れた画像として出る — `MediaView` でも、描画ビューの書き換え済み
  参照でも同じ。`tauri.conf.json` の `requireLiteralLeadingDot: false` が asset protocol の
  スコープ全体でこれを外す。**`allow_media_dir` が許可したフォルダの外へは広がらない** —
  パターンは変わらず、静的な `allow` / `deny` は空のまま、`is_allowed` は照合前に
  canonicalize するので `..` が glob に届くこともない。**2 つ目の許可では代われない** —
  任意の深さのドットディレクトリも、ドットで始まるファイル自体も、有限個の glob では
  覆えず、許可の後に作られたディレクトリは取り逃す。これは Windows と `read_dir_tree` が
  既にいた場所へ unix を合わせる変更でもある: `read_dir_tree` はドットディレクトリを
  一度も除外しておらず、ツリーは以前からそれらのファイルを並べていた。macOS 上で
  tauri 2.11.3 の `Scope` そのものに対して実測（TASK-21）。`commands.rs` の
  `asset_scope_reaches_media_behind_a_leading_dot` は値を書き写さず
  `tauri.conf.json` から読み出すので、このキーを外すとテストが落ちる。
- **印刷は 1 つの呼び出しが 3 経路に分かれ、`window.print()` を通るのは Windows だけ。**
  `print_window` が webview ウィンドウを `WebviewWindow::print()` へ渡す。pin されている
  wry 0.55.1 は macOS で `NSPrintOperation` を組み立て、Windows で `window.print()` を
  eval し、Linux で GTK の `PrintOperation::run_dialog(None)` を呼ぶ。
  **したがって JS の印刷イベントが発火すると仮定できない** — decision-9 が
  パーサ登録のリスナについて確定させたのと同じ形 — 印刷前に DOM を組み替える必要があるなら、
  呼び出しより前にフロント側で同期的に済ませる。**Tauri の doc コメントは「macOS のみ」と
  書いているが、pin された wry には 3 環境すべての実装がある**。根拠は pin されたソース側で、
  TASK-11.1 が踏んだ食い違いと同じ。**`Ok(())` が返ったことは印刷 UI が出た根拠にならない** —
  macOS の経路は `respondsToSelector(printOperationWithPrintInfo:)` で守られており、
  guard が偽なら何もせず成功を返す。Windows は eval した JS が走る前に返り、Linux の
  ダイアログは親が `None` なので mallow の前面にあるとは限らない。
  **入口の判定はアクティブなビューで書き、`file.kind` では書かない**（decision-13）:
  `Print…` はアクティブなビューが markdown の preview でないとき disabled になる。
  `file.kind === 'markdown'` はトグルのソース側でも真になり、そこは印刷してはいけない。
  **`keydown` の handler はアプリの生存期間に 1 度だけ登録し、印刷を拒否する場面でも
  必ず chord を消費する** — これは好みではなく訂正である。以前は `MarkdownView` の中にあり、
  印刷できないビューは何も登録しない形だった。**Windows ではそれがまさに `.csv` を
  印刷させた** — **WebView2 は自前の `Ctrl+P` を持つ**ので、**何も登録しないことは
  chord を不活性にするのではなく、プラットフォームへ譲ることだった**（2026-09-07 実測）。
  いまは `MarkdownView` が条件を報告し、`lib/markdown-preview` がフラグを持ち、
  `lib/chord` が 3 値の判定（`suppress` が最初の設計に名前が無かった場合）と、
  **handler 自身を factory として**持つ。
  factory にしたのは、**分類の仕方だけでなくイベントに対して何をするかを検査に載せるため** —
  分類が正しくても handler が `preventDefault` を忘れれば同じバグになり、それがまさに
  起きたことだった。`lib/print` に残るのは、それらを出したあとの残り — キーと、読むゲートと、
  ゲートする理由である。**仕組みは PDF 書き出しの chord と共有し、フラグも同一**で、
  それが 2 つの入口を一緒に有効・無効にし続ける（decision-14）根拠になっている。**`App` の `addEventListener` の 1 行だけはどのテストも届かない**
  （スイートは設計上 DOM 無しの Node で走る）。
  **Linux の chord を閉じるのもこれ** — Rust 側で `print_window` が拒否しても
  ネイティブ binding は止まらない（あれは `print_window` を通らない）。
  **エンジンがページ割りするのは `<body>` 全体**で、エクスプローラ・ツールバー・フッター・
  設定モーダルを含む。印刷用スタイルが入るまで紙にはアプリの外殻が乗る —
  **そして macOS では外殻が紙のほぼ全部だった**（2026-09-06 実測。Windows と Linux は未実測）。
  刷り上がりは **A4 1 ページ**で、印刷シート自身のプレビューが利用者の設定より前に
  `Page 1 of 1` と出していた。**原因は印刷の呼び出しではなくアプリの高さの連鎖である**:
  `html, body, #root { height: 100% }` → `.app { height: 100% }` →
  `.app__body { flex: 1 1 auto; min-height: 0 }` →
  `.doc-scroll { flex: 1 1 auto; min-height: 0; overflow: auto }` により
  **`<body>` は構造上ちょうど 1 ビューポート分の高さ**になるので、文書がどれだけ長くても
  ページ割りは 1 ページを出す。**つまり印刷用スタイルは `.doc-scroll` だけでなく
  この連鎖全体を解く必要があり**、同じ回で紙が横方向にも切れていた（用紙幅に縮小されず
  ウィンドウ幅のまま切り落とされた）ので幅も解く必要がある。
  **その印刷用スタイルが `src/styles/print.scss`** — 最後に import することで、
  パレットの上書きが同一詳細度のテーマセレクタにソース順で勝つ。
  `will-change: transform` を無効化するのではなく**ツールバーごと隠す**
  （画面の描画順に触れずに同じ紙へ到達する）。**ページ割りの制約は 1 つも持たない** —
  `break-inside`・`break-after`・`orphans`・`widows` のいずれも無い。macOS の切断を追う過程で
  外し、原因は別のところにあったので、**この不在は「まだ刷って確かめていない状態」であって
  結論ではない**（戻すなら: **`.mermaid` は図のソースを持つ `<pre>` で、描画成功時に
  `.mermaid-rendered` に置き換わる**。そして **表に当てると半端な空白ページが出る**）。
  **印刷ではコードを折り返す**（`pre-wrap` +
  `overflow-wrap: anywhere`）— `overflow: visible` は `white-space: pre` を折り返さず、
  用紙幅を超える行が 1 本あるだけでエンジンが**文書全体を縮小して**収めてしまうため。**dark パレットから刷るとコードはモノクロになる** —
  Shiki の dark トークンはインラインの `--shiki-dark` を `!important` で当てており、
  隣のインラインの light 色を上回るうえ、CSS は宣言を取り消せないため。
  **書きながら踏んだ罠が 2 つあり、どちらも読んでではなく刷って見つかった**:
  `@include on-dark` を**トップレベル**で使うと `:scope` にコンパイルされ
  （`:root[…] :scope .markdown-body …`）、**何にもマッチせず黙って出荷される**ので
  規則の内側で include する。そしてそれを見つけた harness
  （`_sandbox/handoff/task-27/harness/run.sh`、headless Chrome）は
  **3 環境の実測の代わりにならない** — 対照実験では印刷用スタイル抜きでも 16 ページに
  分割されるので、**Chrome はそもそも 1 ページ問題を持っていない。**同じ回で確定した 2 件:
  **dark パレットは白地に薄い文字として刷られる**（WebKit の既定の `print-color-adjust` が
  背景を落とすので、パレットの明るいインクが刷られていない白地に乗る。**light 固定は
  インクの話ではなく可読性の話である**）、および**設定モーダルは文書に重なるのではなく
  文書を消す**（ビューポートを覆う backdrop が不透明な白として刷られる）ので、
  除去はパネルだけでなく backdrop も対象にする。そのスタイルは
  `.scss` に書き、**`index.html` に inline `<style>` として置いてはならない** —
  `style-src` に hash が付いて `'unsafe-inline'` が失効する。`.toolbar` の
  `will-change: transform` を無効化するのは `@media print` の中だけにする。
  **余白を測る前に `@page` を書かない** — macOS の経路は印刷操作の余白 4 辺を 0 にし、
  それをアプリ共有の `NSPrintInfo::sharedPrintInfo()` へ書き込む一方、他の 2 環境は
  印刷 UI に任せるので、余白を指定するのも任せるのも観測前は誤りである。
  **自動検査は何も見ない**: Biome と Vitest は SCSS を読まず、印刷ダイアログを開ける
  ハーネスは無く、`src/probe/` はカウンタで測る器材だが、ここでの根拠はスクリーンショットと
  PDF である。
  **3 環境の挙動の差は、スタイルシートの差よりずっと大きい**（2026-09-07 実測）。
  Windows は文書を最後まで正しく刷り、WebView2 自身のヘッダ・フッタ（日付・文書名・URL・
  ページ番号）を足す — 読み手は消せるが CSS では消せない。macOS は長い文書の末尾を失う:
  印刷シートがページ数を数え、**印刷 UI の PDF 出力先**が書く PDF がその数に従い、
  それより多くのページを要する組版はそこで止まる。**シートでプリンタを切り替えると再計算が走り、書き出しが組版と一致する。**
  だから **切断を根拠に CSS の値を調整してはならない** — `@page` の余白を外すのも、
  文字を小さくするのも、エンジン自身の縮小も、すべて「必要なページ数を古い数の下へ戻す」
  という同じ偶然で「直った」ように見えていた。
  `_sandbox/handoff/task-27/mac/paper-mac-light-7a.pdf` は `-7.pdf` と同じスタイルシートで、
  数え直しを強制しただけで完走している。Linux はハングするので、`print_window` はそこでは拒否する。
- **PDF 書き出しは紙への 2 本目の道であり、1 本目の修正ではない。2 つの入口は並存する**
  （decision-14）。`write_window_pdf` は各環境の印刷パイプラインを通してファイルを書き、
  **どの時点でも印刷 UI を出さない**。それが印刷の 3 つの欠陥をまとめて迂回する理由であり、
  **Linux では紙への唯一の道**になる。**「PDF 出力」という語はどちらとも読めるので使わない** —
  **mallow が書くものが `PDF 書き出し`**、**プラットフォームのダイアログの中にある選択肢が
  `印刷 UI の PDF 出力先`** で、v0.8.0 では両方が存在する。**各環境の実装が合格かどうかを
  決めるのは `@media print` が当たるかで、それは環境の性質ではなく API の性質である** —
  紙にエクスプローラとツールバーが乗るのが探すべき失敗で、そうなっていれば
  `styles/print.scss` が無効だということである。だから macOS では、画面の描画をそのまま
  PDF にする `WKWebView.createPDF` ではなく `NSPrintSaveJob` の `NSPrintOperation` を組む
  — 印刷パイプラインなら構造上スタイルシートが当たる。**その分岐が使ってはいけない呼び出しが
  `runOperation()` で、これは読みではなく実測である**: 2026-09-07、CPU を 1 コア食い潰して
  応答しなくなり、**trailer の無い 318 MB・4,022,381 オブジェクトの PDF** を書いた —
  content stream が圧縮 11 バイト、つまり空のページが数百万枚である。文書側の不具合ではなく
  既知の WebKit の挙動で、`printOperationWithPrintInfo:` は `runOperation` の下では白紙を描き、
  代わりに `runOperationModalForWindow:` を通す必要がある — **パネル 2 つを off にし
  disposition を save にしてあるので、modal は出ない。** 結果はデリゲートに届くので、
  この分岐だけクラス（`MallowPdfExportObserver`）を定義し、**AppKit は
  `didRunSelector` のデリゲートを retain しない**ので自前で生かしておく。掃除は
  コールバックの中ではなく次回の書き出し時に行う — 自分のメソッドの中で最後の参照を
  落とすと、メッセージ処理中に受信者が解放される。**新しい `NSPrintInfo` は退化していない** —
  同日の実測で、新規も共有も A4 595×842・imageable 559×783 だった — ので用紙は設定不要で、
  暴走はページ矩形の問題ではなかった。**印刷ビューの frame は意図的に初期化しない** —
  ダイアログ無しのレシピはどれも webview の bounds で初期化するが、そうすると
  **ページ全体が用紙サイズで組まれ 0.847 倍に縮小されて `@page` の余白枠へ収まった紙**が
  出た（2026-09-07、clip 矩形で実測。`504×713` 対 印刷経路の `504×750`＝倍率 1。
  つまり `@page { margin: 16mm }` が余白ではなく縮小として効いていた）。
  あの frame が、紙が正しいと実測されている wry の経路との唯一の幾何学的な差分だったので
  外した — **この分岐はいま disposition とパネルの 2 点でだけあの経路と違う。**
  レシピが言っているのは frame を持たない webview の話で、mallow のそれは画面上にある。
  **印刷情報はこの件の出どころではない** — 同日の実測で、新規と共有は辞書レベルまで同一
  （A4 595×842・4 辺の余白 0・`NSScalingFactor` 1・pagination Clip/Automatic・
  ヘッダフッタのキーは存在しない）。 3 環境すべて非同期で報告するので、
  **報告しないプラットフォームではコマンドが pending のまま残る** — どれもメインスレッドを
  塞がないので、ハングではなく沈黙である。**`NSPrintInfo` は
  `sharedPrintInfo()` ではなく毎回新しく作る** — wry は印刷ごとにあのアプリ全体の
  シングルトンを書き換えており、古いページ数はまさにそこに残りうる状態である —
  **ただしこれは切断についての仮説であって修正ではない**。原因は特定されていないので、
  完走した書き出しはその根拠にならず、切断した書き出しもこれに対する退行ではない。
  **4 つの `NSPrintInfo` 余白は 0 にする**ので、本文を内側へ寄せるのは `@page` だけになり、
  それが印刷用スタイルを実測したときの体裁でもある。**ゲートは印刷と同一の 1 文で、
  理由は別**: `Export as PDF…` がアクティブなビューが markdown の preview でないとき
  disabled なのは、**印刷用スタイルが markdown 専用**だからである。だから他のビューを
  書き出したいという要求は、入口ではなくスタイルシートを広げる要求になる
  （decision-6 によりソースビューがその出発点）。**chord は書き出しを拒否する場面でも
  消費する** — 印刷が実測で確定させた規則で、**どのエンジンが `Ctrl+E` を持つかは未実測**、
  消費すればそれを問う必要が無くなる。**Linux の分岐は、印刷先ファイルのプリンタ名を GTK に聞く。
  英語の literal は fallback にすぎない。** WebKit は `gtk_printer_get_name` の一致で
  プリンタを解決し、GTK のファイルバックエンドはその名前を gettext 経由で付けるので、
  `"Print to File"` は日本語環境では printer-not-found になる — Linux では印刷が拒否されるので、
  それは紙への道が塞がるということである。**gtk-rs はここを一切束ねていない**:
  gtk-sys 0.18 が持つのは `GtkPrintSettings` だけで `GtkPrinter` は無いので、
  `pdf.rs` の `gtk_printers` が 4 つのシンボルを自分で宣言する。相手は `gtk` クレートが
  既にリンクしている libgtk-3 なので、**依存ではなく依存の要らない `extern` ブロック**で済む。
  **ファイルバックエンドを選び出すのは「virtual かつ PDF を受ける」の組**であって、
  探している名前ではない — PDF を書く CUPS のキューは GTK にとって実在のプリンタで、
  `is_virtual` は偽になる。
  **保存先は 3 つの分岐のどれが見るより先に絶対パスへ直す。** これは用心ではなく実測で、
  `paper/x.pdf` を渡したとき Linux は `The pathname … is not an absolute path` と言って
  止まり、**macOS は `CFURLGetFSRef was passed a URL which has no scheme` をログに出して
  何も書かずに成功を返した** — `fileURLWithPath:` は相対パスから相対 NSURL を作る。
  保存ダイアログは常に絶対パスで答えるので、これはそれ以外の呼び出し元のための処理である。
  **Windows 分岐の初コンパイルは CI ランナーで、そこで 2 度落ちた**: webview2-com の
  マクロは完了ハンドラの引数を closure が見る前に変換する（`HRESULT` →
  `windows::core::Result<()>`、`BOOL` → `bool`）ので素直に書いた `hr.ok()` と
  `written.as_bool()` はどちらも誤りで、さらに sender は handler 用に clone が要る
  （同期の失敗経路も同じ sender で報告するため）。**どちらも macOS からも
  CI の ubuntu Rust ジョブからも見えない** — 紙のジョブがこのファイルを 3 環境で
  コンパイルする理由がそれである。
  **この分岐と書き出しが共有する事項が 2 つある。** 書き出しは直列化する
  （Rust 側はコマンドが試みるロック、フロント側は chord が読むフラグ）—
  macOS では実行中に 2 つ目の `NSPrintOperation` を作ると
  `NSPrintOperationExistsException` が上がり、Objective-C の例外が Rust へ戻ると
  エラーではなくプロセスの終了になるからで、書き出しは自前の UI を出さないので
  その間ウィンドウはキー入力を受け続ける。そして **保存ダイアログが答えたパスをそのまま書く** —
  後から `.pdf` を足すと、ダイアログが確認していないファイル名になる。上書き確認は名前ごとで、
  rfd の GTK ダイアログは上書き確認を有効にする一方フィルタの拡張子は付けないので、
  `report` と打った読み手は `report` について確認され、隣の `report.pdf` を黙って失いうる。**ここでも紙を見る自動検査は無い**。しかも印刷より悪い穴が 1 つある:
  **Windows の分岐は CI の `cargo check`（Rust ジョブは ubuntu）でも macOS 上のローカルでも
  コンパイルされない**ので、初回のコンパイルが実機測定の回になる。
- **絵文字。** Unicode 絵文字は `<span class="emoji">` で包み、そこだけカラー絵文字
  フォント（`$font-emoji`）を先頭にしたスタックを当てる。包まないと、本文の日本語
  フォントが持っている一部の絵文字でフォールバック競争に勝ってしまう — `:ok:` は
  U+1F197（日本のキャリア絵文字由来の記号）で、Hiragino / Noto Sans JP がモノクロ
  字形を持つため、他がカラーなのにそこだけ平板になる。本文のフォントスタック自体の
  先頭にカラー絵文字フォントを置くのは NG: Apple Color Emoji は keycap 用に ASCII
  数字も持っているため、数字まで奪われる。
- **カスタム絵文字。** `lib/custom-emoji` がユーザーの選んだフォルダ（設定 →
  カスタム絵文字。`customEmojiDir` として永続化）をショートコード表に変換し、
  `lib/markdown` の `setCustomEmoji` に渡す。基準になるのはディスク上の画像で、
  `emoji.json` は任意（Unicode エントリと、名前ごとの優先ファイル指定を足すだけ）。
  この分割は `lib/markdown` を Tauri API から切り離し、Node 環境で単体テストできる
  状態に保つため。セット適用時はキャッシュ済み MarkdownIt インスタンスを捨て
  （ショートコード表は `md.use` 時に正規表現へコンパイルされる）、`MarkdownView` が
  `useSyncExternalStore` で読むバージョンを進めるので、開いている文書が再描画される。
  ショートコードを `<img>` にしても未信頼 Markdown の境界は広がらない: 文書が渡せる
  のは**名前**だけで、名前はアプリ側が組み立てた表のキーである時しかマッチせず、URL は
  文書由来にならない。フォルダには別途 `allow_media_dir` の許可が必要。
- テーマ = `data-theme` 属性 + CSS 変数パレット（瞬時切替・非 React の描画 HTML にも適用）。
  7 種類。ダークパレットを追加する際は `_vars.scss` の `on-dark` mixin と `global.scss`
  の適用にも追加すること。
- i18n は `lib/i18n.tsx` の自作辞書（ライブラリ不使用）。UI 文言は `useT()` /
  `t(key, params)` 経由にし、キーは `ja` と `en` の**両方**の辞書に追加する。言語は
  localStorage → OS ロケール → 日本語 の順で決定。
- アイコンは Lucide (https://lucide.dev) の SVG を `components/icons.tsx` に
  インライン化（24×24・`stroke="currentColor"`）。追加時は `lucide-react` を入れず
  パスデータをそのままコピーする。
- ネイティブのウィンドウタイトルは開いているドキュメントに追従する（`lib/title.ts`:
  markdown の front-matter `title` があればそれ、なければファイル名、未選択時は `mallow`）。
  `Viewer` から `setWindowTitle` で設定する。`document.title` では Tauri のウィンドウ
  タイトルは変わらないため `core:window:allow-set-title` 権限が必要。
- Shiki のデュアルテーマ: light はインライン、dark は `--shiki-dark` として出力し
  `on-dark` で差し替え。コードのトークン色はパレットに関わらず github-light/dark のまま。
- **`SourceView` には上限があり、それがあるからこそ退避先として使える。**
  `HIGHLIGHT_MAX_BYTES`（UTF-8 で 256 KiB）または `HIGHLIGHT_MAX_LINES`（10,000）を
  超えたら — どちらも `lib/source-cap` — Shiki をそもそも呼ばない。Shiki のコストは
  入力に比例し、出力 HTML は入力の約 14 倍になり、そのすべてがメインスレッドに乗るため。
  文法を `text` に落とすのは代替にならない（行ごとの span は出続ける）。
  **諦めるのは強調表示であって内容ではない**ので、呼び出し側が `SourceView` を出す前に
  自前でサイズを見る必要はない（decision-6）。強調表示を省いたことは告知
  （`highlightSkipped`）で述べる — 色の無い表示が描画不具合と読まれないようにするため。
- `SourceView` の行番号: 強調表示する経路では Shiki が `<span class="line">` を出力するので、
  CSS は `code { display: grid }` + `.line::before { counter }` を使用。上限を超えた経路には
  行ごとの要素が無いため、行番号は本文の隣に置くもう 1 個のテキストノードになる。
  折り返しを無効にしているのはこのため（折り返すと行番号の列と段がずれる）で、
  構文エラーの目印も行への class ではなく 1 枚の帯になる。**この帯の位置は描画済みの
  テキストから測った行送りで決める。宣言値の `--src-line-height` から計算してはいけない** —
  WebKit は行ボックスの高さを整数に丸めるので、宣言した 20.8px は 20px として使われ、
  計算で置いた帯は 25 行ごとに 1 行ずれる。
- **ツールバーは自前のコンポジットレイヤを持ち続けなければならず、z-index の数字だけでは
  ドロップダウンを `.doc__bar` の上に保てない。** バーの `backdrop-filter` がバーを
  専用のレイヤに置くので、`.doc-scroll` がオーバーフローしている状態でツールバーの
  メニューを開き、オーバーフローが消えるまでウィンドウを大きくすると、そこで起きる
  組み直しが**既に開いているポップアップの上にバーのレイヤを並べ直す**。同じ
  オーバーフロー状態を動かすものなら何でも起きるので、**断続的に見える**。
  **どれが実際に動かすかは推論であって実測ではない** — 実測したのは上の 4 手順で、
  highlighting の到着・mermaid・`HtmlView` の高さ収束は観測された引き金ではなく
  候補として挙げている。そのため `.toolbar` が
  `position: relative; z-index: 10; will-change: transform` を持つ
  （`src/styles/app.scss`）。**`will-change` は飾りではなく効いている側**で、
  他の 2 つを残したままその 1 行だけ落とすと再現する。**代わりに `.doc__bar` の
  z-index を上げてはいけない** — バーは自分が固定される文書の上に居なければならない。
  `.menu__popup` の 50 はツールバーのスタッキングコンテキスト内でしか効かなくなった。
  実測は macOS / WKWebView のみで、**ここの退行は自動検査では捕まらない** —
  描画順を見る検査は 1 つも無い。
- **見出しのジャンプとアウトラインのスクロールスパイは、TypeScript から CSS へ渡って
  戻ってくる 1 個の値で、3 ファイルすべてが揃っていないと壊れる。** `.doc__bar` は
  スクロール容器の上端に固定されるので、見出しはこれを越えないとそもそも見えない。
  `MarkdownView` が描画済みのバーを実測し、**`Outline` にスクローラとして渡すのと同じ要素**へ
  `--doc-bar-height` として publish する — `$doc-bar-height` から取らないのは、その 42px を
  コメント自身がトグル行の概算と呼んでいるため（上の `SourceView` の帯と同じ規則）。
  `markdown.scss` がそれを見出しの `scroll-margin-top` にし、`scrollIntoView` も文書自身の
  `#` リンクもこれを尊重する。`Outline` は計算し直さず、その computed な
  `scroll-margin-top` を見出しから読み戻す — 値は 1 個で、SCSS のフォールバックが
  スパイ側にも効く。比較には `LANDING_SLACK_PX` が入る: スクローラのオフセットは整数、
  見出しの位置は小数なので、厳密比較だと**クリックした 1 つ上の項目**が半分くらいの確率で
  ハイライトされる。**property を publish せずに `.markdown-body` をマウントするビューは
  黙って 62px のフォールバックを使う**（今日は `MermaidView`。Config・Table・Xml・Html の
  バーは publish しない）。そこに見出しが無いあいだだけ無害。**`HtmlView` は同じ事例ではなく
  別の事例**で、見出しはフレーム自身の文書の中にあり `markdown.scss` はそこへ届かない。
  答えは、`html.scss` の `.html-frame` に `scroll-margin-top` として 1 回だけ宣言し、
  load 時に computed 値を読んで各見出しへインラインスタイルで写すこと。**値は CSS に 1 個の
  ままで、`Outline` は変わらず見出しから読み戻す。**
- **描画した HTML のフレームの高さは、いま適用している高さで読む。それが収束値を
  「不動点」にしている。** フレームの高さは**そのまま文書のビューポート**なので、
  別の基準で測った高さは**その文書がレイアウトされていない高さ**である。適用すると
  中の `90vh` は文書が決して得ないビューポートに対して解決され、内容が箱を超え、
  **フレームが第 2 のスクロール領域になる** — decision-3・decision-9・TASK-8 が
  そろって禁じている状態で、`scrollIntoView` はフレーム内部をスクロールし親は動かない。
  TASK-5.2 は「フィードバックループを消せる」として基準高さ版を先に出したが、
  消えたのは収束の方で、捕まえたのは目視の回だけだった。**decision-3 のループが正しい**
  （発散しうることも含めて）。`MAX_MEASUREMENT_PASSES` と `MAX_FRAME_HEIGHT_PX` が
  それを縛り、`ResizeObserver` がループを回す（高さを適用するとビューポートが変わり、
  Observer が報告し、また測る）。
  **収束したときは何も書かない。** これは最適化ではない: CSSOM-View では instant scroll が
  進行中の smooth scroll を中断させるので、アウトラインのジャンプ中に測定が入ると
  数 % で止まる。Observer も poll もまさにその最中に鳴る。
  **縮小は高いフレームからは見えない**（`scrollHeight` はフレーム自身の高さで下限が付く）ので、
  文書を短くしうる要因（mutation・幅の変化）は **restart** を要求する。restart は
  フレームを読者のビューポートに播き直し、読者の位置は**見出しアンカー**で運ぶ
  （再計算中の高さに属する `scrollTop` では運べない）。poll は restart しないので、
  poll だけが拾える縮小は拾わない。その取引は poll の隣に書いてある。
  **親からフレーム内への書き込みは、ハンドラではなく load の一巡に属する** —
  着地オフセットも `tabindex` も。どれも `MutationObserver` が拾う属性変更であり、
  **mutation は restart を要求する**ようになったので、ジャンプを準備しながら書くと、
  ジャンプを殺すだけでなくフレームを播き直して読者を先頭へ飛ばすことになる。
- **`srcdoc` 文書の base URL は「親の」URL なので、フレーム内の `#section` は
  同一文書内リンクではない。しかも `frame-src 'self'` はその読み込みを許す。**
  フレームはアプリ自身の URL へ遷移し、シェルはスクリプトを拒否されて白く描画され、
  読者はビューの中から戻れない。相対パス・ルート絶対パスも同じ。`frame-src` が本当に
  止めるのは `http(s)` の方で、だから外部リンクは不活性でこちらは不活性でなかった。
  **「CSP がフレームを押さえている」は `frame-src` が運ばない宛先についてだけ真**であり、
  そこに乗る議論は先に宛先を名指しすること。親登録リスナが動かない環境では
  `preventDefault` できないので、`HtmlView` が load 時に `pointer-events: none` で
  無力化する — クリックはアンカーへ届かないが `:link` は当たり続けるので文書自身の
  装飾は保たれる（decision-10）。両方とも `lib/html-doc` にある — 述語が
  `navigatesAppOrigin`、適用そのものが `neutralizeAppOriginLinks`。**`HtmlView` の中の
  ループではなく名前のある関数なのは、プローブが同じものを適用するため** —
  `src/probe/link-checks.ts` は decision-10 の未測定ケースを、フィクスチャを raw と
  この適用済みの 2 モードで armして測る。そこに機構の写しを置けば、出荷しているものでは
  なく写しを測ることになる。**その測定結果（TASK-23、3 環境すべて）: `<a>` のクリックと
  キーボード経路はどちらも閉じており、`<area>` は閉じていなかった。** area への
  `pointer-events: none` はそのクリックを止めない（実測）ので image map はフレームを
  遷移させた。**理由を「当たり判定を area が持たないから」と説明しないこと** —
  WebView2 ではクリックイベントが area まで届いている（下記）。しかも
  リスナが動く WebView2 では pass 自体が適用されず、`HtmlView` のハンドラは
  `closest('a[href]')` で拾うので `<area>` は素通りする。同じ失敗に 2 経路あり、
  decision-10 のどちらの半分もカバーしていなかった。**TASK-25 は分岐の前に置いた 1 個の
  pass で両方を閉じた。この「置き場所」が実装細部ではなく要点である。**
  `neutralizeAppOriginAreas` は変換の中で走るので、フレームが読み込む前に `href` が消えて
  おり、どちらの経路にも辿るものが残らない — 領域のクリックが activate する先も、
  ハンドラのセレクタが取り逃す `area[href]` も無い。**「クリックが無い」ではない** —
  クリックは今も配送されている（下記）。無くなったのはそれが担っていたリンクである。**消えるのは activation であってクリックではない。これは実測である** —
  WebView2 では無力化後も領域は当たり判定を持ち、カウンタは `area-link (not a link)` を
  遷移 0 回に対して記録した。**「クリックが下の画像へ抜ける」とは書かないこと。**
  修正後に 3 環境で測り直した（2026-08-24、
  `_sandbox/handoff/task-25/task-25-{mac,win,linux}.md`）: raw で arm すると 3 環境とも
  領域がフレームを遷移させ、pass を当てて arm するとフレームは `about:srcdoc` のままで
  `area[href]` は 1 つも残らない。当たり判定を止めるのではなく `href` を外すのは、**decision-10 が
  `href` を保った理由が `<area>` には無い**ため — `<a>` は `:link` が当たり続けて文書の
  装飾が残るために保つが、`<area>` はそもそも箱を持たないので装飾されるものが無く、
  失われるものも無い。`tabindex="-1"` は書き続ける: 実測された環境でキーボード経路を
  閉じたのはこれであり、今回置き換えたのは 2 つのうち 1 つだけである。**したがって
  `neutralizeAppOriginLinks` の選択子は `a[href]` だけ**であり、`HtmlView` のハンドラも
  `a[href]` だけを見る — どちらを広げても、到達しない枝になるか、WebView2 でだけ image map の
  `http(s)` 領域を OS のブラウザへ渡す**機能追加**になり、この修正ではない。プローブの
  neutralized は **2 つの pass を両方**適用する — 片方だけでは、アプリが表示しない文書を
  arm することになる（アプリ自身の関数を使う理由と同じ）。
- **親がフレームの中へ置いたものは `srcdoc` の差し替えごとに全部消える。クリック処理は
  「あるもの」ではなく「能力」。** `contentDocument` は iframe **要素**の `load` までは
  `about:blank`（この load は 3 環境とも発火する）で、差し替えのたびに文書が作り直されるので、
  `HtmlView` は load のたびに**見出しの id → 親側の配線 → スクロールアンカー → 高さ**を
  この順で回し直す。親がその文書に登録したリスナが呼ばれるかどうかは、**文書ごとに 1 回の
  同期 dispatch** で判定する（WebView2 では動き、WebKit 2 種では動かない。decision-9）—
  プラットフォーム名で分岐しない。遅延レイアウトは**観測**であって聞き取りではない:
  フレーム内の `<img>` の load リスナは 3 環境とも不発、フレームの `documentElement` への
  `ResizeObserver` と文書への `MutationObserver` は 3 環境とも報告する。polling は保険。
  スクロールアンカーは再読み込みの直前ではなく**親のスクロールのたびに**取る —
  `srcdoc` の差し替えは非同期に文書を置き換えるので、「新しいマークアップが確定していて、
  かつ古い文書がまだ読める」瞬間を親が当てにできないため。
- **下位資源の書き換えには解決の基準点が要る。`lib/path` の `dirname` と `resolvePath` は
  そのために入った。** `srcdoc` 文書の base URL は親の URL なので、文書の隣に書かれた参照
  （`img/logo.png`）はそれだけでは開いたフォルダに届かない。変換の `RefResolver` が文書自身の
  ディレクトリに対して解決し、その結果を `convertFileSrc` へ渡す。2 つは同時に入り、片方だけでは
  成立しない — `dirname` が解決の基準点を出し、`resolvePath` が `.` と `..` を畳む — ので、
  片方を触るときは対で触る。WebView に Node の `path` は無く、この 2 つのために依存を足す価値も
  無いので、どちらも `/` と `\` の両方を区切りとして読む文字列操作になっている — ただし
  それは解決の相手であるディレクトリ側の話で、文書自身が書いた参照は `/` だけで分割する。
  HTML 文書が書くのはそちらだから。**`..` は
  構成要素から組み直すのではなくディレクトリの文字列を切り詰めて適用する**ので、ドライブレターや
  UNC 接頭辞が生き残る。ルートより上へは登らず、開いたフォルダより上へ登ることを特別扱いしないのは
  意図的で、読めるかどうかを決めるのは asset protocol の許可のほうだから。文書絶対パスの `/x.png`
  はそもそも書き換えない。その判断がここではなく `lib/html-doc` にあるのは、問いが「パスをどう
  繋ぐか」ではなく「その URL をどう扱うか」だから。**どの `RefSite` も数えない参照は二重に
  見えなくなる** — 書き換えられず、数にも入らない。`<link rel=stylesheet>` と `<script src>` は
  数えられる例外で、`REWRITTEN` は同じく届かないが `unrewritten` として数えるため、文書の隣の
  スタイルシートは通知バーの行を持つ。完全に抜け落ちるのは文書自身の CSS の `url()`・
  `<track src>`・`<input type=image src>`・インライン SVG の `<image>` / `<use>` で、
  通知バーの行を 1 つも伴わずに失敗する。decision-3 はこれを「黙って壊れたままにせず書き記す
  こと」と要求しており、README が CSS の場合を利用者に名指しで書いているのはそのため。
- **参照が届くかどうかを決めるのは、その属性を取りに行く CSP ディレクティブであって
  スキームではない。** だから `lib/html-doc` の `refTally` は `RefSite` を取り、
  数え上げは全部そこを通る。`img-src` は `https: http: data:` を運び、
  `media-src` は `'self' asset:` だけ、`style-src` / `script-src` はホストもスキームも運ばない。
  同じ `https://…` が `img src`・`img srcset`・`source srcset`・`video poster` では届き、
  `video src`・`audio src`・`<script src>` では拒否される。
  `<link rel=stylesheet>` 上の `//host/x.css` や `data:text/css` も拒否されるが、
  **`http(s)` だけを見る規則はこれを取りこぼす**。
  **`source src` は自分では答えを持たない** — `<picture>` の中なら `img-src`、
  `<video>` / `<audio>` の中なら `media-src` なので、親が決める。
  `blockedRefs` は届かないものを、`unresolvedLocalRefs` は書き換えないものを数え、
  リモート画像はどちらにも入らない（読み込まれるため）。
  **1 つの数に両方の結末をまとめると、通知バーはどちらについても正しくなれない。**
- **`counts.links` は「結末が確定している 2 クラス」だけを持ち、それ以外は持たない。**
  通知バーの数は、バーが説明を付けられるものでなければならないため。2 クラスとは、
  宛先へ届かない app-origin の href（`<a>` は親のリスナが動かない環境で無力化される
  — decision-10。裸のフラグメントもこれなので、文書自身の目次は数に入る。`<area>` は
  `href` そのものを外す — TASK-25）と、`frame-src` が拒否する `http(s)`（decision-9）。
  **`mailto:` / `tel:` は除外を続ける。これは計測の穴ではなく方針の問題である** —
  外部プロトコルスキームは 3 環境とも OS のアプリにいっさい渡らないことを TASK-23 が測った
  ので、残る論点は「何もしないリンクを数えるか」だけで、その方針は decision-10 の判断である。
  **`area[href]` は TASK-25 以降この数に入る。3 つ目のクラスではなく同じ 2 クラスである** —
  app-origin 側は分岐の前に決着するので、以前の実測（当てても当てなくても遷移する）とは違い
  「リンクは何もしない」と言う数の中に遷移するリンクが混じらない。`http(s)` 側は `<a>` の
  議論に乗る（`frame-src` は宛先に答えるのであって、要求した要素に答えるのではない）。
  **この半分も実測になった** — ビルド済みアプリで `<area href="https://…">` を押しても
  フレームは 3 プラットフォームとも動かなかった（2026-08-24、
  `_sandbox/samples/rendered-imagemap.html`）。**原因を「CSP」と名指しているのは macOS の
  1 本だけ**で、そこでは同じ領域が CSP を持たない `pnpm tauri dev` では遷移した。
  他の 2 本はその対照を伴わない結果である。
  **`imgSrc` のプロトコル相対参照は同じ理由で黙っている** — 親の base URL によって
  WebKit では `tauri://host/x`（拒否）、WebView2 では `http://host/x`（許可）になり、
  TASK-23 で 3 環境ともそう実測されたので、数えるとどちらかのプラットフォームで必ず誤る。
- **描画表示の中の動画は、絵は出るが再生されない。これは書き換えの失敗ではない。**
  TASK-5.1 の目視 2 巡目（2026-08-19、macOS / WKWebView、ビルド済みアプリ）では、poster を
  持たない `<video src>` と入れ子の `<source src>` がどちらもファイルの最初のフレームを
  描いた — つまりその参照は書き換えられて取得されており、これが同タスクの AC #6 を閉じた —
  うえで、コントロールを押しても何も起きなかった。同じファイルを mallow で直接開けば再生する
  （`MediaView` は同じ asset protocol を使い、フレームを挟まない）。**測ったのは macOS だけ**で、
  WebView2 と WebKitGTK は未計測。原因は `RefResolver` の不具合ではなく decision-9 と同じ系統
  （WebKit はメディアコントロールをスクリプトで実装しており、フレームはスクリプトを一切
  走らせない）と見ているが、これは推定なので確定として書かないこと。また、これを根拠に
  書き換え側へ手を入れないこと。README にも同じことを書いてある — 最初のフレームを描いておいてボタンに
  応答しないプレーヤーは、sandbox が断ったものではなく不具合として読まれるため。
- **ネイティブウィンドウタイトルの書き手は `Viewer` 1 つだけで、より良い label を知っている
  ビューはそれを上へ報告する。** `HtmlView` は変換が既に読んだ `<title>` を
  `onDocumentTitle` で渡すだけで、`setWindowTitle` を呼ばず、文書を 2 度目に解析もしない
  （`lib/title` の `frontMatterTitle` は markdown 以外の種別に `null` を返すので、
  `documentTitle` だけでは常にファイル名になる）。label を落とすのは**パスが変わったとき**で、
  ウォッチャの reload token では落とさない — 内容が変わっていない再読み込みは新しい変換を
  生まないので、報告し直すものが無くタイトルがファイル名に落ちてしまう。
- **`TableView` の上限は定数 4 本で、`SourceView` と違って内容そのものを落とす。**
  `TABLE_MAX_ROWS`（5,000）・`TABLE_MAX_COLUMNS`（100）・`TABLE_MAX_CELLS`（20,000）・
  `TABLE_MAX_CELL_CHARS`（500）が `lib/delimited` にある。4 本要るのは、前の 2 本が
  掛け合わさること（100 列 5,000 行は両方を満たしたうえで DOM セル 50 万個になる）と、
  セルの「個数」を縛っても 1 個が持つ「文字数」は縛れないこと — 閉じない引用符は
  ファイル末尾まで続く 1 フィールドなので、10 MiB の文書が前 3 本を満たしたまま
  折り返す 1 セルになりうる（decision-7）。`tableExtent` が前 3 本をまとめて適用するので
  表が横に広いほど行数は下がり、4 本目は保持した値を切って末尾に省略記号を残す。**「さらに表示」は意図的に持たない** —
  切替のソース側が文書全体に大きさによらず届くためで、表の上の告知もそう述べる。
  `parseDelimited` は全レコード・全フィールドを数えるが、描けるぶんしか組み立てない。
  よって告知の行数・列数は上限に依存せず、病的なファイルでも描かないフィールドの分は確保しない。
  `clippedCells` だけは例外で、パーサが保持したセルを数えるので、画面に見えるより多くを
  報告しうる（他の 2 案がどちらも劣る理由は decision-7）。
- **`XmlView` は WebView の `DOMParser` で解析し、それに触れる唯一の場所である。**
  その下はすべて `DomNodeLike`（`lib/xml-tree` が読む DOM ノードの構造的部分集合。
  実際の `Document` がそのまま満たし、単体テストはオブジェクトリテラルで書ける）を
  受け取る。この分割があるから変換と上限を jsdom なしの Node で検証できる。
  ツリーの上限は `XML_MAX_NODES`（20,000）・`XML_MAX_ATTRIBUTES`（64）・
  `XML_MAX_VALUE_CHARS`（500）。**属性はノード予算を 1 消費し、かつ 1 要素あたりでも切る** —
  縛るものが違うためで、予算は「多数の要素に散った 100 万個」を、要素ごとの上限は
  「1 行に載る 2 万個」を止める（属性はインラインに出るのでその行は折り返さない）。
  64 は実測値（走査した 826,427 要素のうち最大は 14。decision-8）。
  予算を超えたノードは数えるだけで組み立てない。
  走査が再帰でなく反復なのは、入れ子の深さを決めるのが文書の側だからである。
  空白だけのテキストノードは落とし、CDATA は中身によらず残す。行の外枠（`cfg-*`）と
  `lib/config-tree` の開示定数は config ツリーと意図的に共有している。
- **`.plist` だけはビューを中身で決める。** property list の形式は XML・バイナリ・OpenStep で、
  さらに `plutil -convert json` が吐いた JSON も同じ拡張子で置かれる。バイナリは `read_file` の
  magic 判定が答えるので、残る 2 つのテキスト形式を `lib/file` の `isJsonPlist` が分ける —
  最初の非空白文字が `{` か `[` なら `ConfigView`、それ以外は `XmlView`。**中身を見るのは `.plist` だけ**で、
  `{` で始まる `.xml` は壊れた XML としてエラーバナーを出す（decision-8）。
  よって **`file.kind` だけでは画面に出ているビューが決まらない**。
- **JSON の構文エラー位置は 2 つの情報源から来るが、valid かどうかを決めるのは
  片方だけである。** 判定の門は `JSON.parse` で、`parseJson` はそれを呼び、`.json`
  ファイルが valid なのはそれが受理したときだけ — よってコメントと末尾カンマは
  引き続きエラーである。throw した後で「どこか」を答えるのが `jsonErrorPosition` で、
  まずエンジン自身の文言を読み、文言が位置を名指ししないときだけ
  **strict jsonc 走査**（`jsonc-parser` を
  `allowTrailingComma: false, disallowComments: true` で呼ぶ）に落ちる。
  最初に報告された offset だけを行に変える。**この走査が形式を広げることは
  ありえない — そこへ至る経路が `JSON.parse` の throw から始まる 1 本だけだから**で、
  「valid JSON の範囲は変わらない」が実測の一致表ではなく構造で保証されるのはこのため
  （実測もした: 30 形状で判定が全件一致し、両者が位置を出す 4 件では位置も一致）。
  **文言が位置を名指ししているときはエンジンの位置を採る** — バナーが出す文言はエンジンの
  ものなので、別の場所を指す矢印は読み手に見える食い違いになる。文言が位置について何も
  言わなければ、食い違う相手がいない。**文言のパターンはエンジンが書く形に
  アンカーしてあり、これは整形ではなく効いている**: V8 の位置なし文言は文書の抜粋を
  引用する（`Unexpected token 'p', "{"a": position 3}" is not valid JSON`）ので、
  素の `/position (\d+)/` は**文書自身の文字列**を読んでしまう — 失敗位置の 7 列目では
  なく 4 列目を指し、しかも正解を持っていた走査に落ちなくなる。よって座標は
  「文言の末尾にある `at position N` / `at line N column M`」としてしか認めず、抜粋を
  含む一族は常に末尾に付く `is not valid JSON` で丸ごと拒否する（この一族が座標を
  持つことは無いので失うものが無い）。**走査は 2 つ下の `parse` ではなく `visit` を
  通す** — `parse` は復旧した値を組み立てるので、先頭で失敗する 10 MiB の壊れた配列では
  次の行で捨てる値のために 130 MiB のヒープと 406 ms を使う。`visit` は同じ offset を
  返して何も確保しない。`parseJsoncText` が `parse` のままなのは、あちらは値が要るため。
  **両方が答えないこともあり、そのときバナーは位置
  なしで出る** — これが存在する前より稀になったので、実ファイル任せにせずユニットテストで
  覆っている。**文言はエンジンごとに違い、Node 上のテストからは V8 のものしか見えない**
  ため `jsonErrorPosition` を export している（JavaScriptCore の
  `JSON Parse error: …` はここでは作れない）。`parseJsonl` も列を同じヘルパから取り、
  `JSON.parse` へ**トリム済みの写しではなく生の行**を渡すので、offset をインデント分
  ずらす必要が無い。以前の固定値 `column: 1` は推測された位置だったので消えた
  （decision-12）。
- **XML の構文エラーは行番号を伴わないことが正当にありうる。** DOM は失敗を
  `<parsererror>` 要素として返すだけで、位置を得る API は無い。位置はメッセージ文中に
  しか存在しないので、`xmlErrorInfo` がそれを読み戻し、読めないことを許容する。
  読めなければバナーは位置なしで出し、行の強調も行わない。エラー文書の判定は要素名
  ではなく名前空間で行う — 正しい文書が自前の `parsererror` 要素を含みうるためである。
  3 つの WebView は現状いずれも libxml2 を使うので文言は 1 種類だが、それは契約では
  なく、確認は TASK-7 の WebView 横断検証で行う。位置を得るために XML パーサ依存を
  足さないこと（decision-8）。**これは JSON と別の方針ではなく、同じ規則が別の答えに
  なっているだけである** — 依存を足さず、文面からの推測もせずに位置が得られる限り
  それを出す（decision-12）。JSON には strict なパーサが既に木の中にあり、XML には無い。
  よって別の理由で XML パーサが入る日が来れば、XML も位置を出す義務を負う。
- **ウィンドウごとのイベント配送は 2 つで 1 組であり、Rust 側だけでは
  「できたように見えて壊れている」状態になる。** `watch.rs` は
  `emit_to(label, …)` で `fs:change` を emit し、`lib/watch.ts` は
  `getCurrentWebviewWindow().listen` で受ける。`EventTarget::Any` で登録された
  リスナは emit 側が何で絞ったかにかかわらずマッチする —
  `match_any_or_filter` が filter を見る前に `Any` で短絡する
  （tauri 2.11.3 `src/event/listener.rs:305-311`） — そして
  `@tauri-apps/api` の素の `listen()` はまさにその target で登録するので、
  Rust がどれだけ狭く emit しても他のウィンドウの変更を受け続ける。
  **これは一律の規則ではない**: 全ウィンドウへ届けたいイベントは同じ `Any` の
  挙動に乗るので、リスナの target はイベントごとの判断である。registry は
  **ハンドルの型に対してジェネリック**にしてあり、insert / replace / remove を
  GUI なしで検査できる — 自分の drop を報告する probe ハンドルを使う。drop は
  registry から見た「watch が止まった」状態そのものであり、
  `RecommendedWatcher` は自分が drop されたことを報告できない。
- **メニューは 1 つのオブジェクト・3 つの構成・1 つの配送規則であり、
  その 3 つにはそれぞれ「正しく見えて間違っている」形がある。**
  `AppHandle::set_menu` はアプリ全体に効き、明示的にメニューを与えられていない
  ウィンドウに割り当てる（tauri-2.11.3 `src/app.rs:956-961`）。だから
  **旧 macOS の `cfg` を外すだけなら、About / Services / Hide / Show All を載せた
  メニューバーが Windows と Linux に出ていた** — どれも macOS の概念で、
  コンパイルは通るが意味を持たない。構成は 3 つ: macOS は今までのアプリサブメニューを
  保ち、File・Edit と、`set_as_windows_menu_for_nsapp` で登録する Window サブメニューを
  得る。**AppKit が開いているウィンドウの一覧を足すのはこの登録のためであり、
  かつこの登録はメニューがアプリの main menu になるまで黙って何もしない** —
  muda は `NSApplication.mainMenu()` とその delegate 経由で NSMenu を解決し
  （muda-0.19.3 `src/platform_impl/macos/mod.rs:741-746`）、main menu が無ければ
  何もせずに返る。だから登録は `set_menu` の後で、メニューを組んでいる最中ではない。Windows と Linux はアプリサブメニューを持たず、
  Settings… と Exit を File の中に、About を Help の下に置く。
  **Linux だけは違いが一覧ではなく規則である**: muda の GTK バックエンドは
  predefined の種別のうち Separator・Copy・Cut・Paste・SelectAll・About しか
  対応せず（muda-0.19.3 `src/platform_impl/gtk/mod.rs:30-49`）、
  **それ以外は append 時に失敗ではなく黙って飛ばす**。だから Quit は
  `AppHandle::exit` を呼ぶ普通の item であり、**Undo と Redo は壊れているのではなく
  端から無い** — 並べれば表示されない項目を持つメニューができ、普通の item に
  置き換えれば、編集可能なフィールドが 1 つしかないアプリのために WebView の
  undo スタックを Rust から駆動することになる。失敗の形は一貫して
  「項目が無い」であり、Linux のビルドを見なければ分からない。
  **`CmdOrCtrl+W` は macOS だけ predefined で、他は普通の item** —
  muda は predefined item のアクセラレータを型から導出し setter を持たない
  （`src/items/predefined.rs:331-337`）ので、macOS で `CmdOrCtrl+W`、
  他では `Alt+F4` になる。decision-4 は TASK-13.3 が来た時点でこの binding を
  Close Tab へ移し、Close Window を `CmdOrCtrl+Shift+W` にすると決めており、
  それを持てる predefined item は無い — つまりその回に macOS の分岐は、
  他 2 環境が既に使っている普通の item へ置き換わる。
  **ただし普通の item のアクセラレータは Windows に届かない**（2026-09-12 実測）:
  メニュー項目自体は効くのに `Ctrl+W` では何も閉じず、効いた 3 つの chord は
  ちょうど `App` が `keydown` handler も登録しているものだった — つまり muda の
  アクセラレータは WebView2 にフォーカスがあるウィンドウへ届かず、そこで
  実際に閉じているのは `lib/close-window` である。**Linux ではアクセラレータが
  届く** — このモジュールが出来る前から `Ctrl+W` でウィンドウが閉じていた —
  ので、これは muda ではなく WebView2 の穴であり、`Ctrl+P` と同じ形である。
  **Linux の 1 打鍵に答える層は片方だけである** — 2026-09-12、ウィンドウ 2 つで
  実測: `Ctrl+N` 1 回でウィンドウは 1 つ開き、`Ctrl+W` 1 回で 1 つ閉じた。
  **検査たらしめたのはウィンドウ 2 つであり**、結果が無害だったいまも
  その理由は残す価値がある: `Ctrl+W` が重複した場合、同じウィンドウを 2 回
  閉じるのではない。メニュー経路は配送先を**遅れて**解決するからで、
  `focused_window` が走るのはキューに積まれたメニューイベントが配送される時点
  （`src/app.rs:2350-2351`、配送は `:2588`）。つまりこのウィンドウを閉じ、
  続いてフォーカスが移った方を閉じることになる。ウィンドウ 1 つではそれを
  見せられず、そこで 1 打鍵で 1 つ開いても何も決まらない。
  **どちらの層が動いているかは未実測で、知る必要も無い。**WebView2 が `Ctrl+W` を自分で
  食べているのか、アクセラレータ表が参照されないのかは**未実測**で、chord を
  消費することでその問いは無効になる。**登録しないことは不活性化ではなく譲渡である**
  という規則の 3 度目の支払い。この chord は capability に
  `core:window:allow-close` を要する（core window の default セットは読み取り系だけで、
  変更系を 1 つも含まない）。**Undo と Redo は Linux にだけ無い。**
  これは選択ではなく GTK の都合である — muda のバックエンドはどちらの種別も持たず
  append 時に飛ばすので、並べれば先頭 2 項目が描かれないサブメニューになる。
  「mallow には undo するものが無い」という理由で全環境から消しかけた
  **が、その理由は誤っていた。記録する価値のある誤り方である**:
  mallow **自身の** UI に編集可能な欄が無いのは正しいが、レンダリング済み HTML
  ビューが表示している文書は `<input>` や `contenteditable` を持ちうる。そして
  **フレームの sandbox はそれらを読み取り専用にしない — `allow-forms` が制限するのは
  フォームの*送信*であって、入力そのものではない。** メニュー項目がその内容に
  届くかはどの環境でも実測されていないので、元のまま残す — 消すことは、
  誰も見ていない挙動についての仮定に基づいて動くことだった。
  **配送先の解決は `webview_windows()` を通す。** `Manager::get_focused_window` は
  このプロジェクトが有効にしていない `unstable` cargo feature の裏にあり、
  tauri は minor で壊してよいと明記している（`src/lib.rs:541-560`）。
  実装はこの走査そのものである。**Rust 側だけでは半分**であり、素の `listen()` で
  登録したリスナは `EventTarget::Any` を持ち、emit 側が何で絞ってもマッチする —
  メニューイベントを他のウィンドウから実際に締め出しているのは `useWindowEvent` で、
  `fs:change` が要るのと同じ対である。**ハンドラの中でウィンドウを組まない**:
  `WebviewWindowBuilder::from_config` は同期コマンド**およびイベントハンドラ**の
  中でデッドロックし（`src/webview/webview_window.rs:114-116`、wry#583）、
  このハンドラはその doc が名指ししているもう一方なので、New Window は
  `tauri::async_runtime::spawn` へ投げる。**メニューの変更はメインスレッドを待つ**
  （`src/menu/mod.rs:25-39` が marshal して返答を待つ。呼び出し側が既に
  メインスレッドなら inline で走る）。だから `record_recent` はサブメニューを
  更新する前に `RecentLock` を解放する — 握ったままだと、そのスレッドと
  メインスレッドの `Clear Recent` が互いの持ち物を待ち合う。
  **最近のフォルダの項目 id はフォルダのパスそのもの**で、添字ではない —
  添字は再構築のたびに同期し続ける id → パスの対応表を要し、
  古くなった対応表は違うフォルダを開く。2 つの id 空間は交わらない:
  ダイアログが返すパスは絶対パスで、固定 id はどれも英字で始まり区切り文字を
  含まない。加えて、そのフォールバック分岐は id を構築元の一覧と照合する。
  **`Print…` と `Export as PDF…` が見せる状態はウィンドウごとで、メニューはそうではない**
  ので、`report_markdown_preview` がウィンドウ label ごとに真偽を 1 つ記録し、
  項目が見せるのはフォーカスされたウィンドウの分である。単一の真偽なら、
  最後に報告したウィンドウの状態を見せることになる。**環境による打ち消しは
  印刷側だけ** — `Print…` は Linux で有効になりえず（`print.rs` が拒否するので、
  有効に見える項目は押しても何も起きない）、`Export as PDF…` は Linux でこそ
  唯一の紙への道である。**どの CI ジョブがどの分岐をコンパイルするかが、
  挙動と関係ない唯一の `cfg` を決めた**: `init`・`compose`・
  `register_windows_menu` は無人ビルドでも誰も呼ばないままコンパイルされる。
  Windows と macOS の Rust ツールチェーンを回す CI は `paper` ジョブだけで、
  それは `MALLOW_UNATTENDED=1` でビルドするので、括り出すと Windows 分岐を
  型検査するジョブが 1 つも無くなるからである。**各環境が実際にどう描くかは
  2026-09-12 に目視した** — 上の `Ctrl+W` の所見はそこから出たもので、
  同じ回に Linux の Exit があること、markdown プレビュー以外で 2 項目が
  disabled になることも確かめた。**メニューのアクセラレータとアプリ自身の
  `keydown` handler が 1 打鍵で両方発火する例はまだ見ていない** —
  `Cmd/Ctrl+N` 1 回でウィンドウは 1 つだけ開き、Windows の `Ctrl+W` は
  そこで問いが立たない理由を示している（アクセラレータがそもそも届かない）。
  それでも handler は残す — 外せば `Ctrl+P` を WebView2 に譲り渡すことになり、
  それは一度出荷された実測済みの不具合（`lib/print`）だからである。
- **設定はアプリ全体のものであり、それを成立させるブロードキャストは、この
  アプリで意図的にフィルタしない唯一の `emit` である。** `settings.rs` の
  `broadcast_setting` が `settings:change` を全ウィンドウへ再発行する。これは
  `fs:change` と逆の判断で、理由も逆 — 2 つのウィンドウが watch を共有しては
  ならないのに対し、テーマは全ウィンドウで共有されなければならない
  （TASK-12 がウィンドウ単位のテーマ・言語を対象外にしている）。
  **発信元ウィンドウを外すのは変更が持つ stamp であって emit の絞り込みではない** —
  フロントは既定の `Any` で listen しており、`Any` はフィルタされた emit も
  等しく受けるので、ウィンドウ単位の `emit_to` では何も隔離されない。ウィンドウは
  自分の変更を適用する前に stamp を記録するので、`lib/settings-sync` の
  `changeToApply` はそれを「新しくないもの」として差し止める。**`storage` イベントは
  使わない** — 各ウィンドウは別の WebView で、WebView 間の storage 通知を
  3 エンジンで当てにはできない。
  **伝播する設定はすべて 2 つの半身を持ち、受信側は永続化しない方を取る** —
  `setTheme` に対する `applyTheme`、`setLang` に対する `applyLang`、
  `writeOutlineOpen` に対する `applyOutlineOpen`、絵文字は persist なしの経路。
  全ウィンドウが 1 つの WebView データストアと 1 つの settings.json を共有するので、
  イベントが届く時点で値は既に書かれている — 後から作られたウィンドウが伝播なしで
  正しく起動するのも同じ理由である。永続化する setter を通すと、二度書いた**うえに**
  エコーを送り返す。
  **`saveSetting` が自分でブロードキャストする**ので、store 側の設定
  （エクスプローラの幅と位置、カスタム絵文字フォルダ、起動時の更新確認）は
  呼び出し側に何も要らない。テーマ・言語・アウトラインの開閉は代わりに
  `ThemePicker`・`SettingsModal`・2 つのビューから送る — `lib/theme`・`lib/i18n`・
  `lib/outline-pref` に Tauri 層の依存を持ち込まないため。
  **`SettingChange` の store 側は `Settings` から導出する**ので、そこにキーを
  足すと `App` の switch が網羅でなくなり、新しい設定を扱うまでビルドが通らない —
  無視するウィンドウへ届く設定は、届かない設定より悪い。変更は `null` を運ぶことが
  あり、それは store から消された設定を意味するので、受信側は「何も保存されていない
  ウィンドウが見せる値」に着地する。
  **`lib/outline-pref` が `useState` 2 つではなくストアなのは**、`ThemePicker` が
  購読するのと同じ理由である。`MarkdownView` と `HtmlView` がそれぞれ自分の写しを
  持っていたが、「ビューをまたいで 1 つの設定」はウィンドウをまたいでも 1 つで
  なければならない。値をキャッシュするのは `useSyncExternalStore` が描画のたびに
  getter を呼ぶためで、到達できない localStorage は描画ごとに throw する**うえに**、
  いま適用された値ではなく既定値を答えてしまう。
  **変更は stamp で順序づけられ、それがウィンドウを収束させている。** 各ウィンドウは
  キーごとに「最後に適用したもの」を記録し、それより新しくないものは無視する
  （`lib/settings-sync` の `supersedes`）。これが無いと、近い時刻に 2 つの
  ウィンドウが同じ設定を変えたとき、各ウィンドウが自分の変更を適用してから
  相手の変更を到着順に適用するので、最後に変えたウィンドウが古い値で終わりうる。
  **これは人間の精度を要しない** — 最初の読みはここを外していた。ブロードキャストは
  クリックの瞬間に出るのではなく、カスタム絵文字フォルダは**読み込みが終わったとき**に
  出る（クリックからディレクトリ走査 1 回ぶん離れている）ので、離れた時刻の 2 つの
  変更が重なって届きうる。stamp が Rust で採番したカウンタではなく `Date.now()` なのは、
  ウィンドウが自分に変更を適用する**前**に存在していなければならないからで、
  カウンタは 1 往復してからしか返らず、その往復の中に届いた変更を判定できなくなる。
  `origin` は今も Rust が刻むので、どのウィンドウも他のラベルを騙れない。
  **同一ミリ秒の同点は label で割る** — 恣意的だが全ウィンドウで同一に割れる。
  収束はその性質に乗っている。
  **壁時計の巻き戻りは「1 回ぶん」の問題ではない。** 採番が「時計」と
  「そのキーについて既に知っている値 + 1」の最大値を取るのはそのためで、
  時計だけで打つと、実時間が追いつくまでそのウィンドウの変更はすべて
  peer の持つ値より古くなる — 全員に拒否され、自分にだけ適用され、
  巻き戻り幅のあいだ発散し続ける。
  **スナップショットは同一ミリ秒の同点をすべて落とす** — ウィンドウのラベルでは
  なく空の origin を持つ。同じミリ秒の読み出しと書き込みは時刻では順序づけられず、
  意図を持っているのは書き込みのほうだからである。
  **`saveSetting` は store への書き込みの後ではなく前に打刻する** — 呼び出し側は
  既に値を適用しているので、後に打つと、書き込み中に届いた変更のほうが新しいと
  判定され、それが適用されたまま、このウィンドウの後の stamp だけが値を
  再適用せずに記録されてしまう。
  **mount 時の読み出しも同じ順序に乗る。** listener を `loadSettings` の**前に**
  登録するのはそのためで、効果を隣に置くのでは足りない — その間に出た変更は
  何も listen していないウィンドウに届き、読み出し中に適用された変更は、
  追い越された答えに上書きされる。`snapshotStillCurrent` がスナップショットに
  「読み出しを発行した時刻」を刻み、同じ比較に通す。
- **capability のウィンドウ一覧は glob `w*` だけであり、`main` というラベルは
  もう存在しない。**
  `capabilities/default.json` はウィンドウラベルで plugin API をゲートするので、
  この一覧に載らないラベルのウィンドウは `store:default`（設定が永続化されない）・
  `dialog:default`（Open… が何もしない）・`opener:default`（外部リンクが死ぬ）・
  `core:window:allow-set-title`（タイトルが文書を追わなくなる）を失う —
  **そのウィンドウだけで**。だから単一ウィンドウの動作確認では捕まらない。
  `main` は TASK-12.7 で一覧から外れた — `"create": false` が全ウィンドウを
  「作られたウィンドウ」にしたのと同じ回である。
  **asset protocol のスコープにはウィンドウごとの項目が要らない**:
  `allow_media_dir` はアプリ全体の 1 つのスコープを加算的に広げるので、
  どのウィンドウが許可したフォルダもすべてのウィンドウから読める。しかも
  許可を求めたウィンドウが閉じても許可は残る — スコープに削除の API が無い。
  ツリーで利用者が選んだファイルしか描かないビューアにとって、どちらも欠陥ではない。
- **作られたウィンドウのラベルはスロットであり、付いてくる geometry がその代償である。**
  `open_window` は生きているウィンドウが持たず、作成中の予約も無い最小の `w<n>` を取る —
  builder が拒否するのは現に使用中のラベルだけなので（tauri-2.11.3
  `src/manager/window.rs:70-72`）、閉じたウィンドウのスロットの再利用は正当である。
  単調増加のカウンタの方が単純だが、ここでは誤りで、理由は 2 つとも TASK-12.7 から来る:
  window-state のファイルと restored session はどちらもラベルをキーにするので、
  増え続けるカウンタは開いたウィンドウの数だけ両方を太らせ、復元されたウィンドウに
  元の geometry を返せなくなる。**受け入れる帰結は、新しいウィンドウがそのスロットを
  最後に持っていたウィンドウの記憶された geometry を引き継ぐこと。**
  **ラベルはウィンドウが存在する前に予約する。** `webview_windows()` は build 済みの
  ウィンドウしか列挙しないので、同時に 2 つ作ると同じ `w<n>` が渡ってしまう。予約とは
  `WindowInitRegistry` のエントリそのもので、空で開くウィンドウでは値が `None` になる。
  解放は `take_window_init`・build の失敗・mount に到達しなかったウィンドウの
  `Destroyed` フックの 3 経路。**生きているウィンドウの集合は、この予約のロックの外ではなく
  内側で読む。** これが効くのは `open_window` が `async` で 2 つの生成が実際に重なるから:
  外で読むと、まさに困る形で古くなりうる — もう片方の生成が完了し、**かつ**その
  ウィンドウが pending のエントリを取った状態で、そのラベルが検査の両側どちらにも
  居なくなる。2 回目の `Cmd/Ctrl+N` は使用中のラベルを渡され、何も開かない。
  1 つのロックの下では両側が互いを覆う。**ラベルが `pending` を離れるのは、それが
  `live` で観測できるようになった後**（`build` はフロントが `take_window_init` を
  呼べるより先に manager のマップへ入れる）**か、二度と観測されえなくなった後**
  （build 失敗の経路）だけだからである。
- **同期コマンドからウィンドウを作ると Windows でデッドロックし、症状は
  「真っ白で閉じることもできないウィンドウ」である。** tauri-2.11.3 は関数自身の doc に
  そう書いている（`src/webview/webview_window.rs:114-116`、wry#583）。WebView2 の生成は
  メッセージループを回すので、WebView2 のハンドラの中 — tauri v2 のデスクトップ IPC は
  `ipc:` への `fetch` なので、同期コマンドの本体はそこで走る — から呼ぶと、その
  ループが既にスタックに載っている。2026-09-10 実測: Windows で `Ctrl+N` が
  真っ白な無反応ウィンドウを開き、**macOS と Linux では起きなかった** —
  **2 環境だけの確認はこれについて何も言わない。**
  `open_window` が `async` なのはこの理由だけであり、**doc は同期コマンドと並べて
  イベントハンドラも名指ししている** — TASK-12.4 が足す `on_menu_event` ハンドラが
  次にこれを再導入できる場所なので、メニュー項目はその場で build せず投げること。
  ずらし規則は変更の影響を受けなかった。コマンドが同期であることではなく、
  キューの順序に対して書いてあったからである。
- **空で作られたウィンドウと、何にも作られていないウィンドウは別物である。**
  今日はどちらも何も開かないが、2 つの答えは 1 つの答えではない。
  `take_window_init` は `open_window` が作ったウィンドウには `{ location }` を、
  そうでないウィンドウには `null` を返し、空で作られた場合は `{ location: null }`
  である。これを潰すことは、何にも作られていないウィンドウが保存済みフォルダへ
  落ちていた間、New Window の仕様を丸ごと失わせていた — 直前のフォルダの複製を
  開くのは、New Window がまさにそうしないために存在する動作である。
  **TASK-12.7 がその落とし先を消した** — 全ウィンドウが作られたウィンドウになったので、
  `null` は「このウィンドウの entry は既に取られた」＝ WebView のリロードだけを意味する。
  それぞれが何を開くかは今も `App` の mount 効果の中ではなく `lib/window-init` にある。
  そこが誤った場所であり、効果の中には何も届かないから。
- **restored session は 1 つのキー・1 つの規則・1 つの順序制約であり、3 つとも
  「正しく見えたまま間違っている」形を持つ。** キーは settings.json の `windows`
  (`session.rs`)で、**`lastFolder` / `lastFile` に並ぶのではなく置き換えた** —
  「どこにいたか」の真実が 2 つあることが、両者がずれていく仕組みそのものだから。
  ファイル側は `active` が 1 エントリを名指す**リスト**である。ここでは 1 ウィンドウが
  複数ファイルを開かないが、TASK-13 のタブは開く。decision-4 が形をここで確定させるのは、
  このキーが既に一度きりの移行と別プラグインのファイル書き換えを抱えており、
  タブが来たときにその 2 つをもう一度やる方が高くつくからである。
  **このアプリが開けないラベルの行は起動時に落とす** — settings.json は利用者が
  編集できるファイルで、`w1` が 2 行あれば 2 つ目の build がそのまま失敗し、
  `w*` glob の外のラベルは store もダイアログもタイトルも無いウィンドウを作る。
  それでも build が失敗した場合に起動ごと落とさないのは、ここが `setup` の中であり、
  `?` を書けばアプリが 1 つも開かないからである。
  **規則は呼び出し箇所ではなく述語である**: 表示中のフォルダか選択が変わったときに
  ウィンドウが報告する。フロントはフォルダ選択・mount 時に開く処理・TASK-12.5 の
  Open Recent の置き換えのそれぞれに呼び出しを置くのではなく、その 2 値を見る効果 1 つで
  満たす。3 つの呼び出しとして書けば 3 つ目が誰も覚えていないものになり、症状は静かである
  — フォルダを置き換え、終了し、復元したウィンドウは前のフォルダで戻ってくる。
  **何が抜けるかは last-window rule が決める**: `WindowEvent::Destroyed` で
  エントリを落とすのは、その時点でウィンドウマップが空でないときだけ。最後の
  ウィンドウのエントリは次の起動へ生き残る。置き換えた「`ExitRequested` でフラグを
  立てる」案は 4 つの quit 経路すべてに否定されており（TASK-12.7 が記録している）、
  **数えるのは「空でない」であって「2 つ以上」ではない** — ハンドラが走る時点で
  tauri は死にゆくウィンドウを既にマップから外しているので、素朴な条件は 1 つずれて
  永遠に何も落とさない。`RunEvent::Exit` はライブ集合を flush して `Store::save()` を
  **同期で**呼ぶ。store プラグインは自分の exit 保存をこのコードより先に終えており、
  `autoSave` はプロセスの終了に間に合わない debounce だからである。その間の変更は
  すべて**その場で書き抜ける**ので、クラッシュで失うものは `lastFolder` の頃と変わらない。
  **順序制約は session プラグインの登録位置である** — 状態を読む store の後、
  一度きりの移行が `.window-state.json` を書き換える window-state の前。あのプラグインは
  自分の setup でファイル全体を読み込み、exit でキャッシュを書き戻すので、後から
  書き換えても黙って上書きされる。プラグインの setup は登録順に走り、どれもアプリ自身の
  `setup` より前である。その移行は `main` エントリを最初の復元ラベルへ改名し、
  **改名できないときでも `main` を捨てる** — もうそのラベルを名乗るものは無く、
  放置すれば毎回の exit で書き戻され続けるから。設定側の移行は `lastFolder` /
  `lastFile` から 1 エントリの session を作って両キーを削除する。`lastFiles` /
  `lastActive` は意図的に読まない — それらを持つのは TASK-13.4 を先に入れた
  インストールだけで、TASK-13.4 は入っていないからである。
  **復元は 8 ウィンドウで頭打ち**にし、最後にフォーカスされた側から遠い順に落とす。
  復元されたウィンドウは 1 つで Shiki の WASM highlighter と mermaid インスタンスを
  自前の WebView に抱えるからである。**フォルダを開いていなかったウィンドウは
  復元する**（ウィンドウ数が正直に保たれ、空のウィンドウは初回起動が出すものと同じ）。
  フォルダが消えていたウィンドウは落とさず空で開き、どれが失ったのかを見せる。
  **無人ビルドは session を登録しない**のでどの入口も何もしない。計測実行は利用者の
  設定をそのまま残す。
- **initial location はちょうど 1 回だけ取られ、WebView のリロードは新しいウィンドウでは
  ない。** `open_window` がラベルの下に `{ folder, file }` を置き、作られたウィンドウが
  mount で取り除くので、**devtools のリロード後はウィンドウが location を開き直さず
  空で戻る。** これはパスを URL に載せないことの代償である。退けた代替
  （`index.html?folder=<encoded>`）はリロードを越えて残るが、任意のファイルパスを
  URL エンコードに通し、WebView が読み込んだアドレスに残す。機構自体は確定していて
  （TASK-12 の用語がこれを前提に書かれている）、TASK-13.4 が広げるのは運ぶ中身だけ —
  ファイル側が一覧＋どれがアクティブか、になる。
- **新しいウィンドウを spawner からずらすかは位置の比較で決める。「このスロットに
  記憶された geometry があるか」は訊けないし、ほぼ即座に真でなくなる。**
  tauri-plugin-window-state は `WindowState` と `WindowStateCache` を private に持ち
  （`src/lib.rs:76`・`:109`）、window-ready で見たラベルすべてに既定の state を入れ
  （`:437-445`）、`RunEvent::Exit` でキャッシュ全体を書く（`:501-504`）ので、
  一度使われたスロットは以後ずっとエントリを持つ。それを見る判定は、そのスロットの
  「史上初の使用」でしかずらさない。だから `offset_when_stacked_on` は作られた
  ウィンドウの outer position を spawner のそれと比べ、一致したときだけ動かす。
  **それが復元後の位置を読むことを保証するのは thread affinity ではなく順序である**:
  プラグインの復元は `on_window_ready` から走り、tauri はそれを
  `Window::run_on_main_thread` 経由で配送する（tauri-2.11.3
  `src/manager/window.rs:113-118`）。比較を投げる先は同じキューで、復元の方が先に
  入っている — 呼び出しが既にメインスレッドなら両方ともインライン、そうでなければ
  event proxy を通って FIFO（tauri-runtime-wry-2.11.3 `src/lib.rs:239-248`）。
  **ラベルが渡されなかった場合、つまり対話的な経路にだけ効く**: 復元経路には spawner が
  無く、利用者が意図して重ねたウィンドウは重なったまま戻らなければならない。
  **プラグインの `map_label` でラベルを畳まないこと**（`src/lib.rs:377`） —
  全ウィンドウが 1 つの geometry を共有することになり、復元された集合が最もそうであっては
  ならない状態になる。
- **最後のウィンドウを閉じるとアプリは終了する。macOS を含め全環境で同じ。**
  macOS の作法はメニューバーだけ残して生き続けることだが、見落としではなく選ばなかった:
  メニューバーのみの状態は「フォーカスされたウィンドウが無い状態で New Window が動く」
  ことを要求し、TASK-12.4 のメニューイベントの配送を複雑にする。
- 独自 Rust コマンドと core イベントは capabilities の許可不要。plugin/core API のみが
  ゲートされる（`src-tauri/capabilities/default.json` 参照）。

## 変更の検証

- フロント: `pnpm lint`（Biome）・`pnpm build`（tsc + vite）・`pnpm test`（Vitest）。
  ユニットテストはコードと同じ場所に `src/**/*.test.ts` として置き、純ロジックの
  モジュール（`markdown` ＝未信頼入力のセキュリティ境界含む・`config-parse`・
  `frontmatter`・`title`・`path`・`delimited`・`xml-tree`・
  `heading`＝座標変換のみ。`findHeading` は DOM のグローバルを要するため対象外・
  `chord`＝アクセラレータの一致判定とアプリ全体の handler。どちらもプラットフォームを
  引数で受けるので `navigator` を要しない・
  `window-init`＝3 つの生成状態それぞれでウィンドウが何を開くか・
  `markdown-preview`＝ゲートと、変化したときだけ通知すること（通知 1 回につき
  Rust への invoke が 1 回走る）・
  `print`・`pdf-export`・`new-window`・`close-window`＝各 chord のキー・ゲートと、
  イベントに対して handler が何をするか（`Print…` と `Export as PDF…` が一緒に開閉すること、
  New Window には閉じるゲートが無いことを含む）・
  `settings-sync`＝順序づけのみ。listener と emit は Tauri のもの・
  `outline-pref`＝キャッシュと通知・
  `custom-emoji`＝Tauri 層を
  モック）をカバーする。
  Node 環境で走るため jsdom/GUI は不要。markdown のテストはファイル先頭の `vi.setConfig` 1 行で
  タイムアウトを上げる — `it` ごとの第 3 引数では持たない（フォーマッタが 3 引数の呼び出しを
  複数行に展開する）し、`vitest.config.ts` にも置かない（他のスイートで固まったテストは
  5 秒で落ちてほしい）。
- バックエンド: `src-tauri/` 内で `cargo fmt --check`・`cargo check`・`cargo test`。
  `commands` モジュールにユニットテストがある（`tempfile` 依存を避けた
  自己クリーンアップ式の temp-dir ヘルパー）。`watch` の registry、`window` の
  ラベル採番・initial location の受け渡し、`menu` の id → 動作の対応と
  最近のフォルダの表示文字列（ホームの短縮と、Win32 が食べてしまう `&`）、
  `recent` の除去規則、`session` のライブ集合まわり（報告・
  フォーカス順・last-window rule・上限・移行の両半分）も GUI なしで検査する。
  後の 2 つができるのは、必要なものをアプリに訊かず引数で受けるから。
  **`unattended.rs` のテストは
  `cfg(unattended)`** なので素の `cargo test` では 1 度もコンパイルされない —
  紙のジョブが `MALLOW_UNATTENDED=1 cargo test` を走らせ、そこだけが実行場所である。
- **紙**（TASK-30）: `MALLOW_UNATTENDED=1 pnpm tauri build --debug --no-bundle --no-sign`
  で、文書を 1 つ開いて人手なしに PDF を書くバイナリができる —
  `./src-tauri/target/debug/mallow --document scripts/paper/print-pagebreaks.md
  --out paper.pdf --theme light` — そして
  `node scripts/paper/measure-paper.mjs paper.pdf --os macos --theme light` が
  その紙の合否を言う。**答えるのは数で決まることだけ**である: 最後の節があること、
  外殻の文字列が紙に出ていないこと、文字の大きさが `scripts/paper/baseline.json` の
  **その環境自身**の基準から 5% 以内であること、暴走サイズでないこと、Windows では
  WebView2 のヘッダ・フッタが無いこと。**基準は環境ごとに持つ。これは整頓ではなく実測で**、
  この機械の macOS の紙は 18.56、CI ランナーの同じ文書は 21.00 で、**間違った方を当てると
  このタスクが追った 0.847 倍の縮小が 4.2% 差に収まり、許容内で通ってしまう**。
  エントリの無いキーは記録するだけで落とさない — 最初の紙が基準を作る回で、
  人がそれを見て正しいと言うのが先だからである。**ただし大きな声で言う** —
  飛ばしっぱなしの検査は 2 度と走らない検査だからで、`baseline.json` の `_required`
  がその状態を終わらせる仕掛けである（載っているキーにエントリが無ければ、
  飛ばさずに落ちる。キーは数字と同時に載せる）。**2026-09-09 時点で受け入れ済みは
  `ci-macos` だけ** — Linux ランナーの紙は本文が 18pt から始まり（他はすべて 16mm）
  `@page` があの分岐に届いていないので、文字サイズは測るが判定しない。Windows
  ランナーの紙には欠陥の記録は無く、単にまだ受け入れていない。
  **Windows は無人モードのテストをビルドするだけで実行しない**: テスト実行ファイルは
  `target/debug/deps` から起動して `0xc0000139`（STATUS_ENTRYPOINT_NOT_FOUND）で落ちる
  — アプリの隣にある WebView2 のローダがそこには無いためである。あそこで最も重要なのは
  コンパイルが通ること（このジョブがあの分岐で捕まえた欠陥は 2 つともコンパイルエラー
  だった）で、テスト自体は環境に依らないので他の 2 ランナーが実行する。総ページ数と用紙サイズは判定せず記録する — ランナーの
  日本語フォントは別物で、ページ割りが変わるからである。**文字が読みやすいか、
  ページ境界を跨いだ表がどう見えるかは、PDF を開く人に残る。** **poppler の** `pdfinfo`・`pdftotext` が要り、**それであることを確認する** —
  Windows のランナーは Xpdf の `pdftotext` を持っており、あれには `-bbox` が無いので、
  あそこでの初回は計測ではなく usage 画面で終わった。**どの実装を握っているか分からない
  計器は、間違ったことを自信を持って報告する。**
- エンドツーエンド: `pnpm tauri dev`（GUI）または `pnpm tauri build`。
- CI（`.github/workflows/check.yml`）が pull request と `main` への push で
  ちょうどこの一覧を走らせる — `biome ci`・`pnpm build`・`pnpm test`・
  `cargo fmt --check`・`cargo check`・`cargo test`。**3 つ目のジョブ `paper`** は
  上の 2 コマンドを macOS・Windows・Linux で light と dark の両方に対して走らせ、
  PDF を artifact に残す。**毎 PR では走らない** — 3 環境の Rust ビルドは他の 2 ジョブの
  数倍かかるので、`paper-paths` ジョブが base との差分を見て、紙に関わる入力が
  変わったときと `workflow_dispatch` のときだけ matrix が回る。**CI が `pdf.rs` の
  Windows と macOS の分岐をコンパイルする唯一の場所**でもある（もう 1 つの Rust
  ジョブは ubuntu なので）。ここに書いてあるものと
  強制されるものが乖離しないようにするためなので、**検査を足すときは
  この一覧とそのワークフローを同時に直す。**

## リリース（macOS 署名）

macOS ビルドを Gatekeeper 警告なしで起動させるには、**Developer ID Application**
証明書で署名し、Apple による**公証 (notarization)** を受ける必要がある（App Store
外配布の場合）。適切な環境変数が揃っていれば Tauri が両方を自動で行う:

1. **前提** — Xcode Command Line Tools（`xcode-select --install`）と、login
   keychain 内の「Developer ID Application」証明書＋秘密鍵（`security find-identity
   -v -p codesigning` で確認）。「Apple Development」/「Apple Distribution」証明書
   では公証できない。公証には app-specific password も必要（appleid.apple.com →
   サインインとセキュリティ）。
2. **設定** — `.env.signing.example` を `.env.signing`（git 無視）へコピーし、
   `APPLE_SIGNING_IDENTITY` / `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` を
   記入する。資格情報はローカルに留まり、アカウント固有の値はコミットしない。
   同じファイルは更新署名の 2 変数も持つ（下の「署名付きの自己更新」）。macOS の
   資格情報だからではなく、このファイルを export する唯一のスクリプトが
   `macos-sign-build.sh` だからで、Windows や Linux でバンドルする貢献者は
   手で export する。
3. **ビルド** — `./scripts/macos-sign-build.sh`（`pnpm tauri build` のラッパ）。
   Tauri が hardened runtime（`bundle.macOS.hardenedRuntime` は既定 `true`）で署名し、
   公証してチケットを staple する。初回の公証は数分かかることがある。**Tauri は
   `.app` は公証するが、それを包む `.dmg` は公証しない**（未公証の DMG は開いた時点で
   Gatekeeper に弾かれる）ため、スクリプトが生成後の各 `.dmg` を公証 + staple する。
4. **検証** — `src-tauri/target/release/bundle/` 配下の `.app` / `.dmg`:
   - `codesign -dv --verbose=4 <app>` → `Authority=Developer ID Application`、
     `flags=…(runtime)`。
   - `spctl -a -vvv -t install <app>` → `source=Notarized Developer ID`。
   - `spctl -a -t open --context context:primary-signature -vvv <dmg>` →
     `accepted / source=Notarized Developer ID`（DMG 側の判定はこれで確認）。
   - `xcrun stapler validate <app-or-dmg>` → `The validate action worked!`。

既定ビルドでは独自の entitlements ファイルは不要。もし公証済みビルドが hardened
runtime 下で起動に失敗する場合は `bundle.macOS.entitlements` で追加する。

### GitHub Actions によるクロスプラットフォームリリース

`.github/workflows/release.yml` が macOS（Apple Silicon と Intel の両方を含む
universal な `.dmg` 1 つ）/ Windows（x86_64 のみ）/ Linux（**x86_64 と arm64 の
両方**。それぞれ deb・rpm・AppImage）のバンドルをビルドし、**Draft** の GitHub
リリースに添付する（内容を確認してから手動で公開）。
`v*` タグの push、または Actions タブからタグを指定した手動実行で起動する。
`tauri-apps/tauri-action` を使い、macOS の `.dmg` は後段のステップで公証 + staple
してから `gh release upload --clobber` で差し替える（ローカルスクリプトと同じ穴埋め）。
各バンドルには updater 資産とその `.sig` が付き、リリース全体で `latest.json` が
1 つ付く — その生成のどこが壊れやすいかは下の「署名付きの自己更新」。
Linux は 2 ジョブとも `ubuntu-24.04` 系イメージで動くので、Linux のバンドルは
glibc 2.39 を要求する。Ubuntu 22 の 2.35 より下限を上げた理由はワークフローの
matrix コメントが正本。`ubuntu-24.04-arm` ラベルは public リポジトリでしか解決しない。

初回設定 — macOS ランナーは以下のリポジトリ Secrets がある時だけ署名・公証する。
`scripts/setup-ci-signing-secrets.sh path/to/DeveloperID.p12` が `.env.signing` と
書き出した `.p12` から Apple 側の 6 つを登録する（値は一切表示しない）。
その下の更新用 2 つはこのスクリプトでは登録せず手で設定する — スクリプトは `.p12`
を必須引数に取るので、更新鍵だけを回すのに証明書ごと要求することになる:

- `APPLE_CERTIFICATE` — Developer ID Application の `.p12` を base64 化したもの
  （キーチェーンアクセス → 自分の証明書 → 書き出す…）。
- `APPLE_CERTIFICATE_PASSWORD` — その `.p12` の書き出しパスワード。
- `APPLE_SIGNING_IDENTITY` — 証明書の Common Name。`.p12` から導出する
  （`.env.signing` の値はコピーしない: CI は取り込んだ証明書の Common Name を
  文字列一致で照合するため、ローカル署名で有効な SHA-1 ハッシュだと失敗する）。
- `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` — `.env.signing` と同じ値。
- `TAURI_SIGNING_PRIVATE_KEY` — updater 資産に署名する minisign の秘密鍵
  （`gh secret set TAURI_SIGNING_PRIVATE_KEY < path/to/key`）。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — そのパスワード。**省略できない**:
  tauri-cli は未設定のとき空パスワードを代入するので、未設定だとエラーではなく
  「どのクライアントも受け付けない署名」が出荷される。

リリース手順: `pnpm release <patch|minor|major|X.Y.Z>`
（`scripts/release-version.mjs`）。バージョンが書かれた **4か所すべて**
（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` /
`src-tauri/Cargo.lock`）を更新してコミットし、`vX.Y.Z` タグを打つ。`--push`
を付ければ push まで行う（付けない場合は push コマンドを表示する）。デフォルト
ブランチ以外・作業ツリーが汚れている・タグが既に存在する場合は実行を拒否する。
`--dry-run` で変更内容だけ確認できる。4か所を同時に上げることが重要で、
**Tauri は成果物の名前をタグではなく `tauri.conf.json` の version から作る**
ため、バージョンを上げずにタグだけ打つと旧バージョン名のファイルが公開される。
`create-release` ジョブでもタグとマニフェストの一致を検査し、ビルド前に失敗させる。
Windows / Linux バンドルはコード署名されていない（updater 資産の署名とは別物）。
Draft のリリースノートは前回タグ以降にマージされた PR から生成され、`.github/release.yml`
に従いラベルで分類される（PR に `feature` / `bug` / `documentation` を付けると振り分けられ、
それ以外は "Other Changes" に入る）。
更新の届き方が変わるリリースには、生成ノートが作れない 1 文を手で足す必要がある:
v0.7.0 は updater を積んだ最初のリリースなので、**それより前のバージョンを使っている
人のバイナリは更新を問う機能そのものを持たず、1 度だけ手でダウンロードしない限り
更新チャネルが届かない**という文である。

**Windows バンドルに署名が無いことの代償は README の 1 文であり、そこに関わる
SmartScreen の事象は 3 つあって 1 つではない。** ブラウザがリリース資産を受け取る
段階が**ダウンロード時の警告**、受け取ったインストーラを起動する段階が**実行時の
警告**、アプリ内更新でインストーラが動く段階が**更新経路の警告**である。
**実測されているのは最初の 1 つだけ**（Edge・v0.7.0・2026-08-25）:
`Publisher: Unknown` と表示され、見えているボタンは `Cancel` と `Delete` だけで、
`Delete` のドロップダウンの中に `Keep anyway` がある。**README がそのドロップダウンの
場所まで書くのはこのため**で、「警告が出るが続行できる」では足りない。`Cancel` と
`Delete` しか見えない読み手はファイルを入手できないと結論し、実際に一度そうなった。
残り 2 つの事象は未実測で、`.msi`・Edge 以外のブラウザ・コード署名で消えるかどうかも
同じく未実測である。SmartScreen は評判で判定するので、**署名すれば直ると書かない** —
`Publisher: Unknown` は署名の無いバンドルの表示であって、それが警告の十分条件である
こととは別である。

### 署名付きの自己更新（更新チャネル）

`bundle.createUpdaterArtifacts` が有効で、`tauri.conf.json` の
`plugins.updater.pubkey` が minisign の**公開**鍵を持つので、リリースビルドは
updater 資産（macOS では `mallow.app.tar.gz`）を作って署名する。endpoint は
`https://github.com/serendipitynz/mallow/releases/latest/download/latest.json`
で、GitHub は `latest` を**公開済み・非プレリリース**のリリースにだけ解決する —
Draft を公開することが配布の開始そのものであり、**Draft のままでは更新経路について
何も確かめられない。**

**秘密鍵には回復経路が無い。** クライアントは自分に焼かれた公開鍵だけを信じるので、
秘密鍵を失っても**回しても**、既に入っている全コピーが更新を受け取れなくなり、
復旧は各利用者の手動再インストールだけになる。Developer ID 証明書とは別物であり、
同じ扱いをしてはいけない。

**鍵の置き場所は 2 つだけ。** CI が署名に使うリポジトリの Secrets と、この機械の外に
保守者が持つ控え — 控えはこの 1 つきりである。リポジトリの中には無く、
`.env.signing.example` にも無く（更新用の 2 つの値は意図的に空）、セッションの記録・
Issue・PR に貼ってはならない。再発行に相当する経路が無いので、**これは障害対応の
問題ではなくバックアップの問題**である。失った場合の復旧は、全利用者に手で
再インストールしてもらうことだけ。

公開鍵をコミットすると、秘密鍵を**持たない**ビルドの挙動が変わる。3 つの失敗は
同じ形をしていない:

- **`TAURI_SIGNING_PRIVATE_KEY` が無い** — ビルドは止まる。
- **鍵はありパスワードが無く、CI の外** — tauri-cli が対話プロンプトで待つので、
  非対話の `scripts/macos-sign-build.sh` はハングする。
- **公開鍵と一致しない秘密鍵** — 警告 1 行でビルドは**成功し**、実行時にどの
  クライアントも拒否する署名が出荷される。`.env.signing.example` が両方の値を
  **空**にしてあるのはこのためで、コピーしたファイルは 3 番目で静かに失敗する
  代わりに 1 番目で明示的に失敗する。

`tauri build --no-sign` は鍵を持たない貢献者がローカルでバンドルできなくなるのを
防ぐ — `Updater signing is skipped due to --no-sign flag` を出力し、`.sig` の無い
`.app.tar.gz` を作る。**コード署名も同時に飛ばす**ので、貢献者の逃げ道であって
リリース経路ではない。

**公開鍵をコミットしたことで `.env.signing` はローカルのバンドルの一部にもなった** —
署名付きリリースだけのものではない。環境に秘密鍵が無いまま素のビルドを叩くと止まる。
このファイルを export するのは `scripts/macos-sign-build.sh` だけなので、
`tauri build` を直接叩くときは自分で source する
（`set -a; . ./.env.signing; set +a`。公証を避けるならそのあと `APPLE_*` を `unset`）。
Windows や Linux でバンドルする貢献者は更新用の 2 変数を自分で export する。
**これを落とすと「秘密鍵が無い」に見える** — export されていないファイルには見えない。

**`latest.json` の契約は decision-11 が正本**で、そこで決めた 3 つはいずれも
ビルドを失敗させずに壊れる。build matrix に `max-parallel: 1` を置いているのは、
各ジョブがこの 1 つの資産を lock 無しで read-modify-write するためで、並行させると
lost update が起きて 1 プラットフォーム欠けたリリースが出荷され、リリースページは
完全に見える。`tagName` を `releaseId` と併せて渡してダウンロード URL を自分の
タグへ固定する。渡さないと URL はダウンロード時点の最新へ解決するので、updater
資産を持たない版を次に出した瞬間に旧版クライアントの URL がすべて 404 になる。
そして `finalize-updater-json` ジョブが bare な `linux-x86_64` /
`linux-aarch64` キーを削る — これは自分のエントリを持たない Linux install が
落ちる先で、中身は AppImage なので、deb の install が AppImage のバイトで
自分を上書きすることになる。このジョブは期待するプラットフォームや署名が
欠けたときにも失敗するので、lost update は「黙って不完全なリリース」ではなく
赤いジョブになる。
**期待する集合には Linux の両アーキテクチャが入る** — arm64 のジョブも 4 番目の
書き手であり、いま削った bare キーがその唯一の落ち先だったから。**v0.7.0 から
rpm も入る** — decision-11 は「実リリースが現れるかを示すまで」rpm を外していたが、
その版が `linux-x86_64-rpm` と `linux-aarch64-rpm` を載せて出た。README が rpm の
利用者に「更新は届く」と言う以上、上流が `.rpm` の署名をやめたらリリースを赤くして
止めるのでなければ、黙って取り残すことになる。
`tauri-action` を `@v0` の浮動タグではなく `action-v0.6.2` に固定してあるのは
`latest.json` の形がこのアクション由来だから。`action-v1.0.0` は入力名を変えるが
Actions は知らない入力を**警告するだけ**なので、中途半端な移行は上の lost update
を黙って復活させる。

**bundle-type marker はバイナリへのパッチで、静かに失敗する。** tauri-bundler が
パッケージ化の前にバンドル形式ごとにメインバイナリのトークンを書き換えており、
クライアントが bare な `os-arch` ではなく `os-arch-installer` を引けるのはその
トークンだけが理由。パッチの失敗は警告として記録されビルドは続き、できた
バイナリはバンドル形式を一切報告しない — つまり**ビルドログだけが痕跡**である。
macOS は両端で例外で、native なバンドルは設計上パッチを飛ばすので Developer ID
署名が危険に晒されることはなく、パッチされていない macOS のバイナリでも app
バンドル形式を報告する。

**`latest.json` の `notes` は空であり、これは省略ではなく決定である。**
`releaseBody` を `tauri-action` に渡していないので更新ダイアログに変更点は出ない —
ダイアログは無くても読める作りにしてある。埋めるには生成されたリリースノート
（複数行の markdown）を job output に通すことになり、**実際のリリース回まで検証
できない**。しかもそれは「`tagName` があり `releaseId` が無いときだけ、アクションは
リリースを作成・編集する」という読みに乗る話で、その読みは手で公開する Draft の
生成ノートを保っているものと同じである。**やるなら独立した変更として、検証できる
リリース回と併せて**扱う。

## 既知の未対応

- 設定ツリーの展開状態はライブ更新で保持されない。
- 数式 (KaTeX) は意図的に未実装。
