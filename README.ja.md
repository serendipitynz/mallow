# mallow

> English: [README.md](README.md)

軽量な Markdown / 設定ファイルビューワ。
フォルダを開いてツリーから選び、Markdown は GitHub 同等のレンダリング、設定系ファイル
(JSON/YAML/TOML 系) は折りたたみ可能な階層ツリーで表示します。HTML 文書も、
スクリプトを一切実行しない sandbox 付きのフレームの中で描画します。
画像・PDF・動画も OS ネイティブの WebView で表示できます。

## インストールと更新

[最新リリース](https://github.com/serendipitynz/mallow/releases/latest)から
お使いのプラットフォーム向けのビルドを取得してください。

| プラットフォーム | ファイル | アプリ内更新 |
|---|---|---|
| macOS（Apple Silicon + Intel） | `_universal.dmg` | あり |
| Windows（x86_64） | `x64-setup.exe`・`x64_en-US.msi` | あり |
| Linux（x86_64 / arm64） | `.AppImage`・`.deb`・`.rpm` | あり |

**Windows では、ファイルを保存する前に Edge が警告を出し、そこを通り抜ける操作が
隠れています。** 確認画面には `Publisher: Unknown` と表示され、ボタンは `Cancel` と
`Delete` の 2 つしか見えませんが、**`Delete` ボタンのドロップダウンにある
`Keep anyway`** で先へ進めます。ダウンロード一覧の `Keep` を選ぶとこの確認画面が
出るだけで、それだけではファイルは保存されません。`Publisher: Unknown` は、Windows
向けのバンドルにコード署名がないことの表示です。

mallow には更新をチェックする機能があります。設定から自動更新のチェックをオフに
することもできます。更新チェック機能は 0.7.0 以降のバージョンで有効なので、それより
前のバージョンからは 1 度だけ手動でダウンロードしてください。

更新が実施される際には、システムの許可が必要な場合があります。

## 主な機能

- **2 カラム UI**: 左にファイルツリー（フォルダ階層・遅延読み込み）、右にビューア。
- **Markdown レンダリング**
  - GitHub-flavored markdown（テーブル、絵文字 `:emoji:`、タスクリスト `- [ ]` / `- [x]`、
    GFM alerts `> [!NOTE]` …）
  - コードブロックのシンタックスハイライト（Shiki / github-light・github-dark）＋コピー
  - mermaid 図（PNG / SVG コピー対応）
  - 目次（アウトライン、スクロールスパイ）
  - プレビュー／ソース切替（ソースは行番号付き）
- **カスタム絵文字**: 設定で画像フォルダを指定すると、ファイル名がそのまま
  `:ショートコード:` になります。Slack 由来の `:my-team:` などが文字のままでは
  なく画像として表示されます。→ [カスタム絵文字](#カスタム絵文字)
- **設定ファイル**（json / jsonc / json5 / jsonl / ndjson / yaml / yml / toml）
  - 折りたたみ階層ツリー（すべて展開／折りたたみ、ツリー／ソース表示の切替）
  - 構文エラー時はソース表示にし、パーサが位置を報告した場合は該当行をハイライト
- **CSV / TSV**（csv / tsv）
  - 表形式で表示（表／ソース表示の切替）。先頭レコードは見出し行
  - 大きなファイルは一部だけを表に出し、何を出していないかを表の上に 1 行で表示。
    ソース表示側には文書全体が出るため、開ける限りファイルの内容に届かない部分はありません
- **XML**（xml / xsd / xsl、および `.plist`）
  - 折りたたみ階層ツリー（すべて展開／折りたたみ、ツリー／ソース表示の切替）
  - 構文エラー時はソース表示にし、パーサが位置を報告した場合は該当行をハイライト
  - `.plist` は中身を見て XML 形式と JSON 形式を判断するため、`plutil -convert json`
    で変換したものは設定ファイルのツリーとして開きます
- **プレーンテキスト系ファイル**（txt / text / log、ini / conf / cfg / properties /
  editorconfig、diff / patch、sql）: 行番号付きのソース表示。文法があるものは
  シンタックスハイライトも付きます（プレーンテキストには文法がありません）。また
  ソース表示は、一定の大きさを超えたファイルではハイライトだけを打ち切り（本文は
  打ち切りません）、その旨を文書の上に表示します。上の**設定ファイル**と別項目なのは、
  構造化した表示を持つかどうかで分かれているためで、設定ファイルかどうかで
  分かれているのではありません。
- **HTML**（html / htm）
  - 既定で**描画表示**（描画 / ソースの切替あり）。文書がインラインで持つ CSS を適用した
    状態で、スクリプトを一切実行しない sandbox 付きのフレームの中に表示します。タブ・開閉
    ウィジェット・canvas で描くグラフなどは動かないままになり、何が外れているかは
    文書の上の行に出ます
  - 文書が `<img>` / `<video>` / `<audio>` / `<source>` 要素から参照しているメディアは、
    文書の隣にあるものが読み込まれます（動画の poster を含む）。スタイルシートと
    スクリプトは、リモートでも文書の隣にあっても読み込まれず、リモートの動画も
    読み込まれません。リモート画像は Markdown と同じく読み込まれます。局所参照の中には黙って
    落ちるものもあります — 代表は文書自身の CSS の `url()` で、読み込まれず、文書の上の行にも
    出ません（文書の隣のスタイルシートはその行に数えられます）
  - 文書中のリンクは、環境によっては何も起こしません（**文書自身の目次も動きません**）。
    どちらになるかは OS 名ではなく文書ごとに判定していて、該当するときは文書の上の行に
    出ます。文書の横のアウトラインはどの環境でも動きます
  - イメージマップだけは例外で、その領域は**どの環境でも**何も起こしません。領域の
    クリックを抑止しても効かないので、他のリンクを一部の環境で生かしている機構をここには
    使えません。代わりに、表示する前に領域からリンクを外していて、それが表示を白いページに
    差し替えられないようにしています
  - 動画は最初のフレーム（poster があれば poster）を表示しますが、コントロールを
    押しても再生が始まりません。これは macOS（WKWebView）で確認したもので、Windows と
    Linux の WebView では未計測です。**その動画ファイル自体を mallow で開けば再生します**
  - フレームが組み立てられる要素数・テキスト量を超える文書や、描画した高さがフレームに
    許された上限を超える文書は、その旨を 1 行添えてソース表示に切り替わります
  - **既定のアプリで開く**（フッタ、および通知の行から）は、その OS が `.html` に
    割り当てているアプリへファイルを渡します — スクリプトも含めた文書そのものです
- **mermaid 単体ファイル**（.mmd / .mermaid）の表示
- **画像・PDF・動画**（png / jpg / jpeg / gif / webp / svg、pdf、webm / mp4 / mov、
  加えて macOS では heic/heif）: Tauri の asset protocol 経由で OS ネイティブの
  WebView が描画するため、対応可否はそのプラットフォームの WebView が復号できるか
  に依存します（例: 一部 Linux の WebKitGTK では PDF が表示できません）。
- **ライブ更新**: 表示中ファイルの変更を検知して自動再描画（スクロール位置を保持）、
  ツリーも追従。
- **エディタで開く**: VS Code / Zed / CotEditor / mi（macOS）、Notepad++ / サクラ（Windows）等を
  検出して起動。OS のファイルマネージャで表示も可能。
- **テーマ**: light / dark / auto + Solarized Light/Dark・Dracula・Nord。
- **自己更新**: 新しいバージョンを確認して導入できます。→ [インストールと更新](#インストールと更新)
- **設定の永続化 / セッション復元**: テーマ・エクスプローラ幅と位置・カスタム絵文字
  フォルダ・最後に開いていたフォルダ/ファイル・ウィンドウ位置を保存し、次回起動時に復元。

## 技術スタック

- [Tauri v2](https://v2.tauri.app/)（Rust バックエンド + OS ネイティブ WebView）
- Vite + React + TypeScript
- SCSS（Tailwind 不使用）
- markdown-it + @shikijs/markdown-it + mermaid + markdown-it-emoji / -github-alerts / -anchor
- 設定パース: yaml / smol-toml / jsonc-parser / json5

## カスタム絵文字

設定 →**カスタム絵文字**→「フォルダを選択…」で、自前の絵文字フォルダを指定します。
その中の画像（png / jpg / gif / webp / svg）はすべてファイル名のショートコードに
なります。`images/my-team.png` があれば `:my-team:` がその画像として表示されます。
組み込みのショートコードはそのまま使え、同名を定義した場合はフォルダ側が優先されます。

`emoji.json` は任意です。ファイルではなく Unicode 文字に対応させたい場合と、
名前に対して使う画像ファイルを明示したい場合に使います。

```json
{
  "image_dir": "images",
  "images": [{ "name": "my-team", "file": "my-team.png" }],
  "unicode": [{ "name": "flag-nz", "char": "🇳🇿" }]
}
```

`image_dir` の既定値は `images` で、そのサブフォルダが無ければフォルダ直下を見ます。
判断の基準はあくまで実際のファイルです。`file` が見つからなくても同名の画像があれば
解決し、マニフェストに載っていない画像も取り込まれます。名前に使えるのは英数字・
`_`・`+`・`-` のみです。

## セキュリティ

mallow は**未信頼の**文書を安全に開くことを前提にしており、描画には明確な境界が
あります。Markdown と HTML では封じ込めの機構が違います — Markdown の文書は生きた DOM に
ならず、HTML の文書はなるためです。

- **raw HTML を描画しない。** markdown-it を `html: false` で動かすため、文書中の
  `<script>` や `<img onerror=…>` はテキストとして表示され、実行されません。
  markdown-it が危険とみなす scheme（`javascript:` / `vbscript:` / `file:` /
  画像以外の `data:`）はリンクから除去されます。開くのは `http(s)` リンクのみ
  （OS ブラウザ）で、ページ内 `#anchor` はスクロール、それ以外の scheme は不活性です。
- **mermaid** は `securityLevel: 'strict'` で動作します（SVG をサニタイズし、図中の
  クリックバインドや埋め込みスクリプトを無効化）。
- **Content Security Policy**（`tauri.conf.json`）が第二層です。スクリプトはバンドル
  済みアプリコードに限定され（`'self'` と Shiki のハイライタ用 `'wasm-unsafe-eval'`）、
  `script-src` に `'unsafe-inline'` を許可しないため、仮に DOM に注入された inline
  スクリプトやイベントハンドラがあっても実行されません。
- **ローカルメディア**（画像 / PDF / 動画）は Tauri の asset protocol で配信します。
  そのスコープは空から始まり、ユーザーが開いたフォルダにのみ広げられます。CSP は
  `img`/`media`/`frame` に対して `asset:` URL を許可しますが、文書側から注入すること
  はできません。`html: false` と markdown-it のリンク検証が `asset:` scheme を弾く
  ため、メディアはツリーで選択したファイルに対してのみ読み込まれます。
- **描画表示の HTML** は、中身が実際に生きた DOM になる唯一のファイル種別なので、
  エスケープではなく周りのフレームで封じ込めます。文書は
  `sandbox="allow-same-origin"` かつ `allow-scripts` **無し**の iframe に読み込みます。
  スクリプトは実行されず、フォームは送信されず、ポップアップも開かず、アプリ本体を別の
  ページへ遷移させることもできません。その一方で mallow 自身は文書を読めるので、
  アウトラインの生成と高さの実測はできます。`srcdoc` の文書は上の CSP も継承するので、
  CSP も同じく効きます。**層は 2 つありますが、広さは同じではありません** — 相対パスの
  `<script src="./x.js">` を止めるのは sandbox だけです。フレームがそれを mallow 自身の
  URL に対して解決するためです。**要素の許可リストも HTML サニタイザもありません** —
  入れ子の `<iframe>` / `<frame>` と `<base>` を取り除いていますが、これは描画と
  ネットワークの都合であってサニタイズではありません。文書から届く先として残るのは
  Markdown が既に持っている露出と同じもの、つまりリモート画像と、文書自身の CSS に
  書かれた `url(https://…)` です。

## 開発

```sh
pnpm install
pnpm tauri dev      # 開発起動（ホットリロード）
pnpm tauri build    # リリースビルド（.app / .dmg などを生成）
pnpm build          # フロントの型チェック + バンドルのみ
pnpm test           # フロントのユニットテスト（Vitest）
cargo test          # Rust のユニットテスト（src-tauri/ 内で実行）

# アプリアイコンの再生成（元画像から各サイズ/形式を生成）
pnpm tauri icon src-tauri/icons/app-icon.png
```

## 構成

```
src/                フロントエンド（React + TS）
  components/        Explorer / Viewer / MarkdownView / ConfigView / SourceView / ...
  lib/              markdown・shiki・mermaid・config-parse・frontmatter・watch・settings・theme ...
  hooks/useFileTree ファイルツリーの集中管理（遅延読み込み・更新・展開復元）
  styles/           SCSS（_vars / global / app / markdown / config / source / table / xml）
src-tauri/          Rust バックエンド
  src/commands.rs   read_dir_tree / read_file / path_exists / allow_media_dir（std::fs）
  src/watch.rs      notify による再帰ファイル監視（fs:change イベント）
  src/editors.rs    エディタ検出・起動・OS で表示・既定のアプリで開く
  icons/app-icon.png  アイコンの元画像（再生成の入力）
```

## クレジット

- Markdown プレビューア [Shiba](https://github.com/rhysd/Shiba)（rhysd 氏）にインスパイアされています。
- UI アイコンは [Lucide](https://lucide.dev)（ISC）を使用しています。

## ライセンス

mallow は [MIT License](LICENSE) で配布しています。同梱する第三者コンポーネントの
ライセンスは [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) を参照してください。
