---
id: TASK-69
title: >-
  Show the open file's dates, size and text counts at the right of the status
  bar
status: Done
assignee: []
created_date: '2026-11-18 22:06'
updated_date: '2026-11-23 03:04'
labels:
  - feature
dependencies: []
references:
  - src/App.tsx
  - src/styles/app.scss
  - src-tauri/src/commands.rs
  - src/lib/file.ts
  - src/lib/types.ts
  - src/components/SourceView.tsx
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The window's bottom bar (`.app__footer`) holds only the settings button at its left end. The request (2026-11-19) is to use its right end for facts about the open file: its **creation date**, **modification date**, **size**, and — for text files only — its **character count** and **line count**.

**Where the facts come from.** `read_dir_tree` already returns each entry's `modified` and `created` (TASK-61), but the `FileEntry` a restored session synthesizes from a bare path (`lib/file`) carries neither, and no size is carried anywhere. So the selected file needs its own metadata read (a small command beside `read_file`, or a size added to what the tree already returns) — decide which, keeping in mind `read_dir_tree` is read per folder and lazily. The live watch (`fs:change`) re-reads the document on a change, and these facts follow it.

**Settle at the start.**
- **Character count's unit**: grapheme clusters (what a reader counts; `Intl.Segmenter`), code points, or UTF-16 units — and its cost on a file near `read_file`'s 10 MiB cap, on the main thread. Whether line breaks count as characters.
- **Line count's rule**: the same number the source view's last line number shows, so the two never disagree (a trailing newline, CRLF).
- Markdown and decks are counted on their **source text**, not the rendered result — stated in the UI or README.
- **Size**: bytes on disk, with the unit base (1000 or 1024) and the precision chosen once.
- **Dates**: format per UI language (`lib/i18n`), with or without the time. A filesystem with no creation time (`Metadata::created` errors on some Linux filesystems) shows a stated absence, not a wrong date.
- Whether the bar's information is a preference the reader can turn off.

**Which files.** Text kinds (markdown, config, CSV / TSV, XML, HTML, plain text) get all five; media (image / PDF / video) get dates and size only, since no text is read for them; a file that failed to read (`ReadError`: binary, invalid UTF-8, too large) gets dates and size and no counts. With no file open the right end is empty.

**Sharing the bar.** TASK-68 shows a hovered link's destination at the left end of the same bar; when the window is narrow the destination takes precedence and this information yields (truncates or hides) by a stated rule, and the bar never grows taller or wraps.

Before building, read snz-design doc-16 (§7.2) and mallow's adoption record (doc-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The character count's unit, the line count's rule, the size unit, the date format and whether the information can be turned off are decided and recorded before implementation
- [x] #2 With a file open, the right end of the bottom bar shows its creation date, modification date and size, including for a file selected by session restore
- [x] #3 A text file also shows its character and line counts, and the line count matches the source view's last line number
- [x] #4 Media files and files that failed to read show dates and size without counts; a missing creation time is shown as absent by a stated rule
- [x] #5 An edit to the open file picked up by the live watch updates every shown value
- [x] #6 In a narrow window the information yields to TASK-68's link destination by a stated rule, and the bar does not grow taller or wrap
- [x] #7 Counting a file near the 10 MiB read cap does not stall the view (measured)
- [x] #8 Checked on macOS, Windows and Linux builds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の決定 (2026-11-21, オーナー確認):
- 文字数: 見た目の 1 文字を単位に数える (絵文字の 👍🏽 や濁点付きの「が」も 1 文字。Unicode の拡張書記素クラスタで、Intl.Segmenter の grapheme)。改行 (LF・CR・CRLF は 1 つ) は数えず、空白とタブは数える。10 MiB で 1.8 秒かかる (Node 24 / V8 で測定) ので、メインスレッドで区切って数え、途中で処理を返す。数え終わるまでは「数えています…」を出す。
- 行数: ソースビューの最後の行番号と同じ規則 (末尾の改行はいくつあっても落とし、CRLF は 1 行)。同じ関数を両方が使う。
- サイズ: ディスク上のバイト数 (Metadata::len)。1024 基数の KiB / MiB で小数 1 桁、1 KiB 未満はバイト。
- 日付: Intl.DateTimeFormat (UI 言語, dateStyle medium, timeStyle short) で分まで。作成日が取れないときは「作成 不明」と語で出す。
- 数える対象: Markdown とデッキはレンダリング結果ではなく元のテキスト。README に書く。
- 狭い窓: リンク先表示が自然な幅を保ち、ファイル情報は残りの幅に入る。入らない分は末尾を省略記号で切る。並びは左から 更新・サイズ・行・文字・作成 で、切れるのは後ろの項目から。バーは 1 行のまま。
- オフにする設定は作らない。

1. Rust: read_file の隣に file_info (size・modified・created) を置く。read_dir_tree を広げないのは、メディアは read_file を通らず、セッション復元が作る FileEntry は値を持たないため。パスの変更と watch の reload で読み直す。
2. lib: 行数の規則をソースビューと共有する関数に切り出し、サイズと日付の書式、区切って数える文字数の数え方を純関数で持つ。単体テストを付ける。
3. 窓ごとのストア: Viewer が開いているファイルの事実 (情報・読んだテキスト・読めなかったか) を載せ、フッターの FileStatus が読む。
4. フッター: app.scss でリンク先を優先する幅の配分。i18n (ja/en)、README。
5. 10 MiB 近いファイルで区切りの長さを測る。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判断は Implementation Plan の冒頭に記録した (2026-11-21、オーナー確認)。文字数は推奨案 (見た目の 1 文字、改行を除く)、サイズは 1024 基数の KiB / MiB をオーナーが選んだ。「書記素」という語は馴染みがないとの指摘を受け、README と UI では「見た目の 1 文字」と書き、書記素クラスタの語はコードと AGENTS にだけ残した。

実装:
- Rust に `file_info` (size・modified・created) を足した。`read_file` に混ぜないのはメディアをテキストとして読まないため、`read_dir_tree` から取らないのはセッション復元が選ぶファイルにツリーの項目が無いため。`Viewer` がパスの変更と watch の reloadToken で読み直す。
- `lib/file-status` が窓ごとの事実 (パス・情報・読んだテキスト) を持ち、フッターの `FileStatus` が読む。別のファイルを開くと前の値を消し、同じファイルの再読み込みでは残す (ちらつかない)。もう表示していないファイルへの遅れた答えは捨てる。
- 行数は `source-cap` の `shownLineCount` で、ソース表示が使う `shownSource` をそのまま通すので、2 つは構造上ずれない。
- 文字数は `lib/char-count` のジェネレータを `runInSlices` で 8ms ずつ走らせ、数え終わるまでは「文字数を数えています…」を出す。Web Worker にしなかったのは、カスタムスキーム (tauri://) 上のモジュール Worker が 3 つの WebView で動くかを測る必要が増えるため。区切りは時計で決めるので、エンジンの速さによらず 1 回の長さが抑えられる。
- 並びは 更新・サイズ・行・文字・作成。リンク先表示は自然な幅を取り (flex: 0 1 auto)、ファイル情報は flex-basis 0 で残りだけを取る。溢れた行は左から始まり末尾が省略記号で切れるので、後ろの項目から消える。全文は title に入れた。
- `tsconfig` の lib に `ES2022.Intl` を足した (`Intl.Segmenter` の型のため。実行時の影響は無い)。

確認:
- AC #7 (10 MiB 近くを数える): 10,320,000 バイト (日本語・英語・肌の色付き絵文字・CRLF 混在、129,000 行、6,579,000 文字) で測った。Blink (Claude のブラウザペイン、Chrome 156) は 3 回で計 590〜609ms、1 回の区切りは最大 8.2ms、フレームの間隔は最大 16ms。WebKit (Safari 27.2、macOS) は 2 回の読み込みで計 6 回、計 1.0〜1.8 秒、区切りは最大 16ms (95 パーセンタイル 8ms)、フレームの間隔は最大 34ms で 50ms を超えたものは 0。Safari の最初の 1 回だけ 529ms の間隔があったが、窓を開いた直後のもので、区切りは最大 30ms だった。行数は 7〜36ms で同期に数える。測定用のページは削除済み。
- AC #6 (狭い窓): 実際の app.scss と LinkStatus・FileStatus を載せたページ (Blink) で、フッターの幅を 900・600・420・260px、リンク無し・web・長い相対パス (札付き) の組み合わせで測った。すべてでバーの高さは 32px のまま、フッターの横のはみ出しは無かった。リンク先は自然な幅を保ち、ファイル情報は残りの幅で末尾から切れ、リンクが幅を全部使うと 0 になった。
- AC #3: 行数の規則は単体テスト (空・末尾の改行の連続・CRLF・空行) で確かめた。ソース表示と同じ関数なので、表示がずれることはない。
- `formatSize`・`formatTime`・ストア・文字数 (絵文字の修飾・結合濁点・国旗・CRLF・タブ)・区切りの止め方に単体テストを付けた。`pnpm mutation` (char-count・file-status) で生き残った 6 件のうち 5 件をテストで殺し、残りの 1 件 (`granularity: 'grapheme'` の省略。既定値なので等価) を理由付きで accept した。
- pnpm lint (既存の info 1 件のみ)、pnpm build、pnpm test (60 ファイル・765 件)、cargo fmt --check、cargo check、cargo test (130 件) が通った。

未確認として残したもの (実際のアプリで見ていない):
- AC #2: セッション復元で選ばれたファイルでも出ること。`file_info` はパスだけを読むので構造上は出るが、復元して見てはいない。
- AC #4: メディアと読めなかったファイルで日時とサイズだけが出ること、Linux で作成日時が無いときに「作成 不明」と出ること。表示の規則はページで確かめたが、実際のアプリの経路では見ていない。
- AC #5: ライブ更新で、編集した後にサイズ・更新日時・行数・文字数がすべて動くこと。
- AC #8: macOS・Windows・Linux の実ビルド。WebKitGTK の `Intl.Segmenter` (2.32 以降) と WebView2 での区切りの長さも未測定。
- 既存の不足として、README.ja.md には TASK-68 のリンク先表示の説明が無い (README.md にはある)。今回は触れていない。

実機確認 (2026-11-22〜23、オーナー。上の「未確認」はこれで埋まった):
- macOS (ビルドしたアプリ): sample.md でサイズ・行数・文字数がソース表示と一致 (55 B・4 行・20 文字)。追記でライブ更新し、更新日時・66 B・7 行・30 文字に変わって、ソース表示の最終行番号も 7 だった (AC #3・#5)。画像 (53.9 KiB)、read_file の上限を超えたファイル (10.5 MiB)、読めなかったファイル (3 B) では日時とサイズだけが出た (AC #4)。セッション復元で選ばれたファイルでも出た (AC #2)。狭い窓ではリンク先が残り、ファイル情報が末尾から切れた (AC #6)。
- near-cap.md (10 MiB 近い Markdown) の文字数は、プレビューが出てから約 1 秒で数え終わった。プレビューを出すまでの約 20 秒は v0.15.0 でも同じで、TASK-69 によるものではない (Markdown の描画そのものの時間)。
- Windows・Linux: 表示を確認して OK (AC #8)。文字数が出たので WebKitGTK でも Intl.Segmenter は動いている。区切り 1 回の長さは WebView2・WebKitGTK では測っていない。
- Linux の作成日時は ext4 上で普通に出た。「作成 不明」は Metadata::created がエラーを返すとき、つまり statx が birth time を返さないファイルシステム (NFS、VM の共有フォルダなど) でだけ出る。その表示は単体テストで確かめ、実機では出していない。
- 確認中に気づいた TASK-68 側の点: 見出しの無いフラグメント (#カスタム絵文字) へのリンクは、markdown-it がエンコードした href のまま (#%E3%82%AB…) 表示される。TASK-69 の範囲外なので触れていない。
<!-- SECTION:NOTES:END -->
