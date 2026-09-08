---
id: TASK-30
title: Write PDF from the print pipeline so a page can leave mallow on every platform
status: In Progress
assignee: []
created_date: '2026-09-07 08:55'
updated_date: '2026-09-08 10:27'
labels:
  - feature
milestone: m-3
dependencies:
  - TASK-28
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-13 said mallow would contribute no PDF export, because every desktop WebView already carries a print UI whose PDF destination is one of its own entries. **That reasoning was sound and TASK-27 removed its premise**: the print path is clean on Windows, loses the end of a long document on macOS, and hangs hard enough on Linux that `print_window` refuses there. All three sit in wry's implementation behind a `WebviewWindow::print()` that takes no arguments, so none is reachable from CSS or from Tauri's API — four attempts to reach the macOS one from the stylesheet failed, and a fifth predicted the size of the loss correctly while still naming the wrong cause.

So mallow writes the PDF itself, through each platform's print *pipeline* rather than its print *dialog*. decision-14 is the contract; this is the work.

**Printing stays.** Two entries side by side, and this is not a replacement — printing works on Windows without caveat, and **on Linux this export is the only way to get a page out of mallow at all.** That is a platform difference, and the README says it in TASK-12.6's sections rather than here.

**The criterion that decides the macOS implementation is whether `@media print` applies.** `WKWebView.createPDF` renders the view's own content and may not go through the print pipeline; if it does not, the PDF carries the explorer and the toolbar and TASK-28's whole stylesheet is inert. An `NSPrintOperation` with `NSPrintInfo.jobDisposition = .save` writes through the pipeline, so the stylesheet applies by construction — **that is the intended API**, and it carries a second reason: wry runs its print operation off `NSPrintInfo::sharedPrintInfo()`, an application-wide singleton it mutates on every print, and a stale page count is the kind of state such a singleton would hold. **A fresh `NSPrintInfo` may therefore avoid TASK-27's truncation too — as a hypothesis.** The cause was never isolated, so a clean export is not proof of it and a truncated one is not a regression against it. Windows' `PrintToPdfAsync` and WebKitGTK's print-to-file should both apply print styles; "should" is why AC #1 checks rather than assumes.

**The chord has to be consumed even when the export is refused.** This is the one rule TASK-27 paid for twice: the print handler lived inside the printable view, so an unprintable view registered nothing — and WebView2's own `Ctrl+P` printed a `.csv`. Registering no handler does not make a chord inert; it concedes it to the platform. Whether any engine binds `Ctrl+E` is unmeasured, and consuming it means that never has to be answered. `lib/print` already holds the shape to follow, including the three-way decision whose `suppress` case is the one that was missing.

**The gate is printing's sentence with a different reason behind it.** `Export as PDF…` is disabled unless the active view is markdown in preview — but not because the body worth exporting is markdown, which is printing's reason. It is because **the print stylesheet is markdown-only**: a PDF of a table view or an XML tree would be paginated by rules written for `.markdown-body`, and nothing has looked at that paper. **A later request to export other views is therefore a request to widen the stylesheet, not the entry** (decision-6 makes the source view the natural place to start).

**Nothing automated will verify the paper.** No harness opens a print pipeline, and the headless-Chrome harness in `_sandbox/handoff/task-27/harness/` reproduces none of the three engines — its control run paginates the unstyled page into 16, so it never had the failure TASK-27 chased. What can be automated is the chord decision, which is where TASK-27's tests ended up after review found that a green suite had covered the classifier and not what the handler does with the event.

**AMENDED 2026-09-08: the first sentence lost its premise and the paragraph is rewritten here rather than deleted, because what it says about the Chrome harness is still true.** `write_window_pdf` means mallow can put a PDF through the print pipeline itself, so producing the paper no longer needs a person at the keyboard. Three things replace the sentence, and they are three because they are different code with different ways of failing: the **unattended export** (a build-time mode that opens the document its command line names and writes the PDF after the render settles), the **paper measurement** (`scripts/paper/measure-paper.mjs`, which reads the countable half of the procedure off one PDF and decides pass or fail), and the **paper CI job** (which runs both on three OS runners and keeps the PDFs). **What stays with a person**: whether the type reads comfortably and how a straddling table looks, and AC #2, #3, #4 and #6 — the entry, the chord, the gate and the absence of a print UI, none of which the unattended export goes through. The headless-Chrome harness is still no substitute for any of it: its control run paginates the unstyled page into 16, so it never had the failure TASK-27 chased.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AMENDED 2026-09-08: the verification carries the paper measurement's output; a person adds only what a number cannot say. Whether @media print applies is verified on each platform BEFORE its implementation is called done, because a PDF carrying the explorer and the toolbar is the failure to look for and TASK-28's stylesheet is inert if it does not apply. On macOS this is what decides between NSPrintOperation with a save disposition and WKWebView.createPDF - decision-14 intends the former for exactly this reason
- [ ] #2 File > Export as PDF... and CmdOrCtrl+E both reach the export, and the destination is chosen by the reader through a save dialog rather than written to a default location. AMENDED 2026-09-07: no File submenu exists on any platform yet - mallow's macOS menu carries mallow and Edit only - so the accelerator is the whole entry here, exactly as TASK-27 left printing's, and TASK-12.4 adds both items when it builds the menu on all three. What that costs is that the disabled appearance of AC #4 has nothing to appear on, so #4 is about the chord being inert; what it buys is that the menu file is touched once rather than twice, which is the choice the handoff doc already made for Print....
- [ ] #3 The CmdOrCtrl+E handler consumes the chord even where the export is refused, the way the print chord does. Registering nothing concedes a chord to the platform - that is what let WebView2 print a .csv in TASK-27 - and whether any engine binds Ctrl+E is unmeasured, which consuming it makes moot
- [ ] #4 Export as PDF... is disabled unless the active view is markdown in preview - the same sentence as Print..., recorded with its own reason (the print stylesheet is markdown-only) rather than as a copy of printing's
- [ ] #5 AMENDED 2026-09-08: measured by scripts/paper/measure-paper.mjs and reported with its output, a person adding the visual reading. A PDF written on macOS, Windows and Linux each reaches the document's last page and carries no part of the app shell. This is the criterion TASK-28's AC #1 and #9 could not meet on the print path
- [ ] #6 No platform print UI appears at any point in the export - not a sheet, not a preview, not a dialog. On Linux that is also what keeps the export away from the hang that made print_window refuse there
- [x] #7 The Rust command is write_window_pdf, named for the window for the reason print_window is not print_document: the engine paginates the whole body and @media print only changes what is painted
- [x] #8 The new platform dependencies are the smallest set that works, one per platform and each behind its own cfg, and pnpm notices is regenerated because THIRD-PARTY-NOTICES.md is bundled
- [ ] #9 Whether the macOS export also avoids the stale page count is recorded as an observation either way. decision-14 prefers this API partly because a fresh NSPrintInfo may avoid it, and that is a hypothesis - the cause was never isolated, so a clean export is not proof and a truncated one is not a regression
- [ ] #10 The unattended export is a build-time mode: a build without MALLOW_UNATTENDED=1 contains none of it, it writes nothing in the settings store an installed mallow shares, it waits for the render to settle as an event rather than on a timer, and it reports through exit codes (0 wrote, 1 the export refused, 2 never rendered, 3 unusable arguments)
- [ ] #11 The paper measurement decides the checks a number can settle - the last section is present, no app shell string is on the paper, the type is within tolerance of the platform's baseline, the file is under the size cap, and on Windows no WebView2 header or footer - while page count and paper size are recorded rather than judged; its pure half is covered by pnpm test, and it refuses to measure against a fixture that carries one of its own shell markers
- [ ] #12 The paper CI job writes and measures light and dark paper on macOS, Windows and Linux, keeps the PDFs and the JSON as artifacts, and puts the tables in the run summary. A platform with no baseline records its type size instead of failing, because the first paper is what a baseline is made from and a person has to call it right first
- [ ] #13 AGENTS.md and AGENTS.ja.md name the paper job and the paper measurement in Verifying changes, and check.yml runs exactly what they name - the rule that the documented list and the enforced list cannot drift apart
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**The code is in and no paper has been looked at.** Every check the repository has
is green — `biome ci`, `pnpm build`, `pnpm test` (303), `cargo fmt --check`,
`cargo check`, `cargo test` — and none of them sees a PDF. AC #1, #5, #6 and #9
are measurements, and `_sandbox/handoff/task-30/procedure.md` is what takes them.

## What shipped

- **`src-tauri/src/pdf.rs`** — `write_window_pdf(path)`, one command over three
  `cfg`-separated arms, each reporting through a `tauri::async_runtime` channel so
  the command resolves only once the platform has answered. That indirection is
  for Windows and Linux, whose calls complete after returning; macOS answers
  inside the call and reports the same way for one shape.
  - **macOS**: `NSPrintInfo::new()` → `NSPrintSaveJob` → `NSPrintJobSavingURL` in
    its own dictionary → `printOperationWithPrintInfo:` → both panels off,
    `canSpawnSeparateThread(false)` → `runOperation()`. `respondsToSelector` is
    kept as wry has it (the selector is macOS 11+), but a refusal is reported
    rather than returned as success — the caller named a file it expects to exist.
    **The four margins are zeroed**, because that is the geometry
    `styles/print.scss` was measured against and `@page` should be the only thing
    insetting the block.
  - **Windows**: `ICoreWebView2_7::PrintToPdf(path, None, handler)`. `None` takes
    the default print settings, which per the API docs leave WebView2's header and
    footer off — the thing printing adds and CSS cannot remove. **Unverified**, as
    is the whole arm: see the compile gap below.
  - **Linux**: `webkit2gtk::PrintOperation::print()` (never `run_dialog()`), with
    `output-uri`, `output-file-format=pdf` and printer `"Print to File"`. The
    operation holds itself alive through its own `finished` handler because
    `print()` does not; `failed` stashes the error and `finished` reports once,
    which WebKit's ordering guarantee (`failed` always before `finished`) is what
    makes safe.
- **Frontend**: `lib/chord` gained the mechanism the two chords now share —
  `chordAction` (act / suppress / ignore) and `createChordHandler`, moved out of
  `lib/print` with its Windows measurement intact. `lib/markdown-preview` holds the
  one flag both entries read, so decision-14's "the two enable and disable
  together" is structural rather than a convention. `lib/print` and
  `lib/pdf-export` are each a key, the gate they read and the reason they gate;
  `lib/pdf-export` also holds the two pure path functions
  (`pdfDestinationFor`, `withPdfExtension`). `App` registers the second chord
  beside the first and runs the export: save dialog → `write_window_pdf` → an
  error dialog on rejection, because an export writes a file the reader named and
  silence would read as success.
- **Dependencies** (AC #8): four macOS crates, two Windows, two Linux, each in its
  own `[target.'cfg(...)']` section. **`pnpm notices` produced no diff at all** —
  every one of them was already in the graph through tauri and wry, so
  `THIRD-PARTY-NOTICES.md` already listed them. That holds only while the objc2
  crates carry `default-features = false`: taking their defaults enables every
  class in the framework, which pulled three whole crates
  (`objc2-core-video`, `objc2-javascript-core`, `objc2-security`) into the build
  and the notices on the first attempt.

## Two things a reader of this task has to know before measuring

- **The Windows arm compiles nowhere in this repository's automation.** CI's Rust
  job runs on ubuntu, so `cargo check` there covers the Linux arm and says nothing
  about Windows; the local pass covers macOS. **The measurement round is that
  code's first compile**, so budget for a build error before a print result.
- **The Linux arm's printer name is a guess with a known shape of failure.** WebKit
  resolves the printer by matching `gtk_printer_get_name` and GTK's file backend
  names its printer through gettext, so `"Print to File"` may not be the name on a
  non-English desktop. gtk-rs 0.18 binds neither `GtkPrinter` nor
  `gtk_enumerate_printers`, so enumerating instead means reaching for `gtk-sys` —
  which is the fix if the error dialog says printer-not-found.

## What is deliberately not here

- **The `File` menu item** (AC #2, amended). No `File` submenu exists on any
  platform, so the accelerator is the whole entry, exactly as TASK-27 left
  printing's. TASK-12.4 adds both items — and it now has a third obligation
  besides the two decision-13 gave it: `Export as PDF…` is enabled on Linux where
  `Print…` must be disabled, since printing is refused there and exporting is not.
- **README**. decision-14 leaves the user-facing text to TASK-12.6, which already
  owns the print and shortcut sections and will write both entries at once.
- **`Cmd/Ctrl+,`**. decision-14 names it as the one chord not going through the
  shared resolution. It is left alone: this task did not need to touch it, and
  changing it would drop `Ctrl+,` on macOS, which is a behaviour change worth its
  own decision rather than a drive-by.

## macOS 第 1 回（2026-09-07、`pnpm tauri dev`）— `runOperation()` が白紙を無限に書いた

**実測**: `Cmd+E` → 保存ダイアログ →
`_sandbox/handoff/task-30/mac/print-pagebreaks.pdf` を指定したところ、**CPU が
1 コア貼り付きでアプリが応答しなくなり**、ファイルは伸び続けた。中身は
**318,815,808 バイト / `4,022,381 0 obj` まで / trailer も `%%EOF` も無し**で、
確認したページの content stream はどれも `/Filter /FlateDecode /Length 11`
— **圧縮 11 バイト、つまり空のページが数百万枚**である。

**原因はページ矩形ではない。** 疑いを先に潰した: 新しい `NSPrintInfo` が退化していれば
ページ数が発散するので、その場で測った（macOS 26.6.2、`cargo test` 内）—
**新規も共有も `paperSize` 595×842、`imageablePageBounds` 559×783** で、どちらも正常。
用紙をこちらで設定する必要は無く、余白だけが設定対象である。

**原因は `runOperation()` で、これは既知の WebKit の挙動である。**
`-[WKWebView printOperationWithPrintInfo:]` で作った操作は `runOperation` の下では
白紙を描き、**`runOperationModalForWindow:delegate:didRunSelector:contextInfo:`
を使う**のが定石になっている（modal の名前だが、パネルを off にしてあれば何も出ない）。
ダイアログ無しのレシピはあわせて **印刷ビューの frame を webview の bounds で初期化**する。

**直した形**（未実測）:

- `runOperationModalForWindow:` に変更。**非同期になったので、結果は
  `printOperationDidRun:success:contextInfo:` を実装した
  `MallowPdfExportObserver`（`define_class!`）が受け、既存のチャネルへ流す。**
  **AppKit は `didRunSelector` のデリゲートを retain しない**ので thread_local で
  生かし、**掃除はコールバックの中ではなく次回の書き出し時**に行う —
  自分のメソッドの中で最後の参照を落とすと受信者がメッセージ処理中に解放される。
- `operation.view().setFrame(wk.bounds())`。**これは組版幅ではない**（WebKit は
  ページ範囲を計算する時点で印刷ビューを印刷情報側の矩形に合わせる）が、
  **再測定で紙がウィンドウ幅で切られていたら最初に疑う 1 行**である。
- `canSpawnSeparateThread` は設定しない（wry は true にしている。modal 変種向けの
  設定で、レシピはどれも触っていない）。
- メインスレッドを塞がなくなったので、**応答が止まらない**。代わりに
  **報告が来ない環境ではコマンドが pending のまま残る** — ハングではなく沈黙で、
  タイムアウトは置いていない。

**この回で分かった副産物**: 実測の手順に「ファイルサイズを見ながら待つ」を足した。
正常なら `print-pagebreaks.md` で 1 MB 前後に収まるはずで、数十 MB を超えて
伸び続けたら暴走が戻っている。**AC #9 の観測はまだ 1 度も取れていない** —
紙が出ていないためである。

## macOS 第 2 回（2026-09-07）— 完走した。ただし紙全体が 0.847 倍に縮んでいた

**`runOperationModalForWindow:` は効いた。** 出力は
`_sandbox/handoff/task-30/mac/print-pagebreaks.pdf`、**283 KB / 91 オブジェクト /
trailer と `%%EOF` あり / 12 ページ / A4 595×842**。抽出テキストの末尾に
**`12. 最後の節` とその本文、そして `ここまでが fixture である。`** が入っている —
**末尾まで届いている。** アプリの外殻は無い（一致した語はすべて fixture 本文側の
「設定モーダル」「WebView2 の印刷プレビュー」等で、UI ラベルではない）。
**つまり macOS では `@media print` が当たっている。**

**ただし紙は TASK-27 の完走版と同じ体裁ではない。**
`task-27/mac/paper-mac-light-7a.pdf`（14 ページ・完走）と突き合わせた:

| | 今回 | 7a（印刷経路・完走） |
|---|---|---|
| ページ数 | 12 | 14 |
| ページの clip 矩形 | `45.35 45.35 504 713` | `45.35 45.35 504 750` |
| 語の高さ中央値（2 ページ目） | 15.7 | 18.6 |
| 本文ブロックの左端 | 45.35pt（=16mm） | 45.35pt（=16mm） |

**`504 × 713` は用紙 `595 × 842` のちょうど 0.847 倍である**（7a の `504 × 750` は
`595−2×45.35` × `842−2×45.35`＝倍率 1）。**`@page { margin: 16mm }` が余白ではなく
「ページ全体の縮小」として効いた**という意味で、文字も 0.847 倍（15.7/18.6 = 0.844、
ページ数比 12/14 = 0.857 と整合）。

**印刷情報は無罪。** その場で実測した — 新規 `NSPrintInfo` と `sharedPrintInfo()` は
**辞書レベルまで同一**（A4 595×842、4 辺の余白 0、`NSScalingFactor` 1、
pagination は Clip/Automatic、`NSPrintHeaderAndFooter` のキーは存在しない）。

**打った手**: **印刷ビューの frame を初期化する 1 行を外した。** ダイアログ無しの
レシピはどれも `printOp.view.frame = webView.bounds` を入れており第 1 版はそれに
従っていたが、**あれが、紙が正しいと実測されている wry の経路との唯一の幾何学的な
差分だった。** 外した結果、**この分岐は disposition とパネルの 2 点でだけあの経路と
違う**状態になる。レシピの意図は frame を持たない webview の話で、mallow のそれは
画面上にある。**未実測。**

**次の回で分かること**: 文字が 7a と同じ大きさ（語高さ中央値 18.6 前後、clip が
`504 × 750`）に戻れば frame が原因で確定。戻らなければ **0.8 前後の縮小は
ダイアログ無し経路に固有**ということになり、そのときは印刷用スタイルの 11pt を
書き出し経路向けに見直すかどうかが TASK-28 の判断になる。**紙が完走していることと
外殻が無いことは、どちらの結果でも変わらない。**

**まだ観測できていないこと**: AC #6（印刷 UI が一切出ないこと）は利用者の明示の確認待ち。
AC #9（古いページ数）は手順 6 の 3 手をまだ踏んでいない。

## macOS 第 3 回（2026-09-08）— frame は無罪だった

`pdf-mac-light-2.pdf`（frame の 1 行を外した版）の clip は
**`45.35 45.35 504 713` で第 2 回と完全に同じ**、ページ数もサイズも同じ。
**印刷ビューの frame は倍率の原因ではない。** 外したこと自体は wry の経路との差分を
減らすので戻さないが、**理由は「原因だったから」ではなく「差分を減らすため」に
書き換わる。**

**推測が 2 回外れたので計器を入れた**（`eprintln!` 2 か所。**PR の前に外す**）。
根拠は WebKit の `PrintContext::computePageRects` で、ページ箱の幅を
**`view.contentsWidth()`** から取り、`printRect`（＝用紙）からは**縦横比だけ**を取る:

```
float ratio = printRect.height() / printRect.width();
float pageWidth = view.contentsWidth();
float pageHeight = pageWidth * ratio;
```

**観測している紙はこの形と一致する** — clip の `504 × 713` は用紙 `595 × 842` の
0.847 倍、つまり**ページ箱が用紙の縦横比を保ったまま別の幅で組まれ、余白枠へ
縮小して収められている**。印刷経路の完走版 7a は `504 × 750`（＝用紙 − 4 辺 16mm、
倍率 1）なので、**両者の違いはページ箱の幅**にある。

ログに出すもの: 実行前の paper / 4 辺の余白 / scaling / pagination / imageable、
webview の frame と bounds、印刷ビューの frame。デリゲート側で実行後の
pageRange・paper・4 辺の余白（**`WKPrintingView` はヘッダ・フッタのぶんを
印刷情報の余白へ書き戻す**）・scaling・印刷ビューの frame。

**次の回の依頼**: 同じセッションで 2 回書き出し、**ウィンドウ幅を大きく変えてから
2 回目**を取る。倍率がウィンドウ幅で変わるなら、書き出しの紙は**画面の状態に
依存している**ことになり、組版幅を固定する手当てが要る。

## macOS 第 4 回（2026-09-08）— 計器が原因を確定させた。倍率は「1 回目のページ計算」の産物

**ウィンドウ幅は無関係**（webview 1292 と 2128 の 2 回で、印刷ビューは両方
`505 × 8561`、ページ範囲も 12 で同一）。**書き出しの紙は画面の状態に依存しない。**

**ログの 3 行目が原因を指した**:

- **実行前の余白は 0、実行後は 4 辺とも 45.354pt（= 16mm）。**
  **WebKit は `@page { margin: 16mm }` を読んで印刷情報に書き戻している** —
  ただし**ページ箱を計算した後に**である。
- **印刷ビューは `505 × 8561` で 12 ページ、1 ページ 713.4。**
  **`713.4 = 505 × (842 / 595)`** — 幅は余白を引いた後の 505 なのに、
  **高さは用紙の縦横比から計算されている**（余白枠の正しい高さは 751）。
- 倍率は本物だった。同一文字列 `ここまでが` の幅は **54.30 対 64.07 = 0.847 = 504/595**
  （最初に見た「語高さの中央値」はページ 2 の内容差の疑いがあったので測り直した）。

**つまり 1 回目のページ計算は 2 つの幾何を混ぜている**: 幅は余白枠、高さは用紙比、
組版は用紙幅で行われて 504/595 に縮小される。

**そして TASK-27 の「シートでプリンタを切り替えると直る」がここで説明される。**
切り替えが起こすのは**ページ計算の 2 回目**で、そのときには 1 回目が書き戻した
16mm が印刷情報に入っているから、幅も高さも余白枠で揃う。
**`paper-mac-light-7a.pdf` はその 2 回目の紙**（ページ箱 `504 × 750`、倍率 1）である。
**書き出しは 1 回しか走らない**ので、1 回目の幾何がそのまま紙になる。

**打った手**: **`@page` が要求する余白を、実行前にこちらから印刷情報へ入れる** —
1 回目を 2 回目と同じ状態から始める。値は `styles/print.scss` の写しになるので、
**`page_margin_matches_the_print_stylesheet` が `@page` の値を読み出して突き合わせる**
（`commands.rs` が `tauri.conf.json` から asset scope を読み出すのと同じ形）。
**このテストは `cfg(target_os = "macos")` なので CI（ubuntu）では走らない。**

**次の回で確かめること**: ページ箱が `504 × 751`、ページ数 14、
`ここまでが` の幅が 64 前後（等倍）に戻ること。計器は入れたままにしてある。
**二重余白（32mm）になっていないこと**も見る — 7a の実測がそうならない側の証拠だが、
確かめるまでは仮説である。

## 実装 PR に出す時点の状態（2026-09-08）

**一時計器（`eprintln!` 2 か所）は外した。** 役目は終わっている — あれが名指しした
「1 回目のページ計算が幅と高さで別の幾何を使う」ことへの手当てが入っている。

**その手当ては未実測のまま実装 PR に出る。** 根拠は実測（実行前後の余白 0 → 45.354、
印刷ビュー `505 × 8561`、`713.4 = 505 × 842/595`、同一文字列の 0.847 倍）で、
7a が 2 回目のページ計算の紙だという読みと整合するが、**新しい紙をまだ 1 枚も見ていない。**
検証は **TASK-30 の 2 本目の PR**（無人書き出し・紙の計測・紙の CI ジョブ。
指示書は `_sandbox/handoff/task-30/unattended-export.md`）に移す — あれが入れば
人手なしに紙を作って測れるので、**この手当ての確認が実機往復を 1 回も使わない。**
計器と同じ値が要るなら、無人書き出しの側に置き直す。

## 2 本目の PR（2026-09-08）— 計器が入り、その初回が 2 つの欠陥を見つけた

**PR は 2 本**: **#50**（実装。[P1] 3 件 → 修正 → APPROVED → CI 発の 2 件を追加修正 →
再び APPROVED）と **#51**（無人書き出し・紙の計測・紙の CI ジョブ。#50 に stacked）。
**どちらも未マージ。**

**手元での成果 — 余白の手当ての検証に実機往復を 1 回も使わなかった。**
無人書き出しが書いた紙は **14 ページ・ページ箱 `504 × 750`・語の高さ中央値 18.55**
（基準は印刷経路の完走版 18.56、差 0.1%）。**0.847 倍の縮小は消え、幾何は印刷経路の
正しい紙と一致**した。dark も同値。紙は `mac/pdf-mac-{light,dark}-5.pdf`、
相対パス修正後の再確認が `pdf-mac-light-6.pdf`。

**紙の CI ジョブの初回実行が、手元では見つからない 2 件を出した。**

1. **Windows 分岐がコンパイルできていなかった**（`pdf.rs`）。webview2-com のマクロは
   完了ハンドラの引数を closure が見る前に変換する — `ClosureArg for HRESULT` は
   `windows::core::Result<()>`、`ClosureArg for BOOL` は `bool` を出す — ので、
   `hr.ok()` と `written.as_bool()` はどちらも存在しないメソッドの呼び出しだった。
   **あの分岐がどこかでコンパイルされた初めての機会がこの CI ジョブ**であり、
   「Windows の分岐はどの自動検査でもコンパイルされない」と書いていた穴が
   そのまま現実になっていた。
2. **相対パスの保存先が、環境ごとに違う壊れ方をし、片方は沈黙した。** CI が
   `paper/x.pdf` を渡したところ、Linux は
   `The pathname … is not an absolute path` で停止し、**macOS は
   `CFURLGetFSRef was passed a URL which has no scheme` をログに出して
   何も書かずに成功を返した**（`fileURLWithPath:` が相対 NSURL を作る）。
   **`write_window_pdf` の中で絶対パスへ正規化**したので、保存ダイアログ以外の
   すべての呼び出し元が守られる。テスト 2 件。

**紙の計測が既知の紙で検算できることも確認した**: 印刷経路の完走版 PASS、
末尾が落ちた紙は「最後の節」で FAIL、0.847 倍の紙は倍率で FAIL。

**レビューで直した 3 件（#51）**: paths フィルタが狭すぎた（列挙は同じ形で古び、
**失敗が沈黙**するので粗くした）、悪い文書で 60 秒待ってから「描画に届かない」と
言っていた（待つ前に exit 3 で拒否し種類を名指し）、未知の `--os` が倍率と
Windows のヘッダ検査を両方飛ばして PASS を返しえた（閉じた集合に）。

**まだ人間に残るもの**: AC #2・#3・#4・#6、合格した紙の目視、
**Windows と Linux の紙**（1 回目は Windows がコンパイルで、Linux と macOS が
相対パスで落ちたので、まだ 1 枚も出ていない）、AC #9。

## レビュー 3 ラウンドで残った 1 件は、人に返す種類のものだった（2026-09-08）

**#51 は 3 ラウンド回した**（[P1] 1 + [P2] 3 + [P3] 1 → [P1] 4 → [P1] 2）。
**そのうち機械が決められないものが 1 つ残る。**

**紙の CI ジョブが 2 回の実行で見つけたもの（どれも手元では見えない）:**

1. **Windows のコンパイルエラー 2 件**（`pdf.rs`）— 引数の型（webview2-com のマクロが
   `HRESULT` → `Result<()>`、`BOOL` → `bool` に変換する）と、sender の所有権（E0382。
   handler が奪うので同期の失敗経路用に clone が要る）。**どちらも #50 で修正。**
2. **相対パスの保存先** — Linux は明示エラー、**macOS は何も書かずに成功を返す**。
   `write_window_pdf` の中で絶対パスへ正規化（#50）。
3. **Windows のテスト実行ファイルが起動しない** — `0xc0000139`
   （STATUS_ENTRYPOINT_NOT_FOUND）。lib のテストバイナリは `target/debug/deps` から
   起動し、アプリの隣の WebView2 ローダがそこに無い。**Windows はビルドのみ**
   （`cargo test --no-run`）にした。あの環境で重要なのはコンパイルが通ることで、
   実際このジョブが捕まえた 2 件はどちらもコンパイルエラーだった。
4. **Linux は初めて紙を出し、合格した** — プリンタ名の GTK 列挙がランナーで通った。
   この分岐でいちばん自信の無かった箇所である。

**レビュアーが見つけた、自力では直さなかったであろう欠陥:**
**基準値をプラットフォームで持ち、手元の数字を CI ランナーに当てていた。**
ランナーの macOS は同じ文書を 21.00 と測る（手元は 18.56）。**その差の中で、
このタスクが追ってきた 0.847 倍の縮小は 17.79 = 4.2% 差となり、許容 5% を通る。**
つまり**間違った機械の基準は、検査が存在する理由そのものの欠陥を通す**。
キーを環境名にし（CI は `ci-<platform>`）、性質をテストで固定した。

**残る 1 件は人に返した。** 3 環境の `ci-*` 基準値は、**誰かがランナーの紙を開いて
「この文字サイズで正しい」と言うところから**しか来ない。仕組みだけ入れてある:
`baseline.json` の **`_required`** に載っているキーはエントリが無ければ**落ちる**、
まだ許される飛ばしは `NOT CHECKED: … so a scaled paper would pass here` と出す。
**私が artifact を読んで数字を打ち込むのは、`_required` が終わらせようとしている
「誰も見ていない」状態そのものなので、やらなかった。**

**次の一手（維持者）**: #50 → #51 の順にマージ。紙のジョブの artifact を開いて
3 環境の紙を確認し、正しければ `baseline.json` に `ci-macos` / `ci-linux` /
`ci-windows` の数字と `_required` を同時に足す（各 1 行）。
<!-- SECTION:NOTES:END -->
