---
id: TASK-46
title: >-
  Measure whether the CSS Custom Highlight API works on the three WebViews and
  inside the rendered HTML frame
status: In Review
assignee: []
created_date: '2026-11-03 19:23'
updated_date: '2026-11-03 22:00'
labels:
  - feature
milestone: m-7
dependencies: []
references:
  - src/probe/link-checks.ts
  - src/components/HtmlView.tsx
  - src/components/MarkdownView.tsx
  - >-
    backlog/decisions/decision-9 -
    Keep-the-srcdoc-frame-and-accept-that-http-s-links-are-inert-where-it-runs-no-parent-listeners.md
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spike, prerequisite for TASK-47 (find text in the open document). The find feature is to paint its matches with the CSS Custom Highlight API (`CSS.highlights` + `::highlight()`) rather than by wrapping them in `<mark>`, because writing into the DOM is exactly what two views must not have done to them: `MarkdownView` writes the article's HTML only when its enhancements re-run (TASK-29's invariant), and `HtmlView`'s `MutationObserver` turns any write into the frame into a restart of the height measurement, which throws the reader to the top. A highlight registers ranges and paints them without a single DOM mutation.

The API is Safari 17.2+ / Chromium 105+ on paper. What has not been observed is whether it works on this project's three WebViews as shipped — WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux (the Ubuntu 24.04 runner's version in particular) — and whether the parent can use it inside the rendered HTML view's frame, which is `srcdoc` with `sandbox="allow-same-origin"` and no `allow-scripts`. decision-9 is the reason not to assume the second: parent-registered listeners on that document run on WebView2 and on neither WebKit engine, so "the parent can drive the frame" is not one property.

Measure in a built app (`pnpm tauri build --debug --no-bundle`), not `pnpm tauri dev`, since the frame's CSP is absent in dev. The measurement belongs in `src/probe/` beside `link-checks.ts`, so it can be re-run. Whether a highlight *paints* is a visual fact — a counter can say a Highlight was registered, not that it drew — so each paint check needs a screenshot, and each needs a positive control in the parent document first so a missing API cannot pass as a frame-specific failure.

Also record, on Windows, whether `Ctrl+F` opens WebView2's own find UI when the app does not consume the chord. The find task consumes it regardless (the `Ctrl+P` rule), so this is recorded for the reason and does not gate anything.

If any WebView lacks the API, the fallback is decided with the owner before TASK-47 starts, rather than worked around inside it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The WebView version is recorded per platform, since support is version-dependent
- [x] #2 On each platform, a Highlight registered in the parent document paints its ::highlight() style (the positive control), shown by a screenshot
- [x] #3 On each platform, a Highlight whose range spans several text nodes across inline elements (e.g. foo<strong>bar</strong>) paints as one continuous match
- [x] #4 On each platform, the parent registers a Highlight on the rendered HTML view's frame document (srcdoc, allow-same-origin, no allow-scripts), with its ::highlight() rule placed during the load pass, and whether it paints is recorded
- [x] #5 Registering and clearing highlights in the frame is shown to produce no MutationObserver record, so it cannot trigger HtmlView's restart
- [x] #6 On Windows, whether Ctrl+F opens WebView2's own find UI when the app does not consume it is recorded
- [x] #7 The check lives in src/probe/ so it can be re-run, and the findings, with each platform's outcome, are recorded on this task
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/probe/highlight-checks.ts を新設し、TASK-46 の計測を TASK-7 / 5.1 / 23 のセクションと分けて置く。親文書での API 有無 (CSS.highlights / Highlight / CSS.supports('selector(::highlight(x))'))、親文書の陽性対照、インライン要素をまたぐ Range、フレーム (srcdoc, allow-same-origin, allow-scripts なし) での登録を測る。
2. フレーム側は HtmlView と同じ順序にする: load で ::highlight() の <style> を差し込み (ロードパス)、その後に MutationObserver を張り、登録・解除・再登録を行って記録数を数える。observer が生きていることは、最後に意図的な属性書き込みを 1 回して記録が出ることで確かめる (陽性対照)。フレームでの登録はフレームの realm の Highlight と親の realm の Highlight の両方で試す。
3. 塗られたかどうかはスクリーンショットでしか言えないので、各フィクスチャは「何がどう見えれば塗られている」を画面に書き、手記録の欄とレポートに残す。WebView のバージョン欄と Windows の Ctrl+F 欄 (プローブは Ctrl+F を消費しない) も手記録に置く。
4. TASK-46 のセクションは TASK-7 の 15 秒の実行を前提にせず、自前のレポート欄を持つ。CSP が効いているかは harness の captureParentCsp を export して同じ方法で記録する。
5. README に TASK-46 の節と、macOS / Linux での WebView バージョンの取り方を足す。pnpm lint / build / test を通し、MALLOW_PROBE=1 のビルドが通ることを確かめる。3 プラットフォームでの実測はオーナーの計測ラウンド。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 計測器 (AC #7 の前半)

`src/probe/highlight-checks.ts` と、プローブ画面の TASK-46 セクションを追加した。TASK-7 の実行 (15 秒・アプリを外へ遷移させようとする) を前提にせず、セクション単体で走り、独自のレポート欄と CSP の陽性対照 (`captureParentCsp` を export して流用) を持つ。同じ 3 段落を 3 か所で塗る: アプリ文書 (陽性対照)、フレームの realm の `Highlight` でフレームに登録、親の realm の `Highlight` でフレームに登録。decision-9 があるので、フレーム側はどちらか一方の結果から他方を推定しない。

フレーム側は HtmlView と同じ順序で動かす: load で `::highlight()` の `<style>` を書き込み (ロードパス)、そのあと MutationObserver を張る (HtmlView の subtree / childList / attributes に characterData を足した上位集合)。そのうえで登録 → Highlight への range 追加・削除 → 個別削除 → clear → 再登録を、1 段ごとに描画を挟んで行う。記録数 0 だけでは証拠にならないので、最後に属性を 1 回書き込み、記録が出ることを陽性対照にした。

塗られたかどうかは API から読めないので、自動判定の行は「API がある・規則がパースを通った・登録で例外が出ない」までにとどめた。塗りはスクリーンショットと手記録欄で残す。

## macOS (WKWebView) — 2026-11-04 実測

- 環境: macOS 26.7.1 (25G241)、システム WebKit 21624.5.1.11.3。`MALLOW_PROBE=1 pnpm tauri build --debug --no-bundle --no-sign` のビルドで計測し、CSP が効いていることをレポート先頭行で確認した (`script-src 'self' 'wasm-unsafe-eval' 'sha256-…'` ほか)。
- 自動判定 7 行はすべて pass。アプリ文書・フレーム (フレーム realm)・フレーム (親 realm) のいずれでも、CSS.highlights と Highlight があり、`CSS.supports('selector(::highlight(…))')` は true、規則はパース後もスタイルシートに残っていた。
- AC #2: アプリ文書で NEEDLE が黄色に塗られ、同じ文中の needle は塗られなかった。
- AC #3: `foo<strong>bar</strong><em>baz</em><code>qux</code>` が 1 本の連続した黄色で塗られた。アプリ文書でもフレームでも同じ。フレームでは `<code>` の左右 2px の padding だけが塗られずに細い隙間として見える。これは要素の box でありテキストではないので、要素境界で途切れたのではない。
- AC #4: フレームの realm の Highlight と親の realm の Highlight のどちらでも、3 段落とも記述どおりに塗られた。親の realm で作った Highlight を、フレームのレジストリへそのまま登録できる。
- AC #5: どちらのフレームでも、登録・変更・解除・再登録の間の MutationObserver 記録は 0、対照の属性書き込みでは 1。
- 付記 (TASK-47 の AC #3 向け): priority 1 の 2 つ目の Highlight を重ねると、中央の alpha だけがオレンジになり、外側の 2 つは黄色のままだった。
- スクリーンショット: `_sandbox/handoff/task-46/mac-wkwebview-paint.png`、`mac-wkwebview-report.png`。
- 計測方法についての注記: Accessibility 権限を使わずに済ませるため、セクションをマウント時に自動実行し該当箇所へスクロールする一時版をローカルでだけビルドし、`screencapture -l` でウィンドウ単位に撮った。計測後にその変更は元に戻した。計測のロジックはコミットするコードと同一。

## Linux (WebKitGTK) — 2026-11-04 実測 (オーナー)

- 環境: Ubuntu 24.04、x86_64 (VMware Workstation 17 Player 上)。webkit2gtk-4.1 2.52.3 (`libwebkit2gtk-4.1-0` 2.52.3-0ubuntu0.24.04.1、pkg-config と apt で確認)。ユーザーエージェントの `Version/60.5` は WebKitGTK のバージョンではないため、パッケージ側の値を記録した。CSP が効いた実ビルドでの計測。
- 自動判定 7 行すべて pass。両フレームとも MutationObserver の記録は 0、対照は 1。
- 塗り (スクリーンショットから読んだ): 3 か所・3 段落とも記述どおり。`<code>` の padding による細い隙間は macOS と同じ。
- 記録: `_sandbox/handoff/task-46/linux-webkitgtk-paint.png`、`linux-report.md`。

## Windows (WebView2) — 2026-11-04 実測 (オーナー)

- 環境: WebView2 156.0.0.0 (ユーザーエージェントの `Edg/156.0.0.0`)。CSP が効いた実ビルドでの計測。
- 自動判定 7 行すべて pass。両フレームとも MutationObserver の記録は 0、対照は 1。
- 塗り: 3 か所・3 段落とも記述どおり。`<code>` の padding の隙間も他の 2 つと同じ。
- AC #6: 何も Ctrl+F を消費しない状態 (プローブは keydown ハンドラを登録しない) で Ctrl+F を押すと、WebView2 自身の検索バーがウィンドウ右上に開いた。TASK-47 がこのキーを全ビューで消費するのは、`Ctrl+P` と同じ理由による。
- 記録: `_sandbox/handoff/task-46/windows-webview2-paint.png`、`windows-report.md`。

## 結論

3 つの WebView すべてで、CSS Custom Highlight API はアプリ文書でもレンダリング済み HTML ビューのフレーム (srcdoc、allow-same-origin、allow-scripts なし) でも動き、インライン要素をまたぐ Range も 1 本の連続した一致として塗られた。フレームでの登録・変更・解除は MutationObserver に何も記録させないので、HtmlView の再計測 (restart) を起こさない。フレームの realm の Highlight と親の realm の Highlight のどちらでも同じ結果になった。

フォールバックを検討する必要はなく、TASK-47 は前提どおりこの API で進められる。priority を上げた 2 つ目の Highlight で現在位置を別色にする描き方も、3 プラットフォームで意図どおりだった (TASK-47 の AC #3 向けの付記で、本タスクの AC ではない)。
<!-- SECTION:NOTES:END -->
