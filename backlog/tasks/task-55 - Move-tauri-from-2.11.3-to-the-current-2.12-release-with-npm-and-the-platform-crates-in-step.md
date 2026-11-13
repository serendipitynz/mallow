---
id: TASK-55
title: >-
  Move tauri from 2.11.3 to the current 2.12 release, with npm and the platform
  crates in step
status: To Do
assignee: []
created_date: '2026-11-13 09:07'
labels:
  - chore
dependencies: []
references:
  - src-tauri/Cargo.toml
  - package.json
  - .github/dependabot.yml
  - src-tauri/.cargo/audit.toml
  - src-tauri/src/pdf.rs
  - src-tauri/src/modifier.rs
  - AGENTS.md
  - AGENTS.ja.md
priority: high
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow has held tauri at 2.11.3 because every tauri source citation in AGENTS.md is pinned to that release (decision-16, which also says "a tauri upgrade lifts" the `~2.4.5` pin on tauri-plugin-single-instance). The hold was never about a defect in 2.12. The current stable line is tauri 2.12.5 with @tauri-apps/api and cli 2.12.4 (checked 2026-11-13), and it carries changes mallow benefits from:

- **Security**: the channel-data IPC queue is bound to the webview that created it and its ids are scoped per webview (2.12.0). 2.11.6 carries only the clean-up half.
- **`asset://` is loaded asynchronously** instead of on the event-loop thread, so a slow or unreachable path no longer freezes every window (2.12.0). MediaView and the rendered views' rewritten references go through it.
- Listener leaks fixed for closed windows and webviews, and Windows focus fixes — mallow is multi-window.
- **tauri-plugin-updater 2.14.1** becomes reachable, the first release declaring zip ^9. That clears the zip entries accepted in `src-tauri/.cargo/audit.toml` and the zip Dependabot alerts dismissed on 2026-11-13 (TASK-53), provided the resolved zip is 9.0.5 or later (GHSA-m665-v7pm-7grj).

This task moves tauri to the current 2.12 release as one migration.

**Why it cannot be a Dependabot merge.** Dependabot's PRs #104 (cargo group) and #107 (npm group) each moved half of tauri: #104's lockfile resolved tauri 2.12.5, wry 0.57, muda 0.20 and tao 0.37 (pulled in by the transitive tauri-plugin-fs 2.7.1, which requires tauri ^2.12, past TASK-54's direct-dependency ignore list), and #107 moved @tauri-apps/api to 2.12.4. The tauri CLI refuses an npm package and a crate on different minors, so the paper build failed on all three platforms in both. Dependabot cannot update npm and cargo in one PR, so every tauri minor will arrive split this way.

What moves together:
- **Rust**: tauri 2.12.x, tauri-build 2.7.x, every tauri-plugin-* to its current release (single-instance to 2.5.x, lifting the `~2.4.5` pin; updater to ≥ 2.14.1). The Windows crates `pdf.rs` and `modifier.rs` use directly have to match wry's: `webview2-com` 0.38 → 0.39 and `windows-core` / `windows-sys` to the 0.62 line (Dependabot's #105 and #106 move them alone, which cannot compile against wry 0.55). The macOS `objc2-*` crates and Linux `gtk` / `webkit2gtk` are checked against what wry 0.57 uses. 2.12 sets MSRV 1.90 and drops Windows 7.
- **npm**: @tauri-apps/api, cli and every @tauri-apps/plugin-* to the matching releases.
- **The hold, restated for 2.12**: `Cargo.toml` and `package.json` pin the tauri crates and packages to `~2.12` so neither package manager can resolve a different minor on its own, and a minor upgrade is a task like this one. That replaces `.github/dependabot.yml`'s per-crate ignore list, which did not hold (above). Patch releases inside 2.12 still arrive through Dependabot.
- **AGENTS.md / AGENTS.ja.md**: every citation into tauri, tauri-runtime-wry, muda and wry source (about 17 file:line references, plus the "2.11.3" labels, 11 in each file) is re-read against the new versions and updated or corrected. The printing notes rest on wry 0.55.1's print implementation per platform and the menu notes on muda 0.19.3's GTK and macOS backends, so a changed behaviour there is a finding, not a renumbering. decision-16's pin paragraph is updated.
- **The accept lists**: the zip entries leave `src-tauri/.cargo/audit.toml` once the resolved zip is ≥ 9.0.5.

Out of scope: adopting 2.12's new APIs (`convert_file_src` in Rust, `limit_navigations_to_app_bound_domains`, `appDirectoriesOverride`, the `exit` command), each of which is its own decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tauri, tauri-build and every tauri-plugin-* crate are on their current releases on the 2.12 line, and @tauri-apps/api, cli and every @tauri-apps/plugin-* on the matching releases
- [ ] #2 webview2-com, windows-core and windows-sys match what wry uses, and the Windows arms of pdf.rs and modifier.rs compile in the paper job
- [ ] #3 Cargo.toml and package.json pin the tauri crates and packages to ~2.12, and dependabot.yml's tauri ignore list is removed
- [ ] #4 Every AGENTS.md / AGENTS.ja.md citation into tauri, tauri-runtime-wry, muda and wry source is re-read against the new versions, and each one is updated, corrected or removed; decision-16's pin paragraph says what holds now
- [ ] #5 The resolved zip is 9.0.5 or later and the zip entries are gone from src-tauri/.cargo/audit.toml, with cargo audit still passing
- [ ] #6 pnpm lint, pnpm build, pnpm test, cargo fmt --check, cargo check, cargo test, the Audit workflow and the paper job on all three platforms pass
- [ ] #7 On macOS, Windows and Linux by hand: printing (Linux still refused), the menu (CmdOrCtrl+W on Windows, a pointer-chosen menu entry on Linux), restoring several windows, a second launch handing a file over, and opening an image / PDF from a folder behave as before
- [ ] #8 An update from the released v0.13.0 to a build of this branch is installed through the in-app updater on at least one platform, or the task records why it could not be
<!-- AC:END -->
