---
id: TASK-65
title: Wrap long lines in the source view
status: Done
assignee: []
created_date: '2026-11-17 21:17'
updated_date: '2026-11-18 10:23'
labels:
  - feature
dependencies: []
references:
  - src/components/SourceView.tsx
  - src/styles/source.scss
  - src/lib/source-cap.ts
  - _sandbox/samples/notes.txt
priority: medium
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reading a plain-text file such as `_sandbox/samples/notes.txt` in the source view, a line longer than the view runs off to the right and has to be scrolled sideways (that sample's last line is 228 characters). The request is that the source view wrap long lines to the view's width instead.

**What is there today.** `SourceView` is shared by every source view — a `.txt` / `.log`, the source half of markdown, config, CSV / TSV, HTML and XML — so the change reaches all of them at once. It has two paths:

- **Highlighted** (under `HIGHLIGHT_MAX_BYTES` 256 KiB / `HIGHLIGHT_MAX_LINES` 10,000 in `lib/source-cap`): Shiki emits one `<span class="line">` per line, `code { display: grid }` makes each a row, and the number is a `.line::before` counter drawn as an `inline-block` (`src/styles/source.scss`). `pre.shiki` keeps `white-space: pre` and `overflow: auto`, which is the horizontal scroll. Wrapping is possible here because each line is its own element, but it needs a hanging layout: a continuation row has to start at the text column rather than under the number, and the number has to stay beside the line's first row.
- **Unhighlighted, above the caps** (`PlainSource`): the whole text is one text node beside a second text node of numbers, so a wrapped line would put every number below it out of step. The component's own comment says this is why that path does not wrap, and the flagged-line band is placed from the measured line height on the same assumption. This path stays unwrapped in this task; README / AGENTS.md say so if the highlighted path wraps.

**Decide before implementing (the owner's call).** Whether wrapping is always on, or a choice the reader can turn off — and if a choice, where it lives: a preference beside the prose measure (app-wide, propagated through `settings-sync` like `proseMeasure`), or a toggle on the view (and possibly a View menu item and chord, as editors offer). A toggle on the view is a new control, so snz-design doc-16 and mallow's adoption record are read first.

**What wrapping must not break.** A run with no break opportunity (the `aaaa…` run in the sample) has to wrap too, not overflow, so `overflow-wrap: anywhere` or its equivalent is needed alongside `white-space: pre-wrap`. Tabs keep their width. Find (TASK-47) paints with ranges over the text nodes, so the DOM is unchanged, but bringing a match into view and the current-match paint on a wrapped row are checked. The parse-error line band (`.src-error-line`) and the scroll position kept by TASK-44's view memory are checked on a file whose lines wrap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Whether wrapping is always on or a reader's choice, and where that choice lives, is decided and recorded before implementation
- [x] #2 In the highlighted source view, a line longer than the view wraps to the view's width and the view does not scroll sideways (with wrapping on)
- [x] #3 A wrapped line's continuation rows start at the text column, not under the line number, and the number stays beside the line's first row
- [x] #4 A run with no break opportunity, such as the long run in _sandbox/samples/notes.txt, wraps rather than overflowing
- [x] #5 Find's match paint and scroll-into-view, the parse-error line band and the restored scroll position still land on the right line in a file whose lines wrap
- [x] #6 The unhighlighted path above the source caps stays unwrapped, and README / AGENTS.md say so
- [x] #7 Checked on macOS, Windows and Linux builds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 判定 (AC#1, オーナー決定 2026-11-18): 折り返しは読み手の選択。設定モーダルの「外観」に文章の幅と並べて置くアプリ全体の設定 sourceWrap とし、既定は折り返す。proseMeasure と同じく localStorage に持ち、settings-sync で全ウィンドウへ伝える。ビュー上のトグル・View メニュー・ショートカットは作らない (新しい部品になるため)。
2. lib/source-wrap.ts: lib/outline-pref と同形の真偽値ストア (キャッシュ・購読・apply / write)。単体テストを添える。
3. settings-sync の SettingChange に sourceWrap を足し、App の applier に case を足す。
4. SettingsModal に Segmented (折り返す / 折り返さない) と i18n の ja / en を足す。
5. SourceView は .src-view に data-source-wrap を付け、source.scss はそれが on のとき pre.shiki を pre-wrap + overflow-wrap: anywhere にし、行番号を .line の絶対配置 (top/bottom いっぱい) に移して本文列ぶんの padding-left を取る (ぶら下げ)。折り返さないときの配置は今のまま。PlainSource は対象外。
6. README / AGENTS.md に、折り返しは強調表示の経路だけで上限超えの経路は折り返さないことを書く。
7. pnpm lint / build / test。find・エラー行・復元位置は実機 (pnpm tauri dev) で確認。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**判定 (AC#1)**: 2026-11-18 オーナー決定。折り返しは読み手の選択とし、設定モーダルの「外観」に文章の幅と並べたアプリ全体の設定 `sourceWrap` (既定は折り返す) に置く。proseMeasure と同じく localStorage に持ち、settings-sync で全ウィンドウへ伝える。ビュー上のトグル・View メニュー・ショートカットは作らない — 新しい部品になり snz-design の適用範囲が広がるため。常時オンにしなかったのは、桁をそろえた CSV のソースやログを横並びのまま読みたい場合に戻す手段が無くなるため。

**配置の選び方**: 行番号 (`.line::before`) を絶対配置にしてフローから外す案を先に試したが、Shiki の `text` 文法は空行を空のトークン span として出すため `.line:empty` で拾えず、空行の高さが 0 になった (検証ページで測定)。そこで行番号は通常のフローに残し、`.line` にぶら下げインデント (`padding-left` を本文の列まで取り、`text-indent` で先頭行だけ引き戻す) を付けた。行番号の border は先頭行で途切れるので、区切り線は行の高さいっぱいの `::after` に移した。折り返さないときの配置は従来のまま。

**測定 (Chromium の内蔵ブラウザ。実際の Shiki 出力と `source.scss` をコンパイルした検証ページ、幅 640px)**:
- `_sandbox/samples/notes.txt`: 折り返し時 `pre` の scrollWidth − clientWidth = 0 (折り返さないときは 1250)。228 字の行は 5 行に折り返し、`aaaa…` の連続部分も幅内で折れた (AC#2・#4)
- 全行・全折り返し行の本文の開始位置が行の左端から 56px で一致し、折り返さないときの本文位置 56px とも一致。行番号は先頭行に並ぶ (AC#3)
- 空行の高さ 20.8px (他の 1 行の行と同じ)。区切り線は折り返した行の高さいっぱいに続く (スクリーンショットで確認)
- タブで始まる行はタブ幅を保ったまま表示
- エラー行 (JSON の 300 字の値を持つ行、6 行に折り返し) の帯は折り返した全体を覆う
- 折り返した行の末尾 10 字に置いた Range の矩形はその行の箱の内側にあり、CSS Custom Highlight の塗りも折り返し後の行に乗る

**未確認 (オーナーの実機確認が必要)**: AC#5 のうち、実アプリ (WKWebView / WebView2 / WebKitGTK) での find の一致箇所へのスクロール、エラー行への `scrollIntoView`、TASK-44 の戻る/進むでの位置復元。ソース表示の位置は比率 (`{ ratio }`) で保存しているので、離れたときと同じ幅・同じ設定なら同じ行に戻る想定だが、測っていない。AC#7 (3 OS のビルド) も未確認。

**AC#6**: `PlainSource` (上限超えの経路) には手を入れておらず、CSS も `pre.shiki` と `.line` だけを対象にしている。README / README.ja / AGENTS / AGENTS.ja に、折り返すのは強調表示の経路だけと書いた。

pnpm lint / build / test (57 ファイル 710 件) は通過。Rust は変更なし。

AC#5・#7: マージ後、オーナーが実アプリ (macOS・Windows・Linux) で確認済み (2026-11-18)。
<!-- SECTION:NOTES:END -->
