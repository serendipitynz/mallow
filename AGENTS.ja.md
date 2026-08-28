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
  幅/左右、セッション復元、設定モーダルの開閉（フッターのボタン・`menu:settings`
  イベント・`Cmd/Ctrl+,` ショートカットのいずれからも開く）、起動時の更新確認
  （セッション復元の後ろへ遅らせる。`autoCheckUpdates` 設定で切れる）。
- `hooks/useFileTree.ts` — ファイルツリーの集中管理（展開集合・子マップ・`refresh`・
  `expandPaths`）。ツリーコンポーネントはこれに制御される。
- `hooks/useUpdater.ts` — 更新確認・導入の同意・再起動（tauri-plugin-updater +
  tauri-plugin-process）。更新確認から導入の同意までの間 `Update` ハンドルを保持する。
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
  `settings`（plugin-store）、`theme`、`i18n`（ja/en 辞書 + provider/hooks。言語は
  localStorage に永続化）、`update-flow`（更新確認と導入の状態・ダウンロード量の
  積算）、`file`、`path`、`tauri`（invoke ラッパ）、`types`。
- `styles/` — SCSS: `_vars`（パレット + `on-dark` mixin）、`global`、`app`、
  `markdown`、`config`、`source`、`html`、`table`、`xml`。

**バックエンド (`src-tauri/src/`)**
- `commands.rs` — `read_dir_tree` / `read_file` / `path_exists` / `allow_media_dir`
  を素の `std::fs` で実装（fs プラグインは使わない）。ユーザーが選んだ任意フォルダを
  スコープ設定なしで扱える。`allow_media_dir` は開いたフォルダに asset protocol の
  スコープを広げ、その中の画像/PDF/動画を `convertFileSrc` で表示できるようにする。
- `watch.rs` — `notify` の再帰ウォッチャ。`fs:change` イベント（パス配列）を emit。
  ウォッチャは `WatcherState` が保持。
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
  `WebviewWindow::print()` へ渡す（decision-13）。**文書ではなくウィンドウで命名している** —
  エンジンがページ割りするのは `<body>` 全体なので、文書を約束する名前は最も肝心な境界で
  偽になり、印刷用スタイルが入っても真にはならない。`print()` 自体は `cfg(desktop)` だが
  こちらは括らない。括るとモバイルビルドが実行時の「コマンドが無い」になり、
  括らなければコンパイルが落ちる。
- `lib.rs` — プラグイン登録（opener, dialog, store, window-state, updater, process。
  decision-11 によりどれも `cfg(desktop)` で括らない）、`invoke_handler`、
  および（macOS のみ）ネイティブアプリメニュー。Settings… 項目（⌘,）が
  `menu:settings` イベントを emit し、フロントがそれを購読する。

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
  `Print…` はアクティブなビューが markdown の preview でないとき disabled であり、
  だからアクセラレータは `MarkdownView` の中にある — mount されていて `mode` が `preview`
  であること自体がその条件で、条件の写しを別に持たない。`file.kind === 'markdown'` は
  トグルのソース側でも真になり、そこは印刷してはいけない。
  **エンジンがページ割りするのは `<body>` 全体**で、エクスプローラ・ツールバー・フッター・
  設定モーダルを含む。印刷用スタイルが入るまで紙にはアプリの外殻が乗る。そのスタイルは
  `.scss` に書き、**`index.html` に inline `<style>` として置いてはならない** —
  `style-src` に hash が付いて `'unsafe-inline'` が失効する。`.toolbar` の
  `will-change: transform` を無効化するのは `@media print` の中だけにする。
  **余白を測る前に `@page` を書かない** — macOS の経路は印刷操作の余白 4 辺を 0 にし、
  それをアプリ共有の `NSPrintInfo::sharedPrintInfo()` へ書き込む一方、他の 2 環境は
  印刷 UI に任せるので、余白を指定するのも任せるのも観測前は誤りである。
  **自動検査は何も見ない**: Biome と Vitest は SCSS を読まず、印刷ダイアログを開ける
  ハーネスは無く、`src/probe/` はカウンタで測る器材だが、ここでの根拠はスクリーンショットと
  PDF である。
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
- 独自 Rust コマンドと core イベントは capabilities の許可不要。plugin/core API のみが
  ゲートされる（`src-tauri/capabilities/default.json` 参照）。

## 変更の検証

- フロント: `pnpm lint`（Biome）・`pnpm build`（tsc + vite）・`pnpm test`（Vitest）。
  ユニットテストはコードと同じ場所に `src/**/*.test.ts` として置き、純ロジックの
  モジュール（`markdown` ＝未信頼入力のセキュリティ境界含む・`config-parse`・
  `frontmatter`・`title`・`path`・`delimited`・`xml-tree`・
  `heading`＝座標変換のみ。`findHeading` は DOM のグローバルを要するため対象外・
  `chord`＝アクセラレータの一致判定。プラットフォームを引数で受けるので `navigator` を要しない・
  `custom-emoji`＝Tauri 層を
  モック）をカバーする。
  Node 環境で走るため jsdom/GUI は不要。markdown のテストはファイル先頭の `vi.setConfig` 1 行で
  タイムアウトを上げる — `it` ごとの第 3 引数では持たない（フォーマッタが 3 引数の呼び出しを
  複数行に展開する）し、`vitest.config.ts` にも置かない（他のスイートで固まったテストは
  5 秒で落ちてほしい）。
- バックエンド: `src-tauri/` 内で `cargo fmt --check`・`cargo check`・`cargo test`。
  `commands` モジュールにユニットテストがある（`tempfile` 依存を避けた
  自己クリーンアップ式の temp-dir ヘルパー）。
- エンドツーエンド: `pnpm tauri dev`（GUI）または `pnpm tauri build`。
- CI（`.github/workflows/check.yml`）が pull request と `main` への push で
  ちょうどこの一覧を走らせる — `biome ci`・`pnpm build`・`pnpm test`・
  `cargo fmt --check`・`cargo check`・`cargo test`。ここに書いてあるものと
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
