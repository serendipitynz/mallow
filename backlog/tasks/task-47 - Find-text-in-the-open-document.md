---
id: TASK-47
title: Find text in the open document
status: Done
assignee: []
created_date: '2026-11-03 19:23'
updated_date: '2026-11-04 21:11'
labels:
  - feature
milestone: m-7
dependencies:
  - TASK-46
references:
  - src/components/MarkdownView.tsx
  - src/components/SourceView.tsx
  - src/components/Outline.tsx
  - src/lib/chord.ts
  - src/lib/markdown-preview.ts
  - src-tauri/src/menu.rs
priority: medium
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reader looking for a word in the open document has no way to find it: mallow has no find. This task adds find-in-document — `Cmd/Ctrl+F` opens a find bar over the active view, matches are highlighted, and the reader steps through them — for the markdown view (both preview and source) and every view that renders through `SourceView`. It searches the open document only; finding files by name and searching across the folder are separate tasks, not started.

What is searched is the text the view has rendered, so a value a view withheld at its caps is not found (the table's `TABLE_MAX_ROWS`, the XML tree's `XML_MAX_NODES`) — the views in this task withhold none, since `SourceView` above its caps gives up the highlighting and never the content. UI chrome inside the article — the code-copy buttons, the mermaid controls — is not document text and is excluded. Text inside a rendered mermaid diagram is excluded too: it is SVG, which TASK-46 does not measure.

Matches are painted with the CSS Custom Highlight API, never by wrapping them in elements, because the article must not be written to outside its enhancements (TASK-29's invariant). TASK-46 is what establishes the API works on all three WebViews; this task does not start until it has.

Matching, settled with the owner (2026-11-04): a substring match, case-insensitive, with full-width and half-width forms treated as one (NFKC), and hiragana and katakana kept distinct. Offsets are taken in the normalized text and mapped back to the original's, since NFKC changes lengths. A match may cross inline element boundaries within one block (`foo**bar**` matches `foobar`), so text is joined per block before matching. No case, regex or whole-word options — whole-word means nothing in Japanese text.

Moving to a match has to clear `.doc__bar`. `scrollIntoView` on an element honours the scroller's `scroll-padding-top`, but a Range has no `scrollIntoView`, so a scroll computed from a rect must read that padding back from the scroller the way `Outline` does, rather than restating the bar height.

The chord is consumed in every view, including those without find, on `lib/chord`'s rule: registering nothing concedes `Ctrl+F` to the platform, and WebView2 carries a find of its own. The Edit menu gains Find…, Find Next and Find Previous, gated per window on whether the active view supports find, the way `lib/markdown-preview` gates `Print…`. The menu's accelerators are not relied on, since they do not arrive on Windows (the `Ctrl+W` finding).

The query outlives the document under it: a watcher reload, the preview / source toggle and moving to another file all keep the bar open and re-run the same query (settled with the owner, 2026-11-04). It is not a preference and is not shared across windows.

Out of scope, for a follow-up once this lands: the config and XML trees (settled: collapsed nodes are searched, and a match expands its ancestors), the CSV / TSV table, and the rendered HTML view, whose frame TASK-46 measures separately. In those views the chord is consumed and the menu entries are disabled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cmd+F on macOS and Ctrl+F on Windows and Linux opens a find bar with the focus in its input, in the markdown preview, the markdown source and every view rendering through SourceView
- [x] #2 Matching is a case-insensitive substring match with full-width and half-width forms treated as one (NFKC) and hiragana and katakana kept distinct, and a match may cross inline element boundaries within a block; the pure matching and offset mapping are unit-tested
- [x] #3 Matches are painted with the CSS Custom Highlight API and the current match is drawn distinctly from the rest; finding writes nothing into the article's DOM
- [x] #4 Enter and Shift+Enter, and Cmd+G / Cmd+Shift+G on macOS or F3 / Shift+F3 on Windows and Linux, move to the next and previous match, wrapping at the ends, and the current match is scrolled into view clear of .doc__bar
- [x] #5 The bar shows the current position and the total (n / m), a zero-match state, and stops counting at 1,000 with 1000+; the count reaches a screen reader through a live region
- [x] #6 Escape closes the bar, clears every highlight and returns the focus to where it was before the bar opened
- [x] #7 The chord is consumed in every view, including those without find, and the Edit menu carries Find…, Find Next and Find Previous on all three platforms, disabled in a window whose active view has no find
- [x] #8 A watcher reload, the preview / source toggle and moving to another file keep the bar open and re-run the same query
- [x] #9 The input follows snz-design doc-8 §6.3, and every string is in both the ja and en dictionaries
- [x] #10 pnpm lint, pnpm build and pnpm test pass, and cargo fmt --check, cargo check and cargo test pass inside src-tauri/
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/lib/find.ts (純粋関数): 文字列を NFKC + 小文字化で畳み込み、畳み込み後の各コード単位から元の位置へ戻す対応表を持つ。結合文字と半角の濁点・半濁点 (U+FF9E/FF9F) は直前の文字と一緒に正規化する。ブロックごとにテキストノードを連結して検索し、一致をノード番号と位置に戻す。1,000 件で打ち切る。前後移動の折り返しもここ。
2. src/lib/find-target.ts: 今の表示の検索対象 (検索するルートとスクロール枠) をウィンドウに 1 つ持つ。markdown プレビューは article を、SourceView は自分を登録する。markdown-preview と同じ形で、有無を App とメニューに知らせる。
3. src/lib/find-chord.ts: Cmd/Ctrl+F と、macOS の Cmd+G / Cmd+Shift+G、他の F3 / Shift+F3。どのビューでも消費し、検索対象がありモーダルが開いていないときだけ動く。
4. components/FindBar.tsx: ビューアの上端に置く検索バー (流れの中に置き、内容に重ねない)。名札・入力欄・n / m の件数 (aria-live)・前後と閉じるのアイコンのみボタン。CSS Custom Highlight API で全一致と現在の一致を別の名前で塗る。DOM には書かない。対象の中身の変化は MutationObserver で拾って同じ検索をやり直す。現在の一致は .doc-scroll の scroll-padding-top を読み戻して帯の下へ出す。Escape で閉じ、開く前の焦点へ戻す。IME の変換中は Enter / Escape を受けない。
5. Viewer に FindBar を置き (ファイルを移っても残る)、App から chord とメニューのイベントで操作する。
6. menu.rs: Edit に Find… / Find Next / Find Previous を足し、report_find_available でウィンドウごとにゲートする。
7. i18n (ja/en)、SCSS、AGENTS.md / AGENTS.ja.md / README、テスト。pnpm lint / build / test と cargo fmt --check / check / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 実装

- 照合 (`src/lib/find.ts`、純粋関数): 文書の写しを NFKC → 小文字化で畳み込み、畳み込んだ各コード単位が元のどの範囲から来たかを `Int32Array` で持つ。文字はその後ろの結合文字と一緒に正規化する。半角の濁点・半濁点 (U+FF9E / U+FF9F) は `\p{M}` では文字なので、結合文字として明示的に足した (しないと `ｶﾞ` と `ガ` が一致しない)。ASCII は `normalize` を通さず小文字化だけにした (10 MiB のソースを数秒かけないため)。ブロック (最も近いブロック要素) ごとにテキストノードを連結して `indexOf` で探し、一致をノード番号と位置に戻す。重ならない一致を文書順に 1,000 件まで。
- 対象 (`src/lib/find-target.ts`): ウィンドウに 1 つ。Markdown のプレビューは article を、`SourceView` は自分を登録するので、ソース表示はすべて自前のコードなしで検索を持つ。登録しないビュー (ツリー・表・描画した HTML・メディア) には検索がなく、その不在が chord とメニューのゲートになる。解放は自分の対象しか消さない (プレビュー → ソースの切り替えで後から走る cleanup が新しい対象を消さないため)。
- DOM 側 (`src/lib/find-dom.ts`): TreeWalker でテキストを集め、ボタン・SVG (描画済み mermaid 図)・`aria-hidden` (ソース表示の行番号)・アプリの `.notice` を除く。`CSS.highlights` に `mallow-find` と、priority 1 の `mallow-find-current` を登録する (TASK-46 の付記どおり)。現在の一致はスクロール枠の `scroll-padding-top` を読み戻して `.doc__bar` の下の中央へ出す。横スクロールするコードブロックの中の一致は先にその箱を横へ動かす。
- バー (`src/components/FindBar.tsx`): ビューアの流れの中でビューの上に置く (内容に重ねないので `.doc__bar` を避ける計算に別の項が要らない)。`Viewer` の中にファイルをまたいでマウントしたままにし、語を文書より長く残す。対象の差し替えと、対象のルートの `MutationObserver` (読むだけ) で同じ語を探し直す。語を変えたとき・開いたときは表示中の最初の一致から始めてそこへ出す。対象が変わったとき (別のファイル・プレビュー/ソース) は件数だけ出し、現在の一致は読み手が移動するまで選ばない (ビューが覚えていたスクロール位置を戻している最中に、こちらからスクロールして争わないため)。同じビューの中身の変化 (再読み込み・着色の到着・図の描画) では現在の一致の順番を保ち、スクロールしない。
- chord (`src/lib/find-chord.ts`): `Cmd/Ctrl+F`、macOS は `Cmd+G` / `Cmd+Shift+G`、他は `F3` / `Shift+F3`。どのビューでも消費し、検索対象がありモーダルが開いていないときだけ動く (モーダルが焦点を閉じ込めているときにバーへ焦点を出さないため)。メニューの Find Next / Previous はバーが閉じていればバーを開き直す。
- メニュー (`menu.rs`): Edit に Find… / Find Next / Find Previous を通常の項目として足し、`report_find_available` でウィンドウごとにゲートする。
- `SourceView` の `{ __html }` をメモ化した。リテラルのままだと上位の再レンダーのたびに `innerHTML` が書き直され、一致の Range が張っているテキストノードが全部差し替わるため (AGENTS.md の該当箇所も更新)。

## 着手時の判断

- 検索バーは snz-design doc-16 §9 の「アプリ固有の例外」と判定した。他の 3 アプリに文書内検索はなく、backlog-atlas の FilterBar は一覧の絞り込みで役割が違う。入力欄は doc-8 §6.3 (見える名札・`line-control` の輪郭・外側の焦点枠・IME 変換中は Enter / Escape を受けない) に当て、横断規則も当てた。snz-design 側の適用記録 (doc-18) の更新はこのタスクでは行っていない。
- 対象のないビュー (CSV の表など) へ移ったとき、バーは閉じずに「この表示では検索できません」と語で出す (AC #8 の「別のファイルへ移ってもバーは開いたまま」を優先)。読み込み中はこの語を出さない。
- 1,000 件を超えた一致は塗らず、移動でも届かない (README に記載)。

## 確かめたこと (2026-11-04)

- `pnpm lint` 相当 (`biome ci .`)、`tsc`、`vitest run` (44 ファイル・558 件)、`vite build`、`cargo fmt --check`・`cargo check`・`cargo test` (111 件) がすべて通過。この checkout では `pnpm <script>` が非 TTY の中断 (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`、`.modules.yaml` が存在しないプロジェクト内ストアを指している) に戻っていたため、`node_modules/.bin` のバイナリを直接実行した。CI と同じコマンド列である。
- AC #2: `find.test.ts` (22 件) で全角半角・大文字小文字・半角濁点・かなの区別・長さが変わる畳み込みの位置の対応・ノードをまたぐ一致・ブロックをまたがないこと・上限と折り返しを確認。
- AC #3・#5・#6 と #4・#8 の一部: 実アプリではなく、FindBar・SourceView・markdown の描画・codeblock の強化を組んだ一時的なハーネス (コミットしていない) を Claude のブラウザペイン (Chromium) で操作して確認した。`Cmd+F` で入力欄に焦点が入る。`foobar` で `foo**bar**` と `ＦＯＯＢＡＲ` を含む 5 件が塗られ、現在の一致は別の色。article 内の `mark` は 0。Enter で 4 / 5 へ進むと、`.doc__bar` (scroll-padding-top 62px) の下に出し、横スクロールするコードブロックを右端の一致まで動かした。5 / 5 から `Cmd+G` で 1 / 5、Shift+Enter で 5 / 5。Escape でバーが閉じ、ハイライトが 0 になり、焦点が開く前のボタンに戻る。開き直すと語が選択された状態で戻る。プレビュー → ソースで同じ語が探し直され (ソースでは `foo**bar**` が一致しないので 4 件)、対象のないビューでは「Find is not available in this view」、そこでの `Cmd+F` はバーを開かない。`ｶﾞｲﾄﾞ` で `ｶﾞｲﾄﾞ` と `ガイド` の 2 件。ダークでも現在の一致と焦点枠が読めることをスクリーンショットで見た。
- 開き直した直後の 1 フレームに前回の「一致なし」が出て live region に届く不具合をハーネスで見つけて直した (最初の検索が済むまで件数を出さない)。

## 確かめていないこと (オーナーの実窓の確認)

- 実アプリ (WKWebView・WebView2・WebKitGTK) での動作は一度も見ていない。AC #1 (Windows / Linux の `Ctrl+F`)、AC #4 (`F3` / `Shift+F3`)、AC #7 (メニューの 3 項目がビューに応じて有効・無効になること、Windows で `Ctrl+F` が WebView2 の検索バーを開かないこと)、AC #8 (監視による再読み込みと別ファイルへの移動) は未確認なので未チェックのまま。
- Linux で GTK のアクセラレータとフロントエンドの keydown が両方動いて `F3` で 2 つ進まないか (TASK-44 の戻る / 進むでは 1 回だけだった)。
- IME 変換中の Enter / Escape を受けないことは、ハーネスで IME を動かせないので未確認。
- ハイライトの色の比は測っていない (全一致は warn-soft の面に on-warn-soft の字、現在の一致は warn の面に地の色の字)。

## オーナーの実窓確認 (2026-11-05)

- AC #1・#4・#7・#8: macOS・Windows・Linux のすべてで OK (オーナー)。Linux は Ubuntu 24.04 (VMware Workstation 17 Player)。
- 気付き 1: Linux でメニューから選んだ Edit の Find / Find Next / Find Previous と View の Back / Forward が何もしない。chord では動く。別タスク TASK-49 として起票した (`eab1234`)。
- 気付き 2: macOS と Linux で、入力途中の一致がいまの一致の色のまま残る (`icon` を打つと `i` の段階で選ばれた `luc[i]de` の `i`、`build` を打つと `bu` の段階の `contri[bu]tors`)。Windows では出ない。下の追加修正で直した。

## 追加修正: WebKit で入力途中のハイライトが残る (PR#86 のマージ後、TASK-47 の中で修正)

- 原因: `paintMatches` が打鍵ごとに `CSS.highlights.set` で同じ名前の Highlight を新しいオブジェクトに置き換えていた。WebKit は置き換えで外れた範囲を描き直さない。
- 計測 (2026-11-05, macOS の Safari = WKWebView と同じシステム WebKit): 単純なページでは置き換えでも再現しなかった。アプリと同じ形 (`overflow: auto` のスクロール枠と、`backdrop-filter` の sticky バー) にすると、置き換えは 3/3 で `i` が残り、登録済みの Highlight をその場で更新 (`clear()` / `add()`) した場合と、`delete` してから `set` した場合はどちらも 0/3。閉じたとき (全消去) も更新と delete-first は何も残らず、置き換えで残った塗りは閉じても消えなかった。
- 修正: 2 つの Highlight を一度だけ登録し、以後は Range を入れ替えるだけにした (`src/lib/find-dom.ts`)。delete-first ではなくこちらにしたのは、登録が一度だけなので delete と set の順序を誤る余地がないため。
- 実際のコードでの確認: FindBar とプレビューの構成を組んだ一時的なハーネス (コミットしていない) を Safari で開き、スクリプトで `i` → `ic` → `ico` → `icon` と入力した。修正前は 3/3 で `luc|de` が残り (オーナーの macOS のスクリーンショットと同じ)、修正後は 0/3。Chromium でも修正後に 2 件が塗られ、いまの一致が 1 件であることを確認した。
- 未確認: Linux (WebKitGTK) での修正後の見え方。オーナーの再確認待ち。

## PR#86 の外部レビューで直した点 (Codex、gpt-6-astra、effort low、3 ラウンド)

- [P2] ハングルの字母 (半角の `ﾡￂ`、結合用の `ᄀ`+`ᅡ`) が `가` と一致しなかった。字母は結合文字ではなく文字なので、「文字とその後ろの結合文字」で区切る畳み込みでは合成されなかった。2 文字を一緒に正規化した結果が別々の結果と違えば範囲を伸ばす判定に変えた (`4d7700d`)。
- [P3] 合字 (`ﬀ` は `ff`) で、元の同じ範囲に戻る一致が 2 件数えられ、移動しても位置が変わらず、上限も倍の速さで使っていた。元の範囲が直前の一致の範囲の中から始まる一致を数える前に飛ばすようにした (`4d7700d`)。
- [P2] `a` + U+0315 + U+0300 のように、NFKC が結合文字を並べ替えてから合成する場合に一致しなかった。最初の 2 文字の判定が通るため `a` が単独で畳み込まれていた。結合文字は判定が通っても直前の範囲に必ず残すようにした (`cf3abb0`)。
- 同じ修正で、自分自身に畳み込まれる文字の連なりをまとめて扱うようにした。1 文字ずつ処理するコストは元からあり、ASCII 10 MB が 3.6 秒から 0.14 秒に、日本語混じり 1 MB が 2.1 秒から 0.15 秒になった (vitest 上の計測)。
- 3 ラウンド目で指摘なしとなり、bot が `cf3abb0` を APPROVE した。

## 追加修正の Linux での再確認 (2026-11-05)

- PR#87 のマージ後、Linux (WebKitGTK) で入力途中のハイライトが残らないことをオーナーが目視で確認した。
- PR#87 の外部レビュー (Codex、1 ラウンド) は指摘なしで APPROVE (`1e12cba`)。
<!-- SECTION:NOTES:END -->
