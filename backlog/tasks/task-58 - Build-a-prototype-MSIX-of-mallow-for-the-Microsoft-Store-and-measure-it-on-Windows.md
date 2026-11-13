---
id: TASK-58
title: >-
  Build a prototype MSIX of mallow for the Microsoft Store and measure it on
  Windows
status: To Do
assignee: []
created_date: '2026-11-13 19:41'
labels:
  - feature
dependencies: []
references:
  - src-tauri/tauri.conf.json
  - src-tauri/src/lib.rs
  - src/hooks/useUpdater.ts
  - src/lib/build-flags.ts
  - >-
    backlog/decisions/decision-16 -
    Forward-a-second-launch-to-the-running-process-and-register-mallow-for-markdown-as-a-candidate-opener-never-as-the-default.md
  - 'https://v2.tauri.app/distribute/microsoft-store/'
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow reaches Windows only as the NSIS and MSI bundles on GitHub Releases, unsigned, so every reader meets SmartScreen's download-time warning (README names it). The Microsoft Store takes an MSIX package and signs it itself, which needs no code-signing certificate of mallow's own, and delivers updates through the Store. This task builds a prototype MSIX of mallow and measures it on Windows, so that whether to submit one can be decided on what a packaged mallow actually does rather than on what it should do.

**Tauri produces no MSIX.** The package is built from what `pnpm tauri build` already produces: the release `mallow.exe` and its resources laid out in a folder, an `AppxManifest.xml` written for mallow, and `makeappx pack` from the Windows SDK. The tile and store logos `pnpm tauri icon` generates (`Square44x44Logo.png`, `Square150x150Logo.png`, `StoreLogo.png` and the rest in `src-tauri/icons/`) are the assets the manifest names. The package declares `runFullTrust`, so mallow runs as an ordinary desktop app with no AppContainer around it: plain `std::fs`, the `notify` watcher and `editors.rs`'s processes are expected to work unchanged, which this task measures rather than assumes.

**A packaged mallow carries no updater.** The Store updates an MSIX itself, so a Store build must neither check GitHub nor install anything over itself. That makes this the first build variant mallow ships to readers: `tauri_plugin_updater` in `lib.rs`, the launch check in `App.tsx`, the `autoCheckUpdates` preference and its control in `SettingsModal`, and `UpdateDialog` all have to be absent from it, while the GitHub Releases build keeps every one. The unattended export is the precedent for the switch (`build.rs`'s `cfg(unattended)` and `lib/build-flags`' Vite substitution), not necessarily its shape.

**File associations come back on Windows.** decision-16 registers nothing on Windows because tauri's NSIS and MSI registrations take the extension's default. An MSIX `uap:FileTypeAssociation` adds mallow to "Open with" without taking the default, which is what decision-16 asks for on the other two platforms. Whether a file opened that way reaches `handover.rs` as an argument, and whether a second launch is still forwarded by single-instance inside a package, are measured.

Measured on a Windows machine, with the package installed locally (a self-signed certificate trusted on that machine, or `Add-AppxPackage -Register` under developer mode):
- **Where settings live.** An MSIX redirects writes under AppData to a per-package location, so `settings.json` (the restored session, recent folders, preferences), `.window-state.json` and the WebView2 user data may not be where the MSI build put them. Whether a reader moving from the MSI build keeps any of it is the question.
- **WebView2.** A package cannot run the WebView2 bootstrapper, so the runtime the OS carries is what mallow gets. Windows 11 always has one.
- What a reader does every day: opening a folder, the tree and the watch, the asset protocol's images and PDF, Open Recent, Open With and Reveal, Print and PDF export, a new window, quit and restore.

Out of scope: submitting to the Store (reserving the name in Partner Center and the identity it gives the manifest are the owner's, and the prototype may carry a placeholder identity), code signing of the NSIS / MSI bundles (Azure Artifact Signing is a separate task), building the package in CI, and ARM64 Windows, which mallow does not build.

To settle at the start:
- How the Store variant is switched: a cargo feature, a `cfg` set from `build.rs` the way `unattended` is, or both, and how the frontend half reads it.
- How the package is assembled: a script under `scripts/` that runs on a Windows machine, or steps written in the task alone until submission is decided.
- The version mapping: the Store wants four parts with the last one 0, so `0.14.0` becomes `0.14.0.0`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 How the Store variant is switched and how the package is assembled are settled and written in the task
- [ ] #2 A Store build carries no updater: tauri_plugin_updater is not registered, and neither the launch check, the autoCheckUpdates control nor UpdateDialog is reachable, while the GitHub Releases build keeps all of them
- [ ] #3 An MSIX built from pnpm tauri build's output installs and launches on a Windows machine, and the steps that built it are recorded
- [ ] #4 The manifest declares the markdown and mermaid extensions as file type associations; whether mallow appears under Open with without becoming the default, and whether a file opened that way reaches handover.rs, are measured and recorded
- [ ] #5 Where settings.json, .window-state.json and the WebView2 user data land inside the package, and whether an MSI install's settings carry over, are measured and recorded
- [ ] #6 The everyday paths (folder open and watch, media via the asset protocol, Open Recent, Open With and Reveal, Print and PDF export, a second window, a second launch forwarded, quit and restore) are measured inside the package and the result recorded
- [ ] #7 No production dependency is added, and pnpm lint, pnpm build, pnpm test, cargo check and cargo test pass for both variants
<!-- AC:END -->
