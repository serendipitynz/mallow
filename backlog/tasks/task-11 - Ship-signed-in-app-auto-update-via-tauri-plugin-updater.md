---
id: TASK-11
title: Ship signed in-app auto-update via tauri-plugin-updater
status: To Do
assignee: []
created_date: '2026-08-01 23:13'
updated_date: '2026-08-19 20:48'
labels:
  - feature
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella for making installed builds update themselves from published GitHub releases, using the official tauri-plugin-updater.

Chosen over the two alternatives weighed in the conversation that opened this task:
- notify-only (poll the releases API, open the release page with the opener plugin) needs no key and no new bundle target, but leaves every user reinstalling by hand;
- Homebrew Cask covers macOS only and leaves Windows and Linux users with no update path.
Full in-app update is accepted knowing it adds a permanent obligation: the minisign private key has no recovery path.

Endpoint is the static JSON on GitHub Releases:
https://github.com/serendipitynz/mallow/releases/latest/download/latest.json
The owner is the one the git remote points at. package.json, Cargo.toml and tauri.conf.json used to say takkyun/mallow, resolving only through a GitHub rename redirect - tolerable for a homepage link, unacceptable for a URL compiled into shipped binaries, because that redirect disappears the day a takkyun/mallow repository exists and cannot be recalled from installs already in the wild. TASK-11.1 corrected all three (decision-11).

GitHub resolves latest against published, non-prerelease releases only, so the draft-then-publish-by-hand flow in .github/workflows/release.yml is unchanged - publishing the draft is what starts a rollout.

Two things this does NOT touch, worth stating so nobody re-derives them: the updater fetches from Rust, not the WebView, so the CSP in tauri.conf.json needs no widening; and nothing here reaches the untrusted-Markdown boundary.

Platform reach - every form the release ships can self-update. Checked against the pinned sources rather than the docs, which lag, and closed against the real v0.7.0 latest.json:
- macOS: the .app.tar.gz, wrapping the .app the existing pipeline already signs and notarizes;
- Windows: both bundles, since bundle.targets is all and the release carries mallow_x64-setup.exe and mallow_x64_en-US.msi;
- Linux: AppImage, deb and rpm. The client side was already settled (plugins-workspace PR 2624; the Installer enum covers appimage, deb, rpm, app, msi, nsis), and in the lockfile-pinned tauri-cli 2.11.4 sign_updaters signs appimage, deb, rpm, nsis, msi and the app archive. rpm was the loose end, because the bundler counts only appimage, nsis, msi and deb as self-contained updater targets, and the warning it prints lists only app, appimage, msi and nsis - stale text that reads as a capability list and has already misled one review. The v0.7.0 round measured it (TASK-11.1 AC #6): latest.json carried linux-x86_64-rpm and linux-aarch64-rpm, both signed, and the bundle-type marker was patched for rpm on both Linux jobs. What that shows is that a client resolves an rpm target key; installing the .rpm on a real rpm system is untested, as it is for every other form here.
Applying an update is not silent on any platform - TASK-11.2 has the per-platform detail and owns the UI copy for it. That much is a wording problem rather than a reach problem, and reach itself now has no open question.

Reach has one hard edge: nobody on 0.4.0 or earlier is reachable, because their binary has no updater. Everyone must download once by hand to get onto the first updater-carrying release. TASK-11.3 says so in the README and in that release note.

Verification needs machines, not just code: a real or virtual Windows install and a Linux install (AppImage plus one of deb or rpm) have to exist before the end-to-end checks in TASK-11.2 and the DoD below can be closed. CI cannot stand in for them. Line them up before starting.

New production dependencies (tauri-plugin-updater, tauri-plugin-process, and their JS counterparts) were approved in that same conversation, satisfying the ask-first rule in AGENTS.md. TASK-11.1 adds them.

Split into three subtasks because the review units differ: the signing and release mechanism, the in-app experience, and the operational documentation.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 TASK-11.1, TASK-11.2 and TASK-11.3 are all Done
- [ ] #2 An installed build updates itself end to end on macOS, Windows and Linux. This needs two consecutive published releases that both carry the updater, so schedule it as part of the release plan rather than as a one-off test
- [ ] #3 The updater private key is stored where it survives this machine, and the consequence of losing it is written down
<!-- DOD:END -->
