---
id: TASK-72
title: >-
  Show a hovered or focused link's destination in the status bar in the rendered
  HTML view
status: In Review
assignee: []
created_date: '2026-11-19 20:50'
updated_date: '2026-11-20 08:37'
labels:
  - feature
dependencies:
  - TASK-68
references:
  - src/components/HtmlView.tsx
  - src/lib/link-status.ts
  - src/lib/link-status-dom.ts
  - src/lib/html-notice.ts
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-68 shows the destination of the link under the pointer or holding the focus at the left of the status bar, in the markdown preview and the Slides view. The rendered HTML view was left out and README says it shows nothing there. The owner asked for it to be covered as well (2026-11-20). This task does that.

**What a click does in the HTML view depends on the engine, and the status bar has to say the same thing.** `HtmlView` probes once per document whether a listener the parent registers on the frame's document runs at all (`runsParentListeners`, decision-9):
- **Where it runs (WebView2):** `HtmlView`'s click handler handles every link. `#…` scrolls the parent to the target, `http(s)` opens in the OS browser, and every other scheme is inert. This is the preview's rule, so `watchLinks` on the frame's document, added in the same load pass as the click handler, should be enough here. The heading lookup should follow `fragmentTarget`, which is what the click scrolls to.
- **Where it runs none (WKWebView, WebKitGTK):** no link opens. `http(s)` is stopped by `frame-src`. App-origin links, `#…` included, are neutralized with `pointer-events: none` and `tabindex="-1"` (decision-10). The notice bar already says so for the document as a whole (`htmlNoticeLinksInert`). So every link is described as not opening, `http(s)` included. `describeLink` today calls every `http(s)` link a web link, so it needs a way to say that one does not open.

**The open question is the WebKit side, where the parent cannot listen inside the frame.** Possible routes, none measured yet:
- The parent detects the pointer entering and leaving the iframe element. While the pointer is inside, it reads `frameDocument.querySelector('a[href]:hover')`.
- For the focus, it reads `frameDocument.activeElement` when the focus enters or moves within the frame.

Whether `:hover` and `activeElement` update in a frame that runs no script, and which parent-side events signal entering and leaving, have to be measured on both WebKit engines in a built app. **A neutralized link is likely unreachable this way.** It does not hit-test (`pointer-events: none`) and is not a Tab stop, so its `:hover` should never match and it never takes the focus. If that holds, the reachable links on WebKit are the `http(s)` ones and other schemes that were not neutralized. Saying so in README is an acceptable result.

**Constraints that come with the frame:**
- Nothing may be written into the frame's document outside the load pass. Any mutation triggers the height measurement's restart, which re-seeds the frame and stops an outline jump. Listening and reading are fine.
- A `srcdoc` swap replaces the document, so the wiring is redone on every load, like the click handler. A swap or an unmount under the pointer has to clear the status, as `watchLinks`' cleanup does for the preview.
- Any polling runs only while the pointer is over the frame, never as a standing timer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Whether the parent can read the link under the pointer and the focused link inside a frame that runs no parent listener is measured on WKWebView and WebKitGTK in a built app, and the approach per engine is recorded before implementation
- [ ] #2 Where the frame runs parent listeners (WebView2), hover and keyboard focus show and clear the destination as in the preview, each href described by what HtmlView's click handler does with it
- [ ] #3 Where it runs none, the links that can be detected are shown as not opening, http(s) included; links that cannot be detected (e.g. neutralized ones) are named in README
- [x] #4 Nothing is written into the frame's document outside the load pass, and any polling runs only while the pointer is over the frame or the focus is inside it
- [ ] #5 A srcdoc swap, leaving the frame or unmounting the view clears the status
- [x] #6 README, AGENTS.md and AGENTS.ja.md say what the HTML view shows, and the describe rule's new case is unit-tested
- [ ] #7 Checked on macOS, Windows and Linux
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の確認 (2026-11-20, オーナー):
- AC #1 の計測は src/probe に TASK-72 の区画を足して行う (TASK-7/23/46 と同じく残す)。オーナーが macOS・Linux (Windows は対照) のビルド済みアプリで走らせ、報告を返す。実装はその後。
- WebKit でのキーボードフォーカス: frame 内のフォーカス移動は親から activeElement を読むしかないので、フォーカスが frame 内にある間もポーリングしてよい。AC #4 を「ポインタが frame 上にある間、またはフォーカスが frame 内にある間だけ」に改めた。

1. プローブ: frame を HtmlView と同じ順で用意し (リスナーの検査 → 動かない側では neutralizeAppOriginLinks)、(a) 常時の rAF で :hover / activeElement を読む対照、(b) iframe 要素・親の window・親の document のイベントで始めて止める rAF、(c) watchLinks と同じ形の frame 内リスナー、の 3 経路がどのリンクを拾えたかを表とログで返す。
2. 計測結果から engine ごとの方式を Implementation Notes に記録する。
3. lib/link-status: describeLink に「http(s) が開くか」を渡せるようにし、開かない側では http(s) も inert にする。単体テストを足す。
4. HtmlView: リスナーが動く側は load の処理で watchLinks を frame の文書に付け、#… の見出しは fragmentTarget に従う。動かない側は 1 の (b) の形 (親側の合図で始めて止める rAF) で :hover / activeElement を読む。どちらも frame には何も書かず、srcdoc の差し替え・frame から出る・アンマウントで表示を消す。
5. README、AGENTS.md、AGENTS.ja.md。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
計測（AC #1）: src/probe の TASK-72 区画を、ビルド済みアプリ（CSP が効いた状態）で 3 環境で走らせた（2026-11-20。報告は _sandbox/task-72/task-72-{mac,lin,win}.txt）。
- WKWebView（macOS）・WebKitGTK（Linux）: 親のリスナーは動かず、neutralizeAppOriginLinks が掛かる。スクリプトの動かないフレームでも、親から読む `a[href]:hover` と `activeElement` は動いた。名指されたのは http(s) の 2 本と mailto。#section と ./other.html はどの経路でも一度も名指されなかった（pointer-events: none と tabindex=-1 のため）。macOS では strong の中のリンクへのホバーが記録に出ていないが、フォーカスでは名指されている。Linux ではホバーでも名指された。:hover は祖先にも掛かるので、取れないのではなく指していなかったと読んでいる。
- 合図になったもの（両 WebKit）: 入るときは iframe 要素の pointerenter / mouseenter / mouseover、出るときは pointerleave / mouseleave / mouseout。フォーカスが入ると親の window に blur が来て、そのとき親の activeElement は iframe。出ると window に focus が来る。iframe 要素自体には focus / blur は来ない。pointermove は 0 回。フレーム内でリンクからリンクへフォーカスが移っても、親には何も来ない。
- WKWebView では :hover が pointerleave の後も 1 フレーム（13ms）残った。
- WebView2（Windows、対照）: リスナーが動き、5 本ともリスナー経路と 2 つのポーリングの全部で名指された。

採った方式:
- WebView2: load の一巡で onClick の隣に watchLinks を付ける。#… は fragmentTarget が見つけるもので表す。
- 両 WebKit: watchFrameLinks（lib/link-status-dom）。pointerenter / pointerleave と window の blur / focus で rAF を始めて止め、ポインタがフレームの上にある間かフォーカスが中にある間だけ :hover と activeElement を読む。:hover は pointerleave で即座に消す（上の 1 フレームの残り）。どのリンクも inert と表す（describeLink に webOpens: false）。srcdoc を差し替えて、ポインタが動かない場合は pointerenter が来ないので、開始時に frame.matches(':hover') も見る。どちらの経路もフレームには何も書かない。

ほかに直したもの: プローブの「Focus start」ボタンにハンドラがなかった。WebKit はクリックでボタンにフォーカスしないので、Tab の起点にならない。そのため onClick で自分にフォーカスするようにした。

確認: pnpm lint・pnpm build・pnpm test（58 ファイル・747 件）が通る。pnpm mutation --since main は差分の 6 体をすべて検出した（型エラー 1 体を除く）。

未確認でオーナーに残すもの: アプリでの実機確認（AC #2・#3・#5・#7）。
- WebView2: ホバーとフォーカスで行き先が出て消えること。#… が見出し名になること。
- 両 WebKit: http(s) と mailto が「開かない」で出ること。#… と相対パスでは何も出ないこと。
- 3 環境とも: フレームから出る・srcdoc の差し替え・ソース表示への切り替えで表示が消えること。

README.ja.md は TASK-68 のステータスバー自体をまだ書いていないので、HTML 側だけを足すことはしなかった。
<!-- SECTION:NOTES:END -->
