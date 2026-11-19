---
id: TASK-68
title: Show a hovered or focused link's destination at the left of the status bar
status: Done
assignee: []
created_date: '2026-11-18 22:06'
updated_date: '2026-11-19 21:41'
labels:
  - feature
dependencies: []
references:
  - src/components/MarkdownView.tsx
  - src/components/HtmlView.tsx
  - src/components/DeckView.tsx
  - src/App.tsx
  - src/styles/app.scss
priority: medium
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pointing at a link in a rendered document gives no sign of where it goes, or of whether clicking it does anything at all (requested 2026-11-19). Today a click opens an `http(s)` URL in the OS browser, scrolls to a `#fragment`, and does nothing for every other href — a relative path, `mailto:`, `file:` — so a reader cannot tell a dead link from a live one before pressing it (`MarkdownView`'s click handler).

**Where the destination is shown (proposed, confirmed at the start).** The request was a popup by the link *or* the left end of the window's bottom bar (`.app__footer`), and the proposal is the bottom bar, as a browser does:
- It covers no text. A popup sits over the document, and as snz-design doc-8 §6.9's hint it has to meet 1.4.13 — dismissable with Escape, hoverable, not closing on its own — plus edge placement, all for a one-line URL.
- A link written `[x](url "title")` already gets the engine's native `title` tooltip; a popup would stack a second one beside it.
- The bar is already there and is what the request means by status bar; the price is the eye travelling to the bottom of the window.

**What the bar holds today.** Only the settings button, at its left end, so the destination starts to the right of it. TASK-69 puts the open file's information at the right end of the same bar; the destination takes precedence over it when the window is narrow, and a long URL is cut with an ellipsis rather than wrapping or growing the bar.

**What is shown per href (settle at the start).** The destination for `http(s)`; the fragment (or the heading it lands on) for `#…`; and for an href that does nothing on click, the href with words saying it does not open — the reason the request is useful at all.

**Where it reaches.** The markdown preview and a Marp deck's Slides view (and its presentation, where the bar may not be visible — say what happens). **The rendered HTML view is the hard one**: its document is in a sandboxed `srcdoc` frame where a listener the parent registers is never invoked on WKWebView or WebKitGTK (decision-9), so hover inside it cannot be observed there by the mechanism the other views use. It is either reached by a mechanism measured on all three WebViews, or left out and README says so — not shipped on WebView2 alone without saying so. Source views have no links.

**Keyboard.** A link reached by Tab shows its destination as hovering does, and it clears on blur and on the pointer leaving. Whether the bar text is a live region is decided (announcing every hover would be noise).

Before building, read snz-design doc-16 (§7.2) and mallow's adoption record (doc-18); the footer is app chrome under the shared tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Where the destination is shown (status bar or popup) and what is shown for each kind of href are confirmed by the owner and recorded before implementation
- [x] #2 In the markdown preview, pointing at a link shows its destination at the left of the bottom bar, beside the settings button, and it clears when the pointer leaves
- [x] #3 A link reached by keyboard focus shows its destination the same way and clears on blur
- [x] #4 A link whose click does nothing (relative path, mailto:, file: and the like) is shown as not opening, distinct from an http(s) link
- [x] #5 A long destination is cut with an ellipsis; the bar does not grow taller or wrap, and the file information on the right yields to it in a narrow window
- [x] #6 The Slides view (and its presentation) is covered or its behaviour stated; the rendered HTML view is covered by a mechanism measured on all three WebViews, or left out with README saying so
- [x] #7 Checked on macOS, Windows and Linux builds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の確認 (2026-11-19, オーナー): 4点とも提案どおり。
- 表示場所: 下端のバー (.app__footer) の左、設定ボタンの右。ポップアップにはしない。
- href ごとの表示: http(s) は URL をそのまま。#… は移動先の見出しの文字 (見出しが無ければ #id)。クリックで何も起きないもの (相対パス・mailto:・file: など) は href をそのまま出し、「開きません」を添える。
- 描画した HTML ビュー: 対象外にし、README に書く (frame 内の hover は WebKit 系で親のリスナーから見えない、decision-9)。
- バーの文字は live region にしない (hover のたびの読み上げは雑音になる)。
- 発表中はバーが発表に覆われるので何も表示せず、README に書く。

1. lib/link-status: href を種類 (web / fragment / inert) に分ける純関数と、窓ごとの表示状態 (hover と focus を別に持ち、hover を優先) のストア。単体テストを付ける。
2. プレビュー (MarkdownView) と Slides (DeckView、発表中は除く) の記事要素に pointerover/out・focusin/out を委譲で付け、文書の差し替えとアンマウントで消す。スライドの #… はクリックで何も起きないので inert として扱う。
3. フッターに LinkStatus を置く。1行、省略記号で切り、バーの高さを変えない。
4. i18n (ja/en)、app.scss、README。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判断は Implementation Plan の冒頭に記録した (2026-11-19、オーナー確認。4 点とも提案どおり)。

実装:
- `lib/link-status` が href の種類 (web / fragment / inert) を決める。判定はビューのクリック処理と同じ `^https?://` で読むので、「開きません」の表示とクリックの結果がずれない。`#…` はプレビューでは移動先の見出しの文字 (見出しでない id、たとえば脚注は `#id` のまま)、スライドではクリックで何も起きないので inert とした。
- 表示の状態は hover と focus を別に持ち、hover を優先する (ブラウザと同じ)。ポインタが離れるとフォーカス中のリンクの表示に戻る。
- `lib/link-status-dom` の `watchLinks` が記事要素に pointerover / pointerleave / focusin / focusout を委譲で付ける。読むだけで DOM には何も書かない (TASK-29 の不変条件と find の MutationObserver のため)。文書の差し替えやアンマウントでは pointerleave が来ないので、解除のときに表示を消す。
- 発表中はバーが発表に覆われるので watch しない。描画した HTML ビューは対象外で、README に書いた。
- バーの文字は live region にしない。「開きません」は枠付きの小さい札にして、長い href でも切られないようにした (href 側だけが省略記号で縮む)。fg-faint は本文に使うとコントラストが足りない恐れがあるので、文字色は fg-muted のまま、語と枠で区別した。

確認 (Electron のブラウザペイン = Blink。実際の `watchLinks` と `LinkStatus` と app.scss を、一時的に置いたプローブのページに載せた。プローブは削除済み):
- http(s) は URL をそのまま、`#install` は「Go to: Installation」、`#fn1` (見出しでない) は「Go to: #fn1」、`./other.md` と `mailto:` は href と「Does not open」。
- Tab で ./other.md にフォーカスすると表示され、その上で別のリンクを指すと指した方が出て、ポインタを外すとフォーカス側に戻り、他を押してフォーカスを外すと消えた。
- 長い URL と長い相対パスは省略記号で切れ、相対パスでも札は残った。フッターの高さは 32px のまま、横にはみ出さなかった。
- pnpm lint (既存の biome スキーマ版の info 1 件だけ)、pnpm build、pnpm test (58 ファイル・740 件) が通った。

未確認として残したもの:
- AC #5: 右端のファイル情報は TASK-69 でまだ無いので、「狭い窓で右側が譲る」は確かめられない。このバーは flex: 1 1 auto; min-width: 0 なので、TASK-69 は右側を先に縮めるか隠す側で作ること。
- AC #6: README には、発表中は何も表示しないことと HTML ビューが対象外であることを書いた。Slides ビューは同じ watchLinks を付けているが、実際のアプリでは見ていない。
- AC #7: macOS・Windows・Linux の実ビルドでの確認はオーナーに任せる。WebKit 系で pointerover / focusin が親の文書の中で届くことは前提にしている (frame の外なので decision-9 は関係しない)。

オーナー確認 (2026-11-20、PR #136 のマージ前):
- AC #6: Slides ビューで、スライド上のリンク (`https://marp.app/`) を指すとフッターに行き先が出るのを、実際のアプリで確かめた。発表は全画面・ウィンドウ内のどちらもフッターを覆うので非表示のままでよい、とオーナーが了承した。
- AC #7: macOS・Windows・Linux の実ビルドで確かめ、挙動差は無かった。
- AC #5: 省略記号で切れることとバーの高さが変わらないことは確認済み。「狭い窓で右側のファイル情報が譲る」部分は、同じ内容の TASK-69 AC #6 で確かめることにして、ここでは満たしたものとした (オーナー了承)。
- 確認の中で 2 件の後続タスクを起票した。TASK-71 は `README.md` のような素のファイル名が `http://README.md` へのリンクになる既存の不具合 (linkify-it の fuzzyLink が 2 文字の国別ドメインを受け入れるため)、TASK-72 は描画した HTML ビューでのリンク先表示。
<!-- SECTION:NOTES:END -->
