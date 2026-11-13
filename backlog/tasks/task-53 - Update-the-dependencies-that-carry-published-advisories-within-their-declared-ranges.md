---
id: TASK-53
title: >-
  Update the dependencies that carry published advisories, within their declared
  ranges
status: To Do
assignee: []
created_date: '2026-11-13 05:08'
labels:
  - chore
dependencies: []
references:
  - package.json
  - pnpm-lock.yaml
  - src-tauri/Cargo.toml
  - src-tauri/Cargo.lock
  - scripts/gen-third-party-notices.mjs
priority: high
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A dependency scan on 2026-11-13 (`pnpm audit`, and Cargo.lock's 522 crates queried against OSV.dev, which carries RustSec) found 26 npm advisories (1 critical, 6 high, 13 moderate, 6 low; 14 of them in production dependencies) and 21 RustSec advisories across 18 crates. Most are fixed by versions inside the ranges `package.json` and `Cargo.toml` already declare, so this task takes those versions and records what remains.

What ships in the app and is fixed within range:
- **smol-toml** 1.7.0 → 1.9.1: a malformed TOML document can stall the parser (GHSA-7w5x-hrqm-74c2, high) and key parsing is quadratic (GHSA-r4xh-jqrq-34v2). mallow parses whatever TOML file the reader opens, so this is reachable from a document.
- **mermaid** 11.16.0 → ≥ 11.16.1 (11.17.2 is the latest 11.x): CSS injection onto the diagram's siblings, prototype pollution in architecture diagrams and in the configuration APIs, and infinite-loop / DoS in XY and radar charts. Reachable from any document carrying a diagram.
- **dompurify** (through mermaid) → 3.4.17: a SAFE_FOR_TEMPLATES bypass (critical) and several IN_PLACE detached-subtree issues. mermaid's own range `^3.3.3` admits 3.4.17. Whether mermaid calls DOMPurify in the affected modes has not been read.
- **rustls** 0.23.43 → 0.23.46, **rustls-webpki** 0.103.15 → 0.103.17, **webpki-root-certs** 1.0.9 → 1.0.12: handshake-boundary, downgrade and distrusted-intermediate issues. Reached through tauri-plugin-updater's HTTPS to GitHub; the payload is minisign-verified regardless, the channel is not.
- **tokio**, **rustix**, **event-listener**: unsound, fixed by `cargo update`.

Development-only and fixed within range: vite 7.3.6 → 7.3.8, vitest / @vitest/mocker → 4.1.12, browserslist → 4.29.5, source-map-js → 1.2.2, baseline-browser-mapping ≥ 2.11.0. None reaches the bundle; they affect `pnpm tauri dev` and the test run.

What this task cannot fix by updating, and has to record instead:
- **katex** (through mermaid, low, GHSA-238p-pmpm-9mq7): fixed in 0.18.2 while mermaid 11 pins `^0.16.45`. A pnpm override is possible; whether to take one is to be settled here.
- **quick-xml** 0.39.4 (through tauri → plist, two DoS advisories, fixed in 0.41.0): mallow's XmlView parses with the WebView's DOMParser, so a document does not reach this parser. Waits on tauri.
- **zip** 4.6.1 (through tauri-plugin-updater, Windows only, four extraction advisories, fixed in 9.0.0): the updater extracts only an archive whose signature has verified. Waits on the plugin.
- **Unmaintained**: glib 0.18 (also unsound, the GTK3 stack), unic-*, proc-macro-error, zbus_names, zvariant, zvariant_derive — all transitive through Tauri / GTK3.

Out of scope: major-version moves (mermaid 12, vite 8, vitest 5, @vitejs/plugin-react 5), and anything that schedules or automates the scan, which is TASK-54.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm audit --prod reports no advisory that a version within package.json's ranges fixes
- [ ] #2 pnpm audit (dev included) reports no advisory that a version within range fixes
- [ ] #3 A RustSec scan of src-tauri/Cargo.lock reports no vulnerability that cargo update fixes (rustls, rustls-webpki, webpki-root-certs, tokio, rustix, event-listener)
- [ ] #4 Whether katex is overridden past mermaid's range is settled, and the answer written in the task
- [ ] #5 Every advisory left unfixed is listed in the task with its path, why it is not reachable or not fixable here, and what upstream release would clear it
- [ ] #6 A mermaid diagram, a TOML file and a malformed TOML file still render or report as before in pnpm tauri dev
- [ ] #7 pnpm lint, pnpm build, pnpm test, cargo fmt --check, cargo check and cargo test pass, and pnpm notices is regenerated if any bundled dependency's version changed
<!-- AC:END -->
