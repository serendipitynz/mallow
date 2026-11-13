---
id: TASK-56
title: >-
  Move to markdown-it 15 and its bundled types, with the npm minor-and-patch
  group that waits on it
status: Done
assignee: []
created_date: '2026-11-13 10:04'
updated_date: '2026-11-13 11:04'
labels:
  - chore
dependencies: []
priority: medium
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two Dependabot pull requests fail the frontend type check and cannot be merged alone (checked 2026-11-13):

- **PR #110** moves markdown-it 14.3.3 → 15.0.3. markdown-it 15 ships its own types, and `MarkdownIt` is now a value that cannot be used as a type: `src/lib/markdown.ts` (the plugin functions taking `md: MarkdownIt`, `createMarkdownIt`'s return type) and `src/lib/deck.ts:176` fail with TS2749, and the renderer-rule callbacks lose their parameter types (TS7006).
- **PR #119** (the npm minor-and-patch group, which superseded PR #116 on 2026-11-13) carries @shikijs/markdown-it 4.3.0 → 4.6.0, whose types are written against markdown-it 15's. Against mallow's `@types/markdown-it` 14.1.2, `md.use(fromHighlighter(...))` at `src/lib/markdown.ts:370` fails with TS2769 (`Ruler<RuleInline>` vs `Ruler<[StateInline, boolean], boolean>`). The same group also carries unrelated updates (react 19.3, markdown-it-emoji 3.1, and the npm halves of tauri-plugin-opener 2.7.3 and -store 2.5.1).

markdown-it-anchor 10.1 (PR #109, merged) already supports markdown-it 15 and makes `@types/markdown-it` an optional peer.

What moves together: markdown-it 15, the removal of `@types/markdown-it` (and `src/shims.d.ts`'s `PluginWithOptions` import, the `markdown-it/lib/token.mjs` type import, and `markdown-it-emoji`'s data import, each checked against 15's exports), @shikijs/markdown-it and shiki 4.6, and the type fixes in `lib/markdown` and `lib/deck`. Whether markdown-it-github-alerts and markdown-it-emoji type-check against 15 is checked here too.

**Behaviour is the risk, not the types.** `lib/markdown` carries the untrusted-Markdown boundary (`html: false`, `validateLink`, the local-image rule, the emoji shortcode table) and its test suite covers it; markdown-it 15's changelog is read for anything that changes rendering, link validation or the token stream those rules read. `lib/deck` builds Marpit on a second markdown-it instance, so Marpit's own markdown-it range is checked as well.

The rest of PR #119 may be split off and merged first if it is green without the shiki half.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 markdown-it is on 15.x, @types/markdown-it is removed, and pnpm build type-checks with no casts added to paper over the new types
- [x] #2 @shikijs/markdown-it and shiki are on 4.6 (or the release the npm group then offers), and PR #110 and PR #119 are closed or superseded by this work
- [x] #3 markdown-it 15's changelog is read for changes to rendering, link validation and the token stream, and anything that touches the untrusted-Markdown boundary or the deck's Marpit instance is recorded with what was checked
- [x] #4 pnpm lint, pnpm build, pnpm test (the markdown suite's security-boundary tests included) and the paper job pass
- [x] #5 On one platform by hand: a markdown document with code, mermaid, task lists, emoji and custom emoji, alerts, a local image and a Marp deck render as before
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. markdown-it 15 / shiki 4.6 / emoji 3.1 へ上げ、@types/markdown-it を外す
2. 15 の名前付き型エクスポートへ書き換え（キャストなし）
3. CHANGELOG を読み、14 と 15 の出力を比べて、安全境界・デッキ・linkify の変化を確かめる
4. linkify の挙動変化はオーナーに確認して反映し、テストで固定
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 実施内容

- 依存: markdown-it 14.3.3 → 15.0.3、@shikijs/markdown-it / shiki 4.3.0 → 4.6.0、markdown-it-emoji 3.0.0 → 3.1.0。`@types/markdown-it` を devDependencies から削除。THIRD-PARTY-NOTICES.md を再生成。
- 型: markdown-it 15 は型を同梱し、default エクスポートは呼び出し可能な値、`MarkdownIt`・`Token`・`StateCore`・`StateInline`・`Env` は名前付きの型エクスポートになった。`markdown-it/lib/*` のディープインポートは `exports` で塞がれた。`lib/markdown` は `markdownIt(...)` で生成し、型は名前付きインポートへ。`lib/deck` も同じ。`shims.d.ts` の emoji プラグイン型は、15 に無い `PluginWithOptions` の代わりに `(md: MarkdownIt, options?) => void` を自前で定義。`attrGet` が `string | number | null` を返すようになったので、3 か所を `String(...)` で文字列化（パーサが入れる属性は文字列なので挙動は同じ）。描画ルールの `env` は `Env | undefined` になったため、`RenderEnv` を廃止し、`declare module 'markdown-it'` で `Env` に `images` を足した。キャストは追加していない（AC#1）。
- 範囲: #119 にある react 19.3 と tauri プラグインの npm 側は含めていない。このタスクのマージ後、Dependabot が #119 を残りの更新だけに作り直す想定。

## markdown-it 15 の変更履歴の確認（AC#3）

15.0.0〜15.0.3 の CHANGELOG を読み、14（Marpit 経由で lockfile にある 14.2.0）と 15 の出力を同じ入力で比べた。

- **linkify-it v6 でスキームなしのドメインが既定でリンクされなくなった**: `example.com` / `www.example.com` は 14 ではリンク、15 では平文。オーナー判断（2026-11-13）で従来どおりリンクする — `md.linkify.set({ fuzzyLink: true })`。テストを追加。
- **`urlAuth: false` が既定に**: `https://user:pass@example.com/x` は 14 では URL 全体がリンクだったが、15 では `https://user` だけがリンクになる。`https://trusted@evil` 型の偽装を防ぐ既定なので、オーナー判断で新しい既定を採用。偽装先ホストがリンクされないことをテストで固定。
- CJK の句読点（`、` `）。`）で URL が切れるようになった（14 では句読点まで URL に含まれていた）。改善なので受け入れ、テストで固定。
- IPv6 リテラルの URL がリンクになる、画像の alt にインラインコードの中身が入る、の 2 点も変わる。どちらも改善で、安全境界に関係しない。
- **安全境界は変わらない**: `javascript:`・`file:`・`vbscript:`・画像以外の `data:` のリンクは 14 と同じく落ちる。`validateLink` / `normalizeLink` がプロトタイプのメソッドに移ったが、mallow は差し替えていない。`html: false` の挙動も同じ。セキュリティのテスト群は無修正で通過。
- **デッキ**: `lib/deck` は Marpit に mallow 自身の markdown-it インスタンス（`markdown: md`）を渡すので、markdown-it 14 前提で作られた Marpit 3.2.3 のプラグインが 15 の上で動く。Marpit を通して描画する `deck.test.ts` の 35 件が無修正で通過。Marpit 自身は markdown-it ^14.3.1 を依存に持つので、lockfile には 14.3.3 が残る。
- 15.0.1〜15.0.3 は二次計算量の修正（参照定義・HTML コメント・smartquotes・linkify）とコードスパンの修正で、描画への悪影響はない。

## 検証

- `tsc`（エラー 0）、Biome（188 ファイル）、Vitest 671 件（新規 3 件）、`vite build` が通過。
- 手元のインストールは、グローバル pnpm 設定 `minimumReleaseAge: 10080` が main の lockfile にある electron-to-chromium@1.5.479（2026-11-10 公開、#108 で入った browserslist のデータ）を拒否するため、オーナーの承認を得て、その 1 パッケージだけを `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` に一時的に足して実行し、直後に git で元に戻した（コミットしていない）。pnpm 11.9 は CLI 引数・環境変数で渡した除外をロックファイル検証で無視するため（3 通り試した）。pnpm の各スクリプトは同じ検証に掛かるので、tsc / biome / vitest / vite は `node_modules/.bin` から直接実行した。
- `@types/markdown-it` 14.1.2 は markdown-it-anchor 10.1 の任意 peer として lockfile に残る。mallow のコードは markdown-it 15 同梱の型を使っていて影響はない。`pnpm dedupe` でも消えず、範囲外の重複解消が混ざったので取り消した。
- 未実施: paper ジョブ（CI）、AC#5 の手動描画確認（オーナー）。AC#2 の #110・#119 の片付けはマージ後。

## マージ後（2026-11-14、PR #120）

- PR #120 の CI がすべて通過: paper（macOS・Linux・Windows）、rust、frontend、npm、Audit（AC#4）。外部レビューは Codex（gpt-6-astra、effort=low）が 1 ラウンドで指摘なし、bot が HEAD d64d0e2 を APPROVE。
- PR #110 は「#120 で置き換え」とコメントしてクローズ。PR #119 は `@dependabot recreate` を頼んだところ Dependabot 自身がクローズした。残りの react 19.3 と tauri プラグインの npm 側は、Dependabot の次の実行で別の PR として届く想定（AC#2）。
- AC#5: オーナーが手元で、Markdown 文書（コード・mermaid・タスクリスト・絵文字とカスタム絵文字・アラート・ローカル画像）と Marp デッキの描画が従来どおりであることを確認（2026-11-14）。
<!-- SECTION:NOTES:END -->
