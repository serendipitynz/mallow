# mallow

> English: [README.md](README.md)

軽量な Markdown / 設定ファイルビューワ。
フォルダを開いてツリーから選び、Markdown は GitHub 同等のレンダリング、設定系ファイル
(JSON/YAML/TOML 系) は折りたたみ可能な階層ツリーで表示します。画像・PDF・動画も
OS ネイティブの WebView で表示できます。

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
  - 構文エラー時はソース表示にして該当行をハイライト
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

mallow は**未信頼の** Markdown を安全に開くことを前提にしており、レンダリングには
明確な境界があります。

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
  styles/           SCSS（_vars / global / app / markdown / config / source）
src-tauri/          Rust バックエンド
  src/commands.rs   read_dir_tree / read_file / path_exists / allow_media_dir（std::fs）
  src/watch.rs      notify による再帰ファイル監視（fs:change イベント）
  src/editors.rs    エディタ検出・起動・OS で表示
  icons/app-icon.png  アイコンの元画像（再生成の入力）
```

## クレジット

- Markdown プレビューア [Shiba](https://github.com/rhysd/Shiba)（rhysd 氏）にインスパイアされています。
- UI アイコンは [Lucide](https://lucide.dev)（ISC）を使用しています。

## ライセンス

mallow は [MIT License](LICENSE) で配布しています。同梱する第三者コンポーネントの
ライセンスは [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) を参照してください。
