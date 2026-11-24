---
id: TASK-57
title: Record a tour of the app for README and x.com
status: Done
assignee: []
created_date: '2026-11-13 11:42'
updated_date: '2026-11-24 09:57'
labels:
  - documentation
dependencies: []
references:
  - 'https://github.com/serendipitynz/serenebach'
  - README.md
priority: low
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow has no moving picture of itself anywhere: README shows the app icon and text only, and there is nothing to post on x.com when a release is announced. This task records one short tour of the real app and derives the two forms its two destinations need.

**README follows serenebach's approach** (`serendipitynz/serenebach`, `docs/assets/admin-tour.webp` and the commit that introduced it): an animated WebP embedded as an image, linked to an HD MP4 for click-through. The reasons it gives carry over unchanged:
- A `<video>` whose source is on another domain is refused by GitHub's `media-src` CSP.
- A `github.com/user-attachments` video does not play on iOS Safari.
- An image goes through camo, which `img-src` permits, so an animated WebP plays inline everywhere.

serenebach's numbers, as the reference point: 720×450, 15 fps, lossy q=75, 17 s, 474 KB, loop; the click-through MP4 is 629 KB with `+faststart`.

**x.com takes an MP4**, uploaded directly, since an animated WebP is not played there as a video. 16:10 is inside the aspect range X accepts, so the README master serves both and nothing is recorded twice.

The shape proposed, to be confirmed at the start:
- **Source**: a screen recording of the built app (`pnpm tauri build --debug --no-bundle`), not a mock-up, opened on a demo folder assembled from `_sandbox/samples` outside the tracked tree. Driven by `osascript`, recorded with `screencapture -v`, cut with ffmpeg.
- **Scenes** (15–20 s for README): a Markdown document with a mermaid diagram and code, a jump through the outline, a Marp deck shown as slides, a CSV table, a JSON tree, and the light / dark switch. Five or six of these, not all.
- **Derived files**:
  - `docs/assets/tour.webp` — 720×450, 15 fps, lossy, around 500 KB, loop.
  - HD MP4 — 1440×900, H.264, `+faststart`, no audio; the README image links to it.
  - X MP4 — 1440×900, H.264 High, yuv420p, 30 fps, `+faststart`, no audio, with a title card at each end.

To settle at the start:
- **Where the HD MP4 is served from.** mallow has no domain of its own as serenebach has `go.serenebach.net`. Candidates: a domain the owner already holds, GitHub Pages on this repository (which serves `video/mp4`), or no click-through and the WebP alone.
- **Captions.** None, as serenebach's tour has none, or short feature names on the X cut only; and if so, Japanese or English.
- **Running the recording**: macOS asks for Screen Recording and Accessibility permission the first time, and the app is driven in front while it records, so the machine is not usable for that time.

Nothing here adds a dependency to mallow: ffmpeg and the recording tools are the machine's, and the scripts that drive the recording stay outside the tracked tree unless keeping them is decided at the start.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Where the HD MP4 is served from, and whether the X cut carries captions and in which language, are settled and written in the task
- [x] #2 The tour is recorded from a built app, not a dev build or a mock-up, on a demo folder kept outside the tracked tree
- [x] #3 docs/assets/tour.webp is an animated WebP of 15-20 s at 720x450 that loops, and its size is recorded in the task
- [x] #4 README embeds the WebP as an image linked to the HD MP4 (or, if no click-through was chosen, as an image alone), and it plays inline on github.com in a desktop browser and on iOS Safari
- [x] #5 An X MP4 (H.264, yuv420p, faststart) is produced and handed to the owner, and its spec is recorded in the task
- [x] #6 No dependency is added to package.json or Cargo.toml
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 着手時の決定 (2026-11-24, オーナー): HD MP4 はリポジトリに同梱 (docs/assets/tour.mp4) し、README の WebP から github.com の blob ページへリンクする。X 版のみ英語の機能名キャプションを入れる。録画は osascript による自動操作。
2. `pnpm tauri build --debug --no-bundle` のバイナリを、HOME を作業用ディレクトリに向けて起動する (インストール済み mallow の settings.json / 復元セッションに触れないため)。デモフォルダは _sandbox/tour/project-notes (git 管理外) に専用の内容で作る。
3. ウィンドウを 960x600 pt (Retina で 1920x1200 px, 16:10) に置き、screencapture -v -R でその範囲だけを録画する。ファイルの切り替えは単一インスタンスへの再起動転送 (`mallow <file>`) で行い、残りの操作はクリックとキー入力。
4. シーン: Markdown (mermaid + コード) → アウトラインでジャンプ → Marp デッキを Slides 表示 → CSV 表 → JSON ツリー → ライト / ダーク切り替え。
5. ffmpeg で切り出し、tour.webp (720x450, 15 fps, lossy, loop)、HD MP4 (1440x900, H.264, +faststart, 無音)、X MP4 (1440x900, H.264 High, yuv420p, 30 fps, +faststart, 無音, 両端タイトルカード, 英語キャプション) を作る。
6. README / README.ja に埋め込み、push 後に github.com (デスクトップ) と iOS Safari での再生を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時の決定 (2026-11-24, オーナー)

- HD MP4 の配信元: 当初はリポジトリに同梱 (`docs/assets/tour.mp4`) して WebP から blob ページへリンクする案を選び、再生できなければ WebP のみにすると合意していた。push 後に確かめたところ、github.com の blob ページは `.mp4` にプレーヤーを出さず「View raw」だけで、raw (`raw.githubusercontent.com`) は `application/octet-stream` + `nosniff` で返るためダウンロードになり、ブラウザ内では再生できなかった (2026-11-24)。合意どおり **クリックスルーなし・WebP のみ** に切り替え、使わない 609 KB の MP4 が main の履歴に残らないよう、オーナーの了承を得て PR ブランチのコミットを作り直した (force push)。HD MP4 は X 版と同じく成果物としてオーナーに渡す。
- X 版のキャプション: 英語で入れる。各シーンに機能名 1 つ (Markdown with GitHub-style rendering / Jump through the outline / Marp decks as slides / Present in a window, with a laser pointer / CSV as a table / JSON as a tree / Light and dark themes)。
- 録画: osascript と CGEvent によるポインタ操作で自動実行。この Mac の画面は非 HiDPI のスケールモード (2048x1332、等倍) だったため、録画の間だけオーナーが HiDPI (1470x956) に切り替えた。録画後に戻すのはオーナーの作業。

## 録画の方法

- `pnpm tauri build --debug --no-bundle` のバイナリを `HOME` を作業用ディレクトリに向けて起動した。インストール済み mallow と同じ identifier なので、こうしないと settings.json と復元セッションを上書きする。WebView の localStorage (アウトライン表示・配色) は `HOME` では隔離できず `~/Library/WebKit/mallow` (開発ビルド用) に残るため、録画前に配色を Light、アウトラインを閉に揃え、終了後に元の状態 (Auto / 閉) に戻した。
- ツールバーはファイルの絶対パスを表示するので、デモフォルダは `/Users/Shared/project-notes` に置いて録画し、終わったら削除した。原本と操作スクリプト (`tour.sh`, `make.sh`, ポインタとカード描画の Swift) は `_sandbox/tour/` に置き、追跡しない。
- ウィンドウ 960x600 pt を `screencapture -v -k -R` で 1920x1200 px / 60 fps 録画 (29.0 s)。シーン: Markdown (表・mermaid・コード) → アウトラインで Flow へジャンプ → Marp デッキを Slides 表示 → ウィンドウ内でプレゼンし、次のスライドでレーザーポインタ (L、Shift を押したまま動かす長い軌跡) で「0.6 s」を囲み、Esc で戻る → CSV 表 → JSON ツリー全展開 → ダークへ切り替え。
- プレゼンとレーザーポインタのシーンは、PR 作成後のオーナーの依頼 (2026-11-24) で加えて録り直した。Shift は CGEvent のマウス移動イベントにフラグとして載せている。Shift のキーイベントを送ると、オーナーの環境ではグローバルなホットキーでランチャーが開いた。
- この環境の ffmpeg には drawtext も libwebp もないので、WebP は img2webp、タイトルカードとキャプションは Swift (AppKit) で描いた PNG の overlay で作った。

## 成果物の仕様

- `docs/assets/tour.webp`: 720x450、15 fps (67 ms/フレーム)、lossy q=80、19.8 s、ループ (loop count 0)、474,046 bytes (463 KB)。録画の 1.0–26.5 s を 1.3 倍速にして 15–20 s に収めた。q は最初のテイク (プレゼンなし) で比べて決めた: q=75 は白地にブロック状のノイズが出て、q=85 は予算の 500 KB 前後を大きく超えた。
- HD MP4 (`_sandbox/tour/out/tour.mp4`、コミットしない): 1440x900、H.264 High、yuv420p、30 fps、19.7 s、835,109 bytes、+faststart (moov が mdat より前)、音声なし。WebP と同じ切り出し・同じ速度。
- X 版 MP4 (`_sandbox/tour/out/tour-x.mp4`、コミットしない): 1440x900、H.264 High、yuv420p、30 fps、30.5 s、1,635,475 bytes、+faststart、音声なし。等速で、両端に 2.5 s / 3 s のタイトルカード (0.4 s のクロスフェード)、英語キャプション付き。プレゼンのシーンだけはキャプションを画面中ほど (スライドのタイトルと表の間) に置き、下端のキー操作の案内と重ならないようにした。
- README / README.ja は WebP を画像として埋め込むだけ (リンクなし)。再生の確認 (2026-11-24、PR ブランチの README.md。最初の WebP と、プレゼンを加えて録り直した WebP の両方で確認): github.com のデスクトップ表示は Claude Code デスクトップアプリの内蔵ブラウザ (Chromium) で 720x450 として読み込まれ、5 秒おいた 2 枚のスクリーンショットでフレームが進んだ。iOS Safari は iPhone 16 シミュレータ (iOS 18.0) で同様にフレームが進むのを確認した。実機の iPhone と、Chromium 以外のデスクトップブラウザ (Safari, Firefox) は未確認。
- package.json / Cargo.toml / 両ロックファイルは無変更。`pnpm lint` / `pnpm build` / `pnpm test` (767 件) は通過。
<!-- SECTION:NOTES:END -->
