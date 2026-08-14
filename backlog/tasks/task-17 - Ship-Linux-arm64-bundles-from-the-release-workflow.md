---
id: TASK-17
title: Ship Linux arm64 bundles from the release workflow
status: To Do
assignee: []
created_date: '2026-08-14 04:27'
updated_date: '2026-08-14 05:03'
labels:
  - chore
milestone: m-0
dependencies: []
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carried over from backlog-atlas's v0.1.0 release (its TASK-172), which found the same gap in the same workflow shape. mallow has it too.

## What the release actually ships today

Measured on the published v0.4.0 assets (2026-08-14):

`mallow_0.4.0_amd64.deb`, `mallow-0.4.0-1.x86_64.rpm`, `mallow_0.4.0_amd64.AppImage`, `mallow_0.4.0_x64_en-US.msi`, `mallow_0.4.0_x64-setup.exe`, `mallow_0.4.0_universal.dmg`, `mallow_universal.app.tar.gz`.

**Every Linux asset is x86_64 and there is no arm64 asset of any kind.** macOS is covered on both architectures by the universal `.dmg`, so this is a Linux-only hole. It is not hypothetical: a Linux VM on an Apple Silicon Mac is arm64, which is the ordinary way to have a Linux check environment on this hardware, and such a machine cannot install any published mallow build.

## The candidate

Add a `ubuntu-22.04-arm` (or `ubuntu-24.04-arm`, see below) entry to the `build` matrix in `.github/workflows/release.yml`. GitHub's arm64 hosted runners are generally available for **public** repositories at no cost since 2025-08-07, with `ubuntu-22.04-arm` and `ubuntu-24.04-arm` among the supported labels; `serendipitynz/mallow` is public, so the label resolves. (In a private repo the same label fails the job outright — worth knowing before this workflow is ever copied into one.)

Whether the build itself passes on that runner is **not measured**. Treat the rest of this task as the work of finding out.

## Decide first: 22.04-arm or move both Linux jobs to 24.04

The x64 Linux job is pinned to `ubuntu-22.04` on purpose — the workflow comment says 22.04 keeps the produced AppImage runnable against older glibc than 24.04 would. Matching that pin on arm64 keeps one glibc baseline for both Linux bundles.

But the Ubuntu 22 runner images (**both x64 and arm64**) begin deprecation on **2026-09-17** and are fully unsupported by **2027-04-17**, with jobs deliberately failed during brownout windows in between (actions/runner-images#14254). That is roughly a month out from this task being filed, so pinning arm64 to 22.04 buys very little before the same move has to be made for both jobs anyway.

So this is one decision, not two: keep both Linux jobs on 22.04 and accept a near-term forced migration, or move both to 24.04 now and take the higher glibc floor on the AppImage. Whichever is chosen, the reason belongs in the workflow comment that currently only explains the 22.04 pin — otherwise the next reader sees a stale rationale.

## Concrete edits, and the one that will bite

- A matrix entry for the arm runner. `rust_targets` and `tauri_args` stay empty like the other native jobs — the runner is natively arm64, so no cross-compilation is involved.
- **`Install Linux system dependencies` is gated on `matrix.platform == 'ubuntu-22.04'`, an exact string match.** A second Linux runner under any other label silently skips it and the build fails at webkit2gtk. Widen the condition (e.g. `startsWith(matrix.platform, 'ubuntu')`) rather than adding a second copy of the step.
- Asset names carry the architecture (`arm64` / `aarch64`), so a fourth job uploading into the same draft release id collides with nothing. No change is needed to how `create-release` hands out the id.

## Unmeasured: AppImage on arm64

deb and rpm are straightforward. AppImage is the one to watch — the bundler fetches an architecture-specific linuxdeploy, and that path is far less travelled on arm64 than on x86_64. If it fails, **ship arm64 as deb + rpm only** (`--bundles deb,rpm` in that matrix entry's `tauri_args`) rather than letting one bundle form fail the whole release, and say in the workflow which form is missing and why. Do not leave it as a silent difference between the two Linux jobs.

## What this touches elsewhere

- **TASK-11 (updater), if it lands first**: a fourth build job is a fourth parallel writer of `latest.json` — the lost-update defect TASK-11.1 already has to fix, made one job worse. It also adds `linux-aarch64-*` entries. Nothing to do here beyond knowing the writer count changed; the fix stays TASK-11.1's.
- **Docs**: `AGENTS.md` / `AGENTS.ja.md` "Cross-platform release via GitHub Actions" says the workflow builds "macOS (universal), Windows, and Linux bundles" without naming architectures. Once arm64 exists that sentence is what tells the next person which machines a release covers.
- **README** has no download or install section in either language today, so there is nothing there to correct. Do not add one as part of this task — that is a separate decision about what the README is for.

## Verification is a machine, not a green check

CI going green proves the bundle was produced, not that it starts. The AppImage (or deb) has to be run on a real arm64 Linux — the owner's VM — before this is closed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The release workflow produces Linux arm64 deb and rpm bundles and uploads them to the same draft as the x86_64 ones
- [ ] #2 Whether the Linux jobs stay on 22.04 or move to 24.04 was decided against the Ubuntu 22 deprecation dates (2026-09-17 / 2027-04-17), and the reason replaces the stale glibc-only comment in the workflow
- [ ] #3 The Linux dependency-install step covers both Linux runners; no exact-string gate on ubuntu-22.04 is left behind
- [ ] #4 Whether AppImage builds on arm64 was measured; if it does not, arm64 ships deb+rpm only and the workflow says which form is missing and why
- [ ] #5 AGENTS.md and AGENTS.ja.md name the architectures a release covers, not just the platforms
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 A release run (tag push or manual dispatch) put the arm64 assets on the draft alongside the existing x86_64, Windows and macOS ones
- [ ] #2 An arm64 bundle was installed and launched on a real arm64 Linux (the owner's VM) - CI green is not the check
- [ ] #3 The three existing jobs are unchanged in behaviour: macOS notarization still runs and the x86_64 assets are as before
<!-- DOD:END -->
