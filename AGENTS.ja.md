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
  イベント・`Cmd/Ctrl+,` ショートカットのいずれからも開く）。
- `hooks/useFileTree.ts` — ファイルツリーの集中管理（展開集合・子マップ・`refresh`・
  `expandPaths`）。ツリーコンポーネントはこれに制御される。
- `components/` — Explorer/FileTree、Viewer（種別でルーティング）、MarkdownView、
  ConfigView/ConfigTree、SourceView（共通・行番号付き）、TableView（csv/tsv）、
  MermaidView、
  MediaView（画像/PDF/動画を asset protocol 経由で表示）、Outline、Toolbar、
  OpenWith、ThemePicker、SettingsModal、icons（Lucide の SVG をインライン化・
  ランタイム依存なし）。
- `lib/` — `markdown`（markdown-it パイプライン）、`shiki`（ハイライタ singleton +
  `stripPreBackground`）、`mermaid` + `mermaid-copy` + `codeblock`（命令的 DOM 強化）、
  `frontmatter`、`config-parse`、`source-cap`（ソースビューの上限）、
  `delimited`（CSV/TSV パーサ + 表ビューの上限）、
  `custom-emoji`（ユーザーの絵文字フォルダ →
  ショートコード表）、`scroll`（スクロール位置保持）、`watch`、
  `settings`（plugin-store）、`theme`、`i18n`（ja/en 辞書 + provider/hooks。言語は
  localStorage に永続化）、`file`、`path`、`tauri`（invoke ラッパ）、`types`。
- `styles/` — SCSS: `_vars`（パレット + `on-dark` mixin）、`global`、`app`、
  `markdown`、`config`、`source`、`table`。

**バックエンド (`src-tauri/src/`)**
- `commands.rs` — `read_dir_tree` / `read_file` / `path_exists` / `allow_media_dir`
  を素の `std::fs` で実装（fs プラグインは使わない）。ユーザーが選んだ任意フォルダを
  スコープ設定なしで扱える。`allow_media_dir` は開いたフォルダに asset protocol の
  スコープを広げ、その中の画像/PDF/動画を `convertFileSrc` で表示できるようにする。
- `watch.rs` — `notify` の再帰ウォッチャ。`fs:change` イベント（パス配列）を emit。
  ウォッチャは `WatcherState` が保持。
- `editors.rs` — `detect_editors` / `open_in_editor` / `reveal_in_os` を `std::process`
  で実装（OS ごとに `cfg` で分岐）。
- `lib.rs` — プラグイン登録（opener, dialog, store, window-state）、`invoke_handler`、
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
- 独自 Rust コマンドと core イベントは capabilities の許可不要。plugin/core API のみが
  ゲートされる（`src-tauri/capabilities/default.json` 参照）。

## 変更の検証

- フロント: `pnpm lint`（Biome）・`pnpm build`（tsc + vite）・`pnpm test`（Vitest）。
  ユニットテストはコードと同じ場所に `src/**/*.test.ts` として置き、純ロジックの
  モジュール（`markdown` ＝未信頼入力のセキュリティ境界含む・`config-parse`・
  `frontmatter`・`title`・`path`・`delimited`・`custom-emoji`＝Tauri 層をモック）をカバーする。
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
Linux は 2 ジョブとも `ubuntu-24.04` 系イメージで動くので、Linux のバンドルは
glibc 2.39 を要求する。Ubuntu 22 の 2.35 より下限を上げた理由はワークフローの
matrix コメントが正本。`ubuntu-24.04-arm` ラベルは public リポジトリでしか解決しない。

初回設定 — macOS ランナーは以下のリポジトリ Secrets がある時だけ署名・公証する。
`scripts/setup-ci-signing-secrets.sh path/to/DeveloperID.p12` が `.env.signing` と
書き出した `.p12` から6つすべてを登録する（値は一切表示しない）:

- `APPLE_CERTIFICATE` — Developer ID Application の `.p12` を base64 化したもの
  （キーチェーンアクセス → 自分の証明書 → 書き出す…）。
- `APPLE_CERTIFICATE_PASSWORD` — その `.p12` の書き出しパスワード。
- `APPLE_SIGNING_IDENTITY` — 証明書の Common Name。`.p12` から導出する
  （`.env.signing` の値はコピーしない: CI は取り込んだ証明書の Common Name を
  文字列一致で照合するため、ローカル署名で有効な SHA-1 ハッシュだと失敗する）。
- `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` — `.env.signing` と同じ値。

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
Windows / Linux バンドルは未署名。
Draft のリリースノートは前回タグ以降にマージされた PR から生成され、`.github/release.yml`
に従いラベルで分類される（PR に `feature` / `bug` / `documentation` を付けると振り分けられ、
それ以外は "Other Changes" に入る）。

## 既知の未対応

- 設定ツリーの展開状態はライブ更新で保持されない。
- 数式 (KaTeX) は意図的に未実装。
