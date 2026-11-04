---
id: TASK-48
title: >-
  Retake the Windows paper baseline now that WebView2 156 reports shorter word
  boxes
status: Done
assignee: []
created_date: '2026-11-03 22:25'
updated_date: '2026-11-04 03:51'
labels:
  - bug
dependencies: []
references:
  - scripts/paper/baseline.json
  - scripts/paper/measure-paper.mjs
  - .github/workflows/check.yml
priority: medium
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Windows leg of the CI paper job now fails its scale check on any PR that touches paper inputs. Run 41727437237 (PR #84, TASK-46) measured a median word height of 13.22 against the ci-windows baseline of 15.45 in scripts/paper/baseline.json — 14.4% off, tolerance 5%. Every other check in that job passed, and the macOS and Linux legs passed. The last passing Windows paper run was 41017907470 on 2026-10-30.

**The type did not shrink; the measure moved.** Between those two runs the runner image went from windows-2025-vs2026 20261021.278.1 to 20261030.294.1, and the PDF's producer from WebView2 155 / Skia m155 to WebView2 156 / Skia m156. The two PDFs embed the same fonts, run to the same 15 Letter pages and share the text extent 45.0–561.5. All 1,113 words sit at identical x positions with identical widths (max difference 0.0). Only the vertical boxes pdftotext -bbox reports got shorter (median 15.45 → 13.22), with their centres moving 0.15pt. So Skia m156 writes different vertical font metrics into the PDF, and the scale check — which reads box height — reports a shrink that did not happen.

Nothing on main fails today, because the paper job runs only when scripts/paper/affects-paper.mjs says a PR touched paper inputs. The next such PR goes red on Windows for this reason alone, and a red that is known to be noise is how a real 0.847-style shrink would slip through.

Two ways out, and which one is the owner's decision. (a) Retake ci-windows from a fresh run under baseline.json's own _how_to_add: the owner opens the PDF and accepts the number, and its from names the run and WebView2 156. This keeps the measure and will recur on the next metrics change. (b) Make measure-paper.mjs judge scale on a horizontal measure such as word width, which this change showed to be stable. That changes the instrument for every platform, so every baseline has to be retaken under it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Whether to retake the baseline or change what the scale check measures is decided with the owner and recorded on this task, with the reason
- [x] #2 The Windows leg of the paper job passes on a run of the merged change, with the measurement it passed on recorded on this task
- [x] #3 Any baseline retaken carries in its from the run id it came from and the WebView2 version that produced the paper, and was accepted by the owner after looking at the PDF
- [x] #4 If the scale measure changes, every key in _required is retaken under the new measure and AGENTS.md's description of the paper job matches it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scale チェックの測定値を、ページ 2 の単語ボックス高さの中央値から、文書全体で CJK 文字だけからなる単語の 1 文字あたり送り幅 (幅 ÷ 文字数) の中央値に替える (measure.mjs, measure-paper.mjs の記録表示)
2. テストを新しい測定値に合わせ、ボックス高さだけが変わった紙 (TASK-48 の Skia m156 の状況) では scale が動かないこと、ラテン文字や混在語が測定に入らないことを足す
3. baseline.json の 4 キーを新しい測定値で取り直す: ci-* は run 41727437237 (Windows は WebView2 156) から、macos は task-27 の paper-mac-light-7a.pdf から。_why / _how_to_add も新しい測定値の説明に書き換える
4. AGENTS.md / AGENTS.ja.md の paper ジョブの記述を新しい測定値に合わせる
5. オーナーが 3 つの CI の PDF を見て基準値を承認、PR の paper ジョブで 3 レグが通ることを確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 判断 (AC #1)

2026-11-04 オーナーと (b) に決定: scale チェックの測定値を「ページ 2 の語のボックス高さの中央値」から「文書全体で CJK 文字だけからなる語の 1 文字あたりの幅 (幅 ÷ 文字数) の中央値」に替える。

理由: ボックス高さは PDF の書き手が埋め込むフォントメトリクスで決まり、文字の大きさではない。(a) の取り直しは Skia のメトリクスが次に変わればまた同じ赤を出し、「ノイズと分かっている赤」が本物の縮小を隠す状態が繰り返される。CJK の字形はどの日本語フォントでも 1em 送るので、横方向の送り幅はフォントサイズそのものになり、どの語がどのページに載るかにも左右されない。ラテン文字は字ごとに幅が違うので除外した。ページ 2 に限定していたのは見出しやコードが高さの平均を引っ張るためで、CJK 語約 500 個の中央値では見出しの影響は出ないため、文書全体を読む。

## 測定 (新旧の比較)

| 紙 | 旧: 語の高さ | 新: CJK 送り幅 |
|---|---|---|
| Windows run 41017907470 (WebView2 155) | 15.45 | 12.00 |
| Windows run 41727437237 (WebView2 156) | 13.22 | 12.00 |
| macOS (両 run) | 21.00 | 12.81 |
| Linux (両 run) | 33.28 | 12.80 |
| task-27 paper-mac-light-7a.pdf (受け入れ済みの設計サイズ) | 18.56 | 12.81 |
| task-27 paper-mac-light-9.pdf (縮小した紙) | 16.99 (0.916 倍) | 11.73 (0.916 倍) |

- WebView2 156 の変化は旧測定だけを動かし、新測定は 155 / 156 で完全一致。本物の縮小 (light-9) は両方を同じ比率で動かし、新測定でも 8.4% ずれで FAIL する。0.847 倍の縮小は新測定でも 15% ずれで、許容 5% の外。
- 新しい measure-paper.mjs を両 run の 12 本の PDF (3 OS × 2 テーマ × 2 run) に当てて全 PASS。

## 基準値の取り直し (AC #3, #4)

- `_required` の ci-macos 12.81 / ci-windows 12.00 / ci-linux 12.80 を run 41727437237 から取り直し、オーナーが 3 つの PDF を見て 2026-11-04 に承認。from には run id と PDF の書き手 (Windows は WebView2 156 / Skia/PDF m156、macOS は macOS 26.6.2 Quartz PDFContext、Linux は Skia/PDF m145) を記載。
- ローカルの `macos` キーは、すでに受け入れ済みの paper-mac-light-7a.pdf を新しい測定器で測り直して 12.81。
- AGENTS.md / AGENTS.ja.md の紙の項を新しい測定値に合わせた。同じ箇所にあった「2026-09-09 時点で受け入れ済みは ci-macos だけ」は c317ee5 で 3 ランナーとも有効化された後も残っていた古い記述なので、あわせて直した。

## 測っていないこと

- Windows ランナーが 12.00 (= CSS の 16px ちょうど) なのに対して、macOS と Linux のランナーは 12.80 (16/15 倍) で書いている。その差がどこから来るか (縮小か、フォントの送り幅か) は調べていない。環境ごとの基準値なので判定には影響しない。
- AC #2 (マージされる変更での Windows レグの合格) は PR の paper ジョブの結果を待つ。

## AC #2 の測定 (マージ後)

PR #85 は 2026-11-04 にマージ (merge commit 2a2f674)。merge commit のツリーはレビュー済み HEAD e67f450 と同一 (git diff が空) なので、e67f450 で走った PR の paper ジョブ run 41762270179 がマージされた変更の実行にあたる。

- Windows light / dark とも PASS: median CJK advance 12.00 vs baseline 12.00 (0.0% off, tolerance 5%)、ほかの項目もすべて ok。PDF の書き手は WebView2 156 (Edg/156.0.0.0) / Skia/PDF m156、15 ページ。
- macOS / Linux のレグも同じ run で PASS。

Merged via #85
<!-- SECTION:NOTES:END -->
