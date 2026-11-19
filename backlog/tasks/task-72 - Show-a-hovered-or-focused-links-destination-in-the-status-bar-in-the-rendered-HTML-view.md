---
id: TASK-72
title: >-
  Show a hovered or focused link's destination in the status bar in the rendered
  HTML view
status: To Do
assignee: []
created_date: '2026-11-19 20:50'
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
- [ ] #1 Whether the parent can read the link under the pointer and the focused link inside a frame that runs no parent listener is measured on WKWebView and WebKitGTK in a built app, and the approach per engine is recorded before implementation
- [ ] #2 Where the frame runs parent listeners (WebView2), hover and keyboard focus show and clear the destination as in the preview, each href described by what HtmlView's click handler does with it
- [ ] #3 Where it runs none, the links that can be detected are shown as not opening, http(s) included; links that cannot be detected (e.g. neutralized ones) are named in README
- [ ] #4 Nothing is written into the frame's document outside the load pass, and any polling runs only while the pointer is over the frame
- [ ] #5 A srcdoc swap, leaving the frame or unmounting the view clears the status
- [ ] #6 README, AGENTS.md and AGENTS.ja.md say what the HTML view shows, and the describe rule's new case is unit-tested
- [ ] #7 Checked on macOS, Windows and Linux
<!-- AC:END -->
