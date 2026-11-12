---
id: TASK-31
title: >-
  Find why the Linux paper does not start where @page puts every other
  platform's
status: Done
assignee: []
created_date: '2026-09-08 20:52'
updated_date: '2026-11-12 21:28'
labels:
  - bug
  - 差し込み
milestone: m-5
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-09-08 in CI (run 34216957411, `paper-linux-light.pdf` / `-dark.pdf`): **the body of the Linux paper starts at x=18pt, where every other paper starts at 45.4pt — the 16mm `@page` margin.** macOS (both the runner's Letter paper and this project's A4 one) and Windows all place it at the margin; Linux does not. The same run's other checks pass on that paper: it reaches the fixture's last section and carries no part of the app shell, so **`@media print` is reaching that arm — partly.** TASK-30's AC #1 therefore answers "yes" for macOS and Windows and "in part" for Linux.

**Do not write "the Linux paper has no margin".** Three separate layers can produce one, and only one of them is mallow's: the `@page` margin `styles/print.scss` asks for, the print operation's own margins (GTK's `GtkPageSetup`, the layer macOS's `NSPrintInfo` margins occupy), and the paper's imageable area, which is a constraint rather than a margin. What is measured is where the body starts, not which layer decided it. The referent table for this is `_sandbox/handoff/referent-table/referent-table-task-31-linux-page-margin.md` (outside git).

**Two candidates, neither of them an observation.** `pdf.rs`'s Linux arm passes a `GtkPrintSettings` (printer, output uri, output format) and **never a page setup**, so the operation's own margins are whatever the default is; and 18pt is about 6.35mm, which is the shape of a backend's imageable-area inset rather than of a CSS value. **The macOS half of this task already punished one confident diagnosis of exactly this kind** — the paper there was blamed on `@page`'s margin when the cause was the order in which the page box is computed — so this task is written to be measured rather than reasoned.

**The paper is accepted as it stands** (maintainer, 2026-09-09) and this is deliberately not in m-3: the export works on Linux, which matters more there than anywhere else, because printing is refused on that platform and this is the only way a page leaves mallow at all. What is wrong is how the paper is laid out, not whether it can be had.

**The instrument is already watching it.** `scripts/paper/measure-paper.mjs` records the text extent on every run, and `ci-linux` carries a baseline whose note names this defect, so a change in that arm's paper shows up as a measured difference rather than as a surprise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The layer that places the body at 18pt is identified by measurement rather than by reading: which of the @page margin, the print operation's page setup, or the imageable area decides it, shown by changing one at a time and reprinting
- [x] #2 Whether WebKitGTK honours @page margins at all on this path is answered, because the two candidates differ in what a fix would be - an unset page setup is ours to set, an ignored @page is not
- [x] #3 If the fix is ours, the Linux paper's body starts at the same 16mm as macOS and Windows, measured by scripts/paper/measure-paper.mjs rather than by eye, and ci-linux's baseline is retaken because the type may move with it
- [x] #4 If the fix is not ours, that is recorded in AGENTS.md as a platform difference with the evidence, the way the print path's three-way asymmetry is, and the ci-linux baseline note is rewritten to say so rather than to describe a defect that is being carried
- [x] #5 The Linux paper's size is looked at while this is open: 4.3 MB against 314 KB on macOS and 543 KB on Windows for the same document. It may be font embedding and it may be the same cause, and it costs nothing to record which
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 計測環境
CI ランナーと同じ ubuntu 24.04 の Docker コンテナ（arm64、libwebkit2gtk-4.1 / xvfb / fonts-noto-cjk / poppler）で無人書き出しを実行し、`scripts/paper/measure-paper.mjs` の記録項目（本文の x 範囲）で比較した。修正前の再現値は x 18.0–568.0・15 ページ・Skia/PDF m145・CJK 送り幅 12.80 で、CI run 41727437237 と一致する。実験用の分岐はコンテナ内のコピーにだけ当て、リポジトリには入れていない。

## AC #1 — 本文の位置を決めている層（1 回の印刷で 1 層だけ変えた）
| 実験 | `@page` の余白 | GTK page setup の余白 | 本文の x 範囲 | ページ数 |
|---|---|---|---|---|
| b0 | 16mm | 渡さない（既定） | 18.0–568.0 | 15 |
| e1 | 16mm | 0pt | 0.0–588.4 | 14 |
| e2 | 16mm | 45.35pt（16mm） | 45.4–544.9 | 16 |
| e3 | 30mm | 0pt | 0.0–588.4 | 14 |
| e4 | 30mm | 渡さない | 18.0–568.0 | 15 |
| e5 | 0 | 渡さない | 18.0–568.0 | 15 |

本文の位置を決めているのは印刷操作側の余白（GTK の page setup）である。`gtk_page_setup_new()` の既定は A4 で上 18 / 右 18 / 下 40.32 / 左 18pt で、18pt はここから来ている。印字可能領域の制約ではない（page setup の余白を 0 にすると本文は x=0 まで出て、ファイル出力のバックエンドは何も削らない）。

## AC #2 — WebKitGTK はこの経路で `@page` の余白を読むか
読まない。`@page` を 0・16mm・30mm と変えても、同じ page setup の下では PDF のバイト数まで一致した（e1=e3、b0=e4=e5）。変更した CSS がバイナリに入ったことは、dist の CSS（`@page{margin:0}`）とバイナリの更新時刻で確認した。したがって修正は mallow 側でできる（page setup を渡す）。

## 修正
Linux 分岐で `GtkPageSetup` を作り、4 辺の余白を `page_margin_points()`（16mm）にして `set_page_setup` で渡す。用紙は `gtk_page_setup_new()` がロケールから選ぶ既定のまま（今回の環境では iso_a4）なので、余白だけが変わる。`page_margin_points` と、`print.scss` の `@page` から値を読み戻すテストは、macOS 専用から macOS + Linux に広げた。テストは macOS と Docker の Linux の両方で通った。修正後の Docker の紙は x 45.4–544.9・16 ページ・CJK 送り幅 12.81 で、macOS / Windows の 16mm と同じ位置から始まる。

## AC #3 — 未チェック（当時。2026-11-13 に取り直し済み、末尾の「AC #3 — ベースラインの取り直し」を参照）
ci-linux のベースライン取り直しは、この PR の paper ジョブの紙を人が見て文字サイズを認めてからにする（baseline.json の手順どおり）。Docker の 12.81 は手元の環境の値であり、CI ランナーの数としては使わない。

## AC #4 — 該当なし
修正が mallow 側にあったので、「修正できない場合はプラットフォーム差として記録する」の前提が成り立たない。AGENTS.md / AGENTS.ja.md には、WebKitGTK が `@page` を読まないことを計測付きで残した（PDF export の段落）。その際、同じ段落にあった「`NSPrintInfo` の 4 辺の余白は 0 にする」という記述が現行コード（16mm に設定している）と食い違っていたので、Linux の記述と合わせて書き直した。

## AC #5 — Linux の紙のサイズ
CI run 41727437237 の paper-linux-light.pdf（4,335,763 bytes）をストリームの種類ごとに集計した。フォントファイルが 3,258,453 bytes（75.2%）で最大で、DejaVuSans-Bold が 4 回（計 1.41 MB）、LiberationMono が 6 回（計 1.08 MB）と、同じ TrueType フォントがほぼ丸ごと何度も埋め込まれている（サブセット表記はあるが、1 回あたりのサイズが元フォントの圧縮後とほぼ同じ）。次に大きいのは Noto Sans CJK JP の Type 3 グリフ 636 個で 539,917 bytes（12.5%）。画像は 2.3%、ページ本文は 0.9%。macOS の紙（339 KB）は CJK を CID Type 0C で 1 回ずつ埋め込んでいる。サイズの原因は Skia/PDF のフォント埋め込みであり、余白とは別の原因である。修正後もサイズはほぼ同じ（4,283,190 → 4,283,978 bytes）。

## 修正後の紙の判定（レビュー対応で追記）
- この PR の CI run 43305943952（paper ジョブ、ubuntu-latest）：light / dark とも measure-paper.mjs の判定は PASS。本文 x 45.35–545.9、16 ページ、A4、CJK 送り幅 12.81（基準 12.80 との差 0.1%）。TASK-36 の検査（9 列の表の右端の値がすべてあり、ページの右端をはみ出す語がない）も通った。サイズは light 4,337,039 / dark 3,491,591 bytes。
- 手元の Docker の紙も同じく PASS（本文 x 45.4–544.9、16 ページ、CJK 送り幅 12.81）。
- baseline.json の ci-linux はまだ修正前の紙の数（12.8）で、注記を「レイアウトは 16mm に移った・取り直し待ち」に書き換えた。取り直しは、修正後の紙を人が見て文字サイズを認めてから行う（AC #3 はそれまで未チェック。後に取り直し済み、次節を参照）。

## AC #3 — ベースラインの取り直し
メンテナが run 43305943952 の Linux の紙（light）を見て文字サイズを認めた（2026-11-13）ので、ci-linux を 12.80 → 12.81（同 run の CJK 送り幅の中央値）に取り直し、注記も書き直した。新しい基準で同 run の light / dark を測り直し、どちらも PASS（差 0.0%）。AGENTS.md / AGENTS.ja.md の paper の節も取り直し済みの記述に更新した。

## 実デスクトップでの確認（マージ前、2026-11-13）
UTM の Ubuntu 24.04.5（aarch64、WebKitGTK 2.52.6、GNOME の Wayland セッション、ロケール en_US）で、修正版の無人書き出しを実行した。GTK の既定の用紙がロケールに従って Letter（612×792）になり、本文 x 45.4–561.0・17 ページ・CJK 送り幅 12.81。measure-paper.mjs の判定は light / dark とも PASS（このキーのベースラインは無いので、文字サイズの検査は記録のみ）。A4（CI）でも Letter（UTM）でも本文は 16mm から始まり、page setup が余白だけを変えて用紙はロケールに任せていることを確かめた。

PR: https://github.com/serendipitynz/mallow/pull/95
<!-- SECTION:NOTES:END -->
