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
pnpm tauri build    # リリースビルド + バンドル
./scripts/macos-sign-build.sh   # 署名 + 公証済みの macOS ビルド（.env.signing が必要）
pnpm tauri icon src-tauri/icons/app-icon.png   # 全アプリアイコンの再生成
pnpm notices        # THIRD-PARTY-NOTICES.md を再生成（同梱する依存ライセンス）
cargo check         # src-tauri/ 内で実行し Rust を検証
cargo test          # src-tauri/ 内で実行し Rust のユニットテストを走らせる
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
  ConfigView/ConfigTree、SourceView（共通・行番号付き）、MermaidView、
  MediaView（画像/PDF/動画を asset protocol 経由で表示）、Outline、Toolbar、
  OpenWith、ThemePicker、SettingsModal、icons（Lucide の SVG をインライン化・
  ランタイム依存なし）。
- `lib/` — `markdown`（markdown-it パイプライン）、`shiki`（ハイライタ singleton +
  `stripPreBackground`）、`mermaid` + `mermaid-copy` + `codeblock`（命令的 DOM 強化）、
  `frontmatter`、`config-parse`、`custom-emoji`（ユーザーの絵文字フォルダ →
  ショートコード表）、`scroll`（スクロール位置保持）、`watch`、
  `settings`（plugin-store）、`theme`、`i18n`（ja/en 辞書 + provider/hooks。言語は
  localStorage に永続化）、`file`、`path`、`tauri`（invoke ラッパ）、`types`。
- `styles/` — SCSS: `_vars`（パレット + `on-dark` mixin）、`global`、`app`、
  `markdown`、`config`、`source`。

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
- コードコメントは英語。
- `src-tauri/target` はコミットしない（ビルド成果物・git 無視済み）。
- mallow は独立プロジェクトとして扱う。コード/コメント/ドキュメントに外部プロジェクトを
  「由来」として記述しない。
- production 依存の追加前に確認する。
- 第三者ライセンス通知（`THIRD-PARTY-NOTICES.md`）は `pnpm notices`
  （`scripts/gen-third-party-notices.mjs`）で生成し、`bundle.resources` でアプリに
  同梱する。依存を変更したら再生成する。

## 実装メモ / 注意点

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
- `SourceView` の行番号: Shiki は `<span class="line">` を出力するので、CSS は
  `code { display: grid }` + `.line::before { counter }` を使用。
- 独自 Rust コマンドと core イベントは capabilities の許可不要。plugin/core API のみが
  ゲートされる（`src-tauri/capabilities/default.json` 参照）。

## 変更の検証

- フロント: `pnpm build`（tsc + vite）と `pnpm test`（Vitest）。ユニットテストは
  コードと同じ場所に `src/**/*.test.ts` として置き、純ロジックのモジュール（`markdown`
  ＝未信頼入力のセキュリティ境界含む・`config-parse`・`frontmatter`・`title`・`path`・
  `custom-emoji`＝Tauri 層をモック）をカバーする。Node 環境で走るため jsdom/GUI は不要。
- バックエンド: `src-tauri/` 内で `cargo check` と `cargo test`。`commands` モジュールに
  ユニットテストがある（`tempfile` 依存を避けた自己クリーンアップ式の temp-dir ヘルパー）。
- エンドツーエンド: `pnpm tauri dev`（GUI）または `pnpm tauri build`。

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

`.github/workflows/release.yml` が macOS（universal）/ Windows / Linux のバンドル
をビルドし、**Draft** の GitHub リリースに添付する（内容を確認してから手動で公開）。
`v*` タグの push、または Actions タブからタグを指定した手動実行で起動する。
`tauri-apps/tauri-action` を使い、macOS の `.dmg` は後段のステップで公証 + staple
してから `gh release upload --clobber` で差し替える（ローカルスクリプトと同じ穴埋め）。

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

リリース手順: `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`
の **3か所すべて** のバージョンを上げてコミットし、
`git tag vX.Y.Z && git push origin vX.Y.Z`。Windows / Linux バンドルは未署名。
Draft のリリースノートは前回タグ以降にマージされた PR から生成され、`.github/release.yml`
に従いラベルで分類される（PR に `feature` / `bug` / `documentation` を付けると振り分けられ、
それ以外は "Other Changes" に入る）。

## 既知の未対応

- 設定ツリーの展開状態はライブ更新で保持されない。
- 数式 (KaTeX) は意図的に未実装。
