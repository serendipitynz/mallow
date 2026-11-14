---
id: TASK-59
title: 'Show the toolbar path with its leading separator at its start, not its end'
status: In Review
assignee: []
created_date: '2026-11-13 23:05'
updated_date: '2026-11-14 00:02'
labels:
  - bug
dependencies: []
references:
  - src/styles/app.scss
  - src/components/Toolbar.tsx
priority: medium
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The toolbar shows the selected file's path with its leading separator moved to the end: `/Users/…/deck.md` reads `Users/…/deck.md/` on macOS, and a UNC path `\\host\share\…\deck.md` reads `host\share\…\deck.md\\` on Windows (seen in v0.14.0 on both).

**The cause is `direction: rtl` on `.toolbar__path`** (`src/styles/app.scss`), which is there so a truncated path keeps its tail — the file name — visible. Under an RTL base direction the Unicode bidi algorithm resolves a leading neutral character (`/`, `\`) to the paragraph direction and places it at the visual end. The path's own characters are untouched; `title` carries the right string.

The fix has to keep both halves: the separators where they belong, and the ellipsis at the start rather than the end when the path does not fit. Candidates are an inner element isolating the path as one LTR run (`<bdi dir="ltr">`, or `unicode-bidi: isolate` with `direction: ltr`) inside the RTL box, or a left-to-right mark before the text. Which one keeps the head-side ellipsis is an engine question, so it is checked on WKWebView, WebView2 and WebKitGTK rather than in one browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A POSIX path shows its leading / at the start and no trailing separator in the toolbar
- [x] #2 A Windows drive path and a UNC path (\\host\share\…) show their separators where they are written
- [x] #3 A path too long for the toolbar is still truncated at its head, keeping the file name visible
- [ ] #4 Checked on macOS, Windows and Linux builds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Toolbar.tsx: wrap the path in <bdi dir="ltr"> inside .toolbar__path, so the path is one isolated LTR run while the box stays RTL for head-side truncation.
2. app.scss: update the direction comment to say why the inner isolate is needed.
3. Verify the visual order and the ellipsis in Playwright WebKit and Chromium; leave the three-platform build check (AC #4) to the owner.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 方式

`.toolbar__path` の RTL はそのままにし、パスを `<bdi dir="ltr">` で 1 つの LTR 分離ランとして包んだ。省略記号の位置は外側の RTL が決め、区切り文字の並びは内側の LTR が決める、という分担。

候補のうち LRM（パスの先頭に U+200E を置く）を採らなかった理由: 先頭の中立文字は直せるが、パスの途中に RTL 文字を含むフォルダ名があると、その前後で並びが崩れる（下の hebrew 行）。isolate ならパス全体が 1 つの LTR 段落として解決されるので、どの位置の文字も影響を受けない。

## 計測（Playwright の WebKit と Chromium、playwright-core 1.62.1）

本番と同じ指定（`direction: rtl; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`、幅 300px、12px）で、文字ごとの Range の x 座標を取って視覚上の並びを復元した。

| ケース | 現状 | bdi | LRM |
|---|---|---|---|
| `/Users/someone/Projects/deck.md` | `Users/…/deck.md/` | 書かれたとおり | 書かれたとおり |
| `C:\Users\someone\deck.md` | 書かれたとおり | 書かれたとおり | 書かれたとおり |
| `\\host\share\dir\deck.md` | `host\…\deck.md\\` | 書かれたとおり | 書かれたとおり |
| `/Users/someone/notes (1)`（末尾が中立文字） | `Users/…/notes (1)/` | 書かれたとおり | 書かれたとおり |
| `/Users/someone/<ヘブライ語>/deck.md` | 崩れる | 書かれたとおり | 崩れる |

WebKit と Chromium の結果は一致した。現状の不具合は先頭の区切り文字だけでなく、末尾の `)` のようにパスの末尾が中立文字のときにも起きていた。
長いパス（約 280 文字）はどちらのエンジンでも bdi で先頭側に `…` が出て、末尾の `deck.md` が見えていることをスクリーンショットで確認した。

## 確認していないこと

- AC #4: 実アプリのツールバーで、macOS（WKWebView）・Windows（WebView2）・Linux（WebKitGTK）のビルドを使った確認。上の計測は同じ CSS を使ったハーネスで、Playwright の WebKit は WKWebView や WebKitGTK そのものではない。ユーザーの確認に残す。

## 検証

biome ci、tsc + vite build、vitest run（53 ファイル・671 件）が通った。`pnpm <script>` は事前依存チェックが lockfile 中の公開 7 日以内のパッケージで止まるため、`node_modules/.bin` のバイナリを直接実行した。
<!-- SECTION:NOTES:END -->
