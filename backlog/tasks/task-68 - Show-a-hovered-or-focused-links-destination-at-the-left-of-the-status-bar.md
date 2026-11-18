---
id: TASK-68
title: Show a hovered or focused link's destination at the left of the status bar
status: To Do
assignee: []
created_date: '2026-11-18 22:06'
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
- [ ] #1 Where the destination is shown (status bar or popup) and what is shown for each kind of href are confirmed by the owner and recorded before implementation
- [ ] #2 In the markdown preview, pointing at a link shows its destination at the left of the bottom bar, beside the settings button, and it clears when the pointer leaves
- [ ] #3 A link reached by keyboard focus shows its destination the same way and clears on blur
- [ ] #4 A link whose click does nothing (relative path, mailto:, file: and the like) is shown as not opening, distinct from an http(s) link
- [ ] #5 A long destination is cut with an ellipsis; the bar does not grow taller or wrap, and the file information on the right yields to it in a narrow window
- [ ] #6 The Slides view (and its presentation) is covered or its behaviour stated; the rendered HTML view is covered by a mechanism measured on all three WebViews, or left out with README saying so
- [ ] #7 Checked on macOS, Windows and Linux builds
<!-- AC:END -->
