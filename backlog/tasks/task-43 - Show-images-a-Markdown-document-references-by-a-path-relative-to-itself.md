---
id: TASK-43
title: Show images a Markdown document references by a path relative to itself
status: In Review
assignee: []
created_date: '2026-10-29 20:32'
updated_date: '2026-10-29 21:55'
labels:
  - feature
  - 決定先行
milestone: m-5
dependencies: []
references:
  - src/lib/markdown.ts
  - src/components/MarkdownView.tsx
  - src/lib/html-doc.ts
  - src/lib/path.ts
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Markdown document cannot show an image that sits beside it. `![logo](media/logo@2x.png)` in `_sandbox/samples/foo.md` renders as `<img src="media/logo@2x.png">` unchanged, and the WebView resolves that against the app's own URL (`tauri://localhost/…`, or the Vite dev URL), so the image is broken. A path starting with `/` fails the same way, and `file:` is dropped by markdown-it's `validateLink` before an `<img>` is emitted at all. The rendered HTML view already solves this for its own documents: `lib/html-doc`'s `RefResolver` resolves a reference against the document's directory (`lib/path`'s `dirname` / `resolvePath`) and hands it to `convertFileSrc`. Nothing does the same for Markdown. Remote `http(s)` images already load and stay as they are.

The fix touches a security statement that is currently false. README "Security" and AGENTS.md both say a Markdown document cannot emit an `asset:` reference because markdown-it's link validation blocks that scheme. It does not: `validateLink` refuses only `vbscript:`, `javascript:`, `file:` and non-image `data:`, so `![x](asset://localhost/%2F…)` comes out as a live `<img src="asset://…">`, and `img-src` allows `asset:`. What such a reference can reach is limited to folders `allow_media_dir` has already granted, but the documented boundary ("media only loads for files chosen in the tree") does not hold today. So this starts with a decision, not with code: either the app keeps sole authorship of `asset:` URLs in Markdown (a document-written `asset:` is refused, and only paths the app rewrote become one), or a document-written `asset:` URL is accepted, and the boundary text is rewritten to say so. Either way the docs have to match the result.

Scope is images written with Markdown image syntax. A link to a local file (`[x](other.md)`) is out of scope, and so is raw HTML `<img>`, which `html: false` keeps escaped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision records whether a Markdown document may write an asset: URL itself, and how a path starting with / and a Windows drive path are treated
- [x] #2 An image written as a path relative to the document (media/x.png, ./x.png, ../x.png, a percent-encoded name, an angle-bracketed name with a space) shows in the preview on macOS, resolved against the document's own directory
- [x] #3 A path that cannot be read (missing file, or outside every granted folder) shows as a broken image and breaks nothing else in the document
- [ ] #4 The image is on the paper from Print and Export as PDF on macOS
- [x] #5 README Security and AGENTS.md describe the asset: boundary as the decision leaves it
- [x] #6 lib/markdown stays free of Tauri APIs, and the rewriting is covered by unit tests
- [x] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. decision-17 を書く（asset: は mallow だけが書く、解決するのは文書から見た相対パスだけ、絶対パスは書かれたまま）
2. lib/markdown: renderMarkdown に任意の resolver（html-doc の RefResolver と同じ形）を渡し、image レンダールールで env 経由で classifyRef / rewriteRef を適用。文書が書いた asset: / asset.localhost は src を外す
3. MarkdownView / Viewer: 文書のパスを渡し、dirname + convertFileSrc で resolver を作る
4. lib/markdown.test.ts に書き換えと拒否のテスト
5. README Security と AGENTS.md の asset: 境界の記述を直す
6. pnpm lint / build / test、unattended ビルドで macOS の PDF に画像が載るか確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 決定（着手時に確定）

decision-17 を新設。オーナーの選択は次の 2 点。

- 文書が自分で書いた `asset:` URL（`http(s)://asset.localhost` を含む）は拒否し、`<img>` から `src` を外す。到達範囲は変わらない（相対パスの `..` で許可済みフォルダのどこにでも届く）ため、拒否で得るものは「mallow が書いたものだけ」と一文で言える境界と、プラットフォームごとに違う URL 表記を文書に持ち込ませないこと。この点は decision と README / AGENTS に明記した。
- `/` で始まるパス・ドライブパス・UNC パスは解決しない（書かれたまま＝壊れた画像）。HTML ビューの `classifyRef` と同じ規則。
- マイルストーンは m-5（v0.10.0）に入れる（オーナー判断）。

## 実装

- 相対パスの解決は HTML ビューの `classifyRef` / `rewriteRef` をそのまま使う。Markdown 用に別実装を書くと、どの参照をローカルとみなすかが 2 つのビューでずれるため。
- 書き換えは image のレンダールールで、markdown-it の `env` 経由で resolver を受け取る。core ルールにしなかったのは、MarkdownIt インスタンスは文書をまたいでキャッシュされ、resolver は描画ごとに変わるため。
- `lib/markdown` は resolver を引数で受け取り、`convertFileSrc` は `MarkdownView` が渡す（Tauri API の import はなし。`grep @tauri-apps` で確認済み）。

## 計測（macOS、2026-10-30）

- `MALLOW_UNATTENDED=1 pnpm tauri build --debug --no-bundle --no-sign` で作ったバイナリで `_sandbox/task-43/docs/images.md` を PDF に書き出した（`--theme light`）。`media/logo@2x.png`・`./dot.png`・`../docs/dot.png`・`my%20pic.png`・`<my pic.png>`・`日本語.png` の 6 枚はすべて紙面に載った（`pdfimages -list` で 240×80 が 6 枚、目視でも色を確認）。存在しない `missing.png` と、実在するが許可外の `../parent.png` は壊れた画像のアイコンになり、文書が書いた `asset://localhost/…` は alt テキストだけが残った。その後ろの見出しと段落も残った。
- この書き出しは実ウィンドウのプレビュー DOM から作られるため、AC #2 / #3 の根拠にした。GUI のプレビューを目で見る確認はしていない。
- AC #4 は Export as PDF だけを確認した。Print（OS の印刷 UI）は自動化できないため未確認で、AC #4 は未チェックのまま。
- `pnpm lint`・`pnpm build`・`pnpm test`（39 ファイル、490 テスト）が通った。Rust は変更していない。

## 未計測

- Windows / Linux での表示（`http://asset.localhost` 経路）は見ていない。
- Print から出した紙面。
<!-- SECTION:NOTES:END -->
