---
id: TASK-7
title: Verify srcdoc sandbox behavior across the three WebViews
status: In Progress
assignee: []
created_date: '2026-07-30 09:26'
updated_date: '2026-08-17 20:30'
labels:
  - feature
milestone: m-1
dependencies: []
priority: high
ordinal: 700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spike, prerequisite for TASK-5.x per decision-3. Two standard behaviors are load-bearing for the security argument and have not been observed on this project's WebViews (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux):

1. An iframe with a srcdoc document and sandbox=allow-same-origin (deliberately WITHOUT allow-scripts) stays same-origin with the parent, so the parent can read and manipulate contentDocument, while no script inside the document executes.
2. A srcdoc document inherits the CSP of the parent, so script-src without unsafe-inline blocks inline script there too, and remote stylesheets, fonts and scripts are refused.

HOW TO RUN THIS - getting it wrong inverts the result. There is NO CSP under pnpm tauri dev on desktop: set_csp is only reached through get_asset (tauri-2.11.3/src/manager/mod.rs:442), the dev webview loads the Vite devUrl directly because PROXY_DEV_SERVER is cfg!(all(dev, mobile)) (manager/webview.rs:43), index.html carries no CSP meta and app.security.devCsp is unset. Running the fixture in dev would fail every CSP assertion and pass every sandbox-only one - the exact both-layers-conflated failure this task exists to avoid. Run against pnpm tauri build output, or set devCsp to the production CSP for the duration, and record which was used. Also capture the EFFECTIVE CSP from the running app rather than trusting tauri.conf.json: replace_csp_nonce (manager/mod.rs:126-152) adds the sha256 of index.html's inline bootstrap script to script-src.

The two layers must be probed INDEPENDENTLY, and each probe needs a positive control or it proves nothing. An inline script cannot test the sandbox: if the sandbox were broken but the CSP intact, the script would still be refused and the test would pass. Probe the sandbox with a script the CSP would allow - an app-origin external script permitted by script-src 'self' - and FIRST confirm that same script executes when loaded by the parent document, so a missing file cannot masquerade as containment.

Fixture contents. Must-be-blocked: an app-origin external script, an inline script, an on-click handler, a javascript: link, a form with formaction, a meta refresh, a link with target=_top, a plain link with no target, a nested iframe containing its own inline script, a remote stylesheet, a remote font, a remote script. Must-work: an inline style block that visibly applies, a rewritten asset: image that loads, a remote image that loads. Rendering: a fully unstyled document, and a document declaring color-scheme support with a text colour but no background.

Record the outcome as a comment on this task, including each platform's WebView version. If any must-be-blocked item runs, or any must-work item fails, that reopens decision-3 rather than being worked around.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The sandbox layer is verified independently: an app-origin external script, which script-src 'self' would permit, does not execute inside the frame
- [ ] #2 The CSP layer is verified independently: remote stylesheet, remote font and remote script are all refused, while a remote image loads
- [ ] #3 No inline script and no on-star handler runs, and a javascript: link is inert
- [ ] #4 The form does not submit, the meta refresh does not navigate, and target=_top cannot navigate the app away
- [ ] #5 A nested iframe inherits the sandbox flags, so no script runs inside it either
- [ ] #6 The parent can read contentDocument, scroll it via scrollIntoView on an element inside it, and measure its scrollHeight
- [ ] #7 All of the above are checked on macOS, and on Windows and Linux, or the divergence is recorded per platform
- [ ] #8 Findings are recorded on the task and decision-3 is confirmed or reopened
- [ ] #9 The WebView version is recorded per platform, since the behavior under test is version-dependent
- [ ] #10 A plain link with no target does not navigate the frame away once the parent intercepts clicks
- [ ] #11 A fully unstyled document and a document declaring color-scheme support are both rendered, and their canvas colour and text contrast are recorded per platform under a dark palette
- [ ] #12 Wheel scrolling chains from the frame to the parent scroller, and it is recorded whether keyboard scrolling does
- [ ] #13 It is recorded whether scrollIntoView on an element inside the frame scrolls the parent, since TASK-8 picks its mechanism from that answer
- [ ] #14 The app-origin probe script is confirmed to execute in the parent document before being used as the sandbox probe
- [ ] #15 The effective CSP is captured from the running app and recorded, together with whether a build or devCsp was used
- [ ] #16 Must-work items pass: an inline style block applies, a rewritten asset: image loads, a remote image loads
- [ ] #17 A platform that cannot be checked is either excluded from the rendered view or recorded in decision-3 as an accepted risk - not left as an unverified pass
<!-- AC:END -->
