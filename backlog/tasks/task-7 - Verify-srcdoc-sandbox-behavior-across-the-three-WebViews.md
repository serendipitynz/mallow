---
id: TASK-7
title: Verify srcdoc sandbox behavior across the three WebViews
status: Done
assignee: []
created_date: '2026-07-30 09:26'
updated_date: '2026-08-18 03:25'
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

HOW TO RUN THIS - getting it wrong inverts the result. There is NO CSP under pnpm tauri dev on desktop: set_csp is only reached through get_asset (tauri-2.11.3/src/manager/mod.rs:442), the dev webview loads the Vite devUrl directly because PROXY_DEV_SERVER is cfg!(all(dev, mobile)) (manager/webview.rs:43), and index.html carries no CSP meta. Running the fixture in dev would fail every CSP assertion and pass every sandbox-only one - the exact both-layers-conflated failure this task exists to avoid. Setting app.security.devCsp does NOT rescue it: AppManager::csp is only ever consulted from get_asset, which a desktop dev run never reaches for the main document, so the value is read and then never applied. A build is the only run mode that measures anything; tauri build --debug is enough and is not a dev build, since tauri build enables custom-protocol and Tauri then serves the assets. Record which was used. Also capture the EFFECTIVE CSP from the running app rather than trusting tauri.conf.json: replace_csp_nonce (manager/mod.rs:126-152) adds the sha256 of index.html's inline bootstrap script to script-src.

The two layers must be probed INDEPENDENTLY, and each probe needs a positive control or it proves nothing. An inline script cannot test the sandbox: if the sandbox were broken but the CSP intact, the script would still be refused and the test would pass. Probe the sandbox with a script the CSP would allow - an app-origin external script permitted by script-src 'self' - and FIRST confirm that same script executes when loaded by the parent document, so a missing file cannot masquerade as containment.

Fixture contents. Must-be-blocked: an app-origin external script, an inline script, an on-click handler, a javascript: link, a form with formaction, a meta refresh, a link with target=_top, a plain link with no target, a nested iframe containing its own inline script, a remote stylesheet, a remote font, a remote script. Must-work: an inline style block that visibly applies, a rewritten asset: image that loads, a remote image that loads. Rendering: a fully unstyled document, and a document declaring color-scheme support with a text colour but no background.

Record the outcome as a comment on this task, including each platform's WebView version. If any must-be-blocked item runs, or any must-work item fails, that reopens decision-3 rather than being worked around.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The sandbox layer is verified independently: an app-origin external script, which script-src 'self' would permit, does not execute inside the frame
- [x] #2 The CSP layer is verified independently: the inherited policy is shown to be in force inside the frame by an effect that needs no network, remote stylesheet, remote font and remote script are refused wherever the engine reports refusals, and a remote image loads
- [x] #3 No inline script and no on-star handler runs, and a javascript: link is inert - exercised directly where a click can be delivered to the frame, and otherwise following from the app-origin script's non-execution
- [x] #4 The form does not submit, the meta refresh does not navigate, and target=_top cannot navigate the app away
- [x] #5 A nested iframe inherits the sandbox flags, so no script runs inside it either
- [x] #6 The parent can read contentDocument, scroll it via scrollIntoView on an element inside it, and measure its scrollHeight
- [x] #7 All of the above are checked on macOS, and on Windows and Linux, or the divergence is recorded per platform
- [x] #8 Findings are recorded on the task and decision-3 is confirmed or reopened
- [x] #9 The WebView version is recorded per platform, since the behavior under test is version-dependent
- [x] #10 It is recorded per platform whether a plain link with no target navigates the frame away, both with and without parent click interception
- [x] #11 A fully unstyled document and a document declaring color-scheme support are both rendered, and their canvas colour and text contrast are recorded per platform under a dark palette
- [x] #12 Wheel scrolling chains from the frame to the parent scroller, and it is recorded whether keyboard scrolling does, measured with focus actually inside the frame
- [x] #13 It is recorded whether scrollIntoView on an element inside the frame scrolls the parent, since TASK-8 picks its mechanism from that answer
- [x] #14 The app-origin probe script is confirmed to execute in the parent document before being used as the sandbox probe
- [x] #15 The effective CSP is captured from the running app and recorded, together with the run mode used - devCsp is not one, since it cannot supply a CSP on desktop
- [x] #16 Must-work items pass: an inline style block applies, a rewritten asset: image loads, a remote image loads
- [x] #17 A platform that cannot be checked is either excluded from the rendered view or recorded as an accepted risk - not left as an unverified pass
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-18 01:16
---
Observed on all three WebViews on 2026-08-18, with the probe in `src/probe` (`MALLOW_PROBE=1`, `tauri build --debug --no-bundle`). Three rounds were needed: the first two rounds' methods were themselves defective and the defects are recorded below, because they are the shape a later re-run would repeat.

## Run mode and effective CSP (AC #15)

`tauri build --debug --no-bundle` on all three. NOT `devCsp` — this task's description offered that as an alternative and it is wrong on desktop: `AppManager::csp` is reached only from `get_asset`, and the desktop dev webview loads the Vite `devUrl` directly because `PROXY_DEV_SERVER` is `cfg!(all(dev, mobile))`, so no CSP header is produced whatever `devCsp` says. The description has been corrected. A `--debug` build is not a dev build: `tauri build` enables `custom-protocol`, so Tauri serves the assets and the policy is applied as in a release build.

The effective policy was read off a real violation in the app document rather than from `tauri.conf.json`. All three carry the configured policy plus three `sha256-` sources added to `script-src` at build time.

## Platforms (AC #7, AC #9)

- macOS 26.6.1 (25G76), WKWebView, `AppleWebKit/605.1.15` (frozen token, no version in the UA), origin `tauri://localhost`.
- Windows 11 Home 25H2 (build 2600.9168), WebView2 151.0.0.0, origin `http://tauri.localhost`.
- Linux Ubuntu 24.04.4 LTS aarch64, WebKitGTK reporting `Version/60.5` (`AppleWebKit/605.1.15`), origin `tauri://localhost`.

## Both premises hold, on all three

**Same-origin under `sandbox="allow-same-origin"` without `allow-scripts` (AC #1).** `contentDocument` is readable on all three. An app-origin external script — permitted by `script-src 'self'`, and confirmed to execute when the app document loads it (AC #14) — does not execute inside the frame. This single result is what everything else about script rests on: scripting is disabled in that document, so no `on*` attribute and no `javascript:` URL can run either, whether or not a click can be delivered to test them (AC #3). An inline script does not run; a nested iframe inherits the flags and its inline script does not run (AC #5).

**CSP inheritance (AC #2).** In force on all three. On WebView2 the frame reported the policy text and it is byte-identical to the app document's. **Neither WebKit engine reports `securitypolicyviolation` inside a srcdoc frame at all**, while both report them in the app document — so the event side cannot distinguish "no policy was inherited" from "no violation is reported", and the first round read that silence as three failures. It is not a failure: a `data:` stylesheet, which `style-src 'self' 'unsafe-inline'` must refuse, does not apply in the frame on any of the three, while a `data:` image, which `img-src` lists explicitly, loads. Neither touches the network, so the silence is attributable. The three remote references (`probe.invalid` stylesheet, script, font) are therefore witnessed as refused only on WebView2; on WebKit their refusal follows from the policy being in force, and is recorded as inference rather than observation. A remote image loads on all three (AC #2, AC #16).

**Containment of navigation (AC #4, AC #10).** Form submission — both the form's `action` and a button's `formaction` — is stopped on all three before it becomes a navigation, so by the sandbox rather than by `frame-src`. A meta refresh does not move the frame. `target="_top"` cannot navigate the app away. Without parent interception, a plain link navigates the frame away on WebView2 and does not on WebKit.

**Parent reach-in (AC #6).** Reading `contentDocument`, reading computed styles through the frame's own view, injecting nodes, `scrollIntoView`, and `focus()` all work on all three, including WebKit.

**Rendering (AC #11, AC #16).** An inline `<style>` block applies; a rewritten `asset:` image loads; `compatMode` is `CSS1Compat` everywhere, so the doctype survives into `srcdoc`. Under a dark palette both the fully unstyled document and the one declaring `color-scheme: light dark` with a colour and no background render on a light canvas with readable text on all three. `prefers-color-scheme` inside the frame evaluates to light on all three. That is decision-3's prescribed arrangement working: the probe puts `color-scheme: light` and a background on the iframe ELEMENT, and the document decision-3 predicted would break does not break with it in place.

## What decision-3 got wrong

**Parent-registered listeners do not run on WebKit, so link interception cannot work there.** On a real mouse click inside the frame, six counters — a listener on `contentDocument` in the bubble phase, the same in the capture phase, one on `contentWindow`, one on the element itself, `mousedown` on `contentDocument`, and a custom event the parent dispatches synchronously into that same document — are all 0 on WKWebView and on WebKitGTK, and all non-zero on WebView2. The custom event is what makes the reading general: it is not that clicks fail to arrive, it is that **a document with scripting disabled runs no listener the parent registered on it**. decision-3 puts link interception on exactly such a listener.

Nothing about containment changes: an intercepted click is not what stops the frame going anywhere, `frame-src` is, and the frame did not navigate on WebKit. What is lost is the feature — `http(s)` links cannot be routed to the OS browser and fragment links cannot be scrolled by the parent, so on WebKit a link in a rendered document does nothing at all.

**Keyboard forwarding is not needed.** decision-3 says wheel events chain to the parent but keyboard events do not, and requires forwarding. With focus genuinely inside the frame — `tabindex="-1"` plus `focus()`, what `Outline` does, confirmed by the frame's `activeElement` becoming the target heading — PageDown moves the parent scroller on all three. The first round's answer to this was not usable, because clicking a plain heading does not put focus inside the frame; the second round measured it under the right condition. Had forwarding been needed it would have been unimplementable on WebKit, since it is a `keydown` listener.

**`scrollIntoView` inside the frame does move the parent scroller** — on all three, `scrollTop` became 2401 (AC #13). decision-3 assumes it does not and specifies parent-side scrolling instead. Parent-side rect conversion plus `scrollTop` also lands the target exactly (residual 0px), so TASK-8 chooses between two working mechanisms rather than implementing the only one.

**Late layout has to be observed, not listened for.** decision-3 requires re-measuring the height after images and `<details>` change the layout; the obvious implementation is a `load` listener on the image inside the frame. Measured, with every candidate wired before the trigger arrived and the height going from 150px to ~395px:

| mechanism | macOS | Windows | Linux |
|---|---|---|---|
| `load` on the iframe ELEMENT (app document) | fires | fires | fires |
| `load` on the `<img>` INSIDE the frame | no | no | no |
| `ResizeObserver` on the frame's `documentElement` | reports | reports | reports |
| `MutationObserver` on the frame's document | reports | reports | reports |
| polling `scrollHeight` | sees it | sees it | sees it |

The image's `load` listener not firing on WebView2 is unexplained — clicks are delivered there — and is left as an observation rather than a conclusion, because nothing rests on it: `ResizeObserver` reported the image reflow on all three and `MutationObserver` reported the `<details>` attribute change on all three. `<details>` opens on a user click on all three despite scripting being disabled, which is UA behaviour, so it is a real source of late layout and not a theoretical one. The iframe element's own `load` event fires everywhere, so decision-3's lifecycle ("`contentDocument` is `about:blank` until `load`") is safe to build on.

## Method defects found and corrected mid-run

Recorded because a later re-run on a new WebView version would repeat them.

1. **The probe page could not be scrolled**, so the manual steps below the fold were unreachable. The app shell puts `overflow: hidden` on `body`.
2. **The click-driven checks had no positive control.** "The on-click attribute did not run" passes by absence, so on an engine that delivers no click it passes while proving nothing. Every fixture now carries a control element clicked first, and the dependent checks go inconclusive when it fails.
3. **A synthetic click is not the thing under test.** `HTMLElement.click()` and a constructed `MouseEvent` are both undelivered on WebKit, but so is a real click — which is what had to be shown, and only the third round showed it.
4. **CSP was judged by violation events alone**, which cannot separate a missing policy from a silent engine. Judging it by effect, with a `data:` pair that needs no network, is what settled it.
5. **The report filed measured results under a "recorded by hand" heading**, which made a reader doubt an answer they had never given.

## Verdict (AC #8)

**decision-3's Prerequisite is satisfied and the decision does not reopen**: the two behaviours it names — same-origin access under `sandbox="allow-same-origin"`, and CSP inheritance into `srcdoc` — both hold on WKWebView, WebView2 and WebKitGTK. The srcdoc-iframe approach stands.

Three mechanisms in its Decision and Consequences sections are contradicted by measurement and are amended by decision-9: link interception is available only where the frame's document runs parent-registered listeners (WebView2 today), keyboard forwarding is not required, and late layout is observed rather than listened for. No platform is excluded and no unverified pass is left standing (AC #17).
---

created: 2026-08-18 02:09
---
Follow-up from the PR #31 review: two of the criteria above were ticked on evidence that does not carry, and they are unticked again until one more pass closes them.

**AC #4 (form, meta refresh, target=_top) and AC #10 (plain link without interception) were exercised with a synthetic `.click()`, and on both WebKit engines nothing a click drives reaches the frame.** That was established for listeners in the third round, and the same doubt applies here for a different reason: a form submitting and a link navigating are activation behaviour, not listener behaviour, so they can be live while every listener is dead — and equally they can be dead, in which case "the form did not submit" records only that the probe never made it submit. The meta-refresh half of #4 is unaffected, since it needs no activation at all.

WebView2 has the answer either way: the plain link DID navigate the frame away there without interception, so activation occurred and the form and top-navigation results on that platform are real.

The probe now carries an activation control alongside the click control: a `<details>` the harness clicks synchronously and reads back, chosen because opening it is UA behaviour with no script involved and the outcome is a readable attribute rather than an event. The three checks that rest on activation report `inconclusive` when it fails instead of passing. Closing #4 and #10 on WKWebView and WebKitGTK needs one more run of `Run all checks` on those two platforms — it changes nothing else in the record.

A related limit, now stated in decision-9 rather than implied: **only external links were clicked, never a `#` one.** That fragment links are inert on WebKit is an inference from the listener result plus a frame sized to its own content having no viewport to scroll — and that arrangement is what TASK-5.2 builds, not something measured here. TASK-5.2 observes it before anything writes it down as fact.
---

created: 2026-08-18 02:58
---
Fourth pass on WKWebView and WebKitGTK, with the activation control the PR review asked for. **AC #4 and AC #10 are closed, and the earlier reading of the click result was too broad.**

`Activation control: true` on both WebKit engines. So a click driven from the parent *does* activate what it hits there — the `<details>` the harness clicks opens — and the three checks that rest on activation pass on their own terms:

- `sandbox.form-submit` — PASS on both. Neither the form's `action` nor a button's `formaction` submits, and no CSP violation was reported, so the submission was stopped before it became a navigation: the sandbox, `allow-forms` being absent.
- `sandbox.top-navigation` — PASS on both. The probe page was not reloaded and no query flag appeared.
- `nav.plain-link-uncontrolled` — PASS on both: with no interception at all, the frame stayed on the fixture. Windows is the divergence here and remains so — there the same click DID take the frame away, which is what made interception load-bearing on that platform.

**The correction: it was never true that "no click reaches the frame".** Rounds 2 and 3 established that no parent-registered listener runs; this round shows the click still arrives and still activates. The boundary is narrower and sharper than the earlier wording, and it cuts two ways. It is what makes the form and top-navigation results real containment rather than a probe that never pressed anything. It also weakens the inference about fragment links rather than supporting it: if activation is intact, the UA may perform native fragment navigation whether or not a listener hears the click, so TASK-5.2 must observe a real `#` click before anything records it as inert. decision-9 has been corrected on both points.

All seventeen criteria are now met on all three platforms.
---
<!-- COMMENTS:END -->
