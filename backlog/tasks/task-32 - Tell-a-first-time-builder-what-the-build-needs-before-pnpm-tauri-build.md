---
id: TASK-32
title: Tell a first-time builder what the build needs before pnpm tauri build
status: To Do
assignee: []
created_date: '2026-09-09 17:46'
labels:
  - documentation
dependencies: []
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-09-09 (macOS, clean clone, `pnpm install` completed): with `cargo`, `rustc` and `rustup` all absent from `PATH`, `pnpm tauri build` stops with `failed to run 'cargo metadata' command to get workspace directory: … No such file or directory (os error 2)`. Nothing in either README says a Rust toolchain is needed at all - the Development section is a command list, and `pnpm install` above it installs only the JS side, so the reader's evidence points at the command rather than at their machine.

**What is missing is the prerequisites, not this one error line.** The same requirement stands behind `pnpm tauri dev`, `cargo check` and `cargo test`, which the Development section also lists, so a note attached to the build command alone would leave the other three unexplained.

**Do not write that Xcode Command Line Tools were the missing piece.** On the machine this was measured on `xcode-select -p` answered `/Applications/Xcode.app/Contents/Developer`, so the toolchain was the only absent requirement and the CLT's necessity was never exercised here. It belongs in the text as an upstream prerequisite with Tauri's own page as the source, not as something this event established. The same applies to every Windows and Linux system dependency: this project ships bundles for all three, and none of their prerequisites were touched by this measurement.

**No Rust version floor is pinned by this repository.** `src-tauri/Cargo.toml` declares `edition = "2021"` and `tauri = "2"`, and there is no `rust-toolchain.toml`, so the README has nothing of its own to state - a number written here would come from Tauri's requirements, which is where the reader should be sent instead.

**The second stop a first-time builder hits is already recorded and must be reachable from the same place.** `tauri.conf.json` carries `createUpdaterArtifacts: true` and the committed updater public key, so a build with no `TAURI_SIGNING_PRIVATE_KEY` in the environment stops (AGENTS.md, "Signed self-update"), and `pnpm tauri build --no-sign` is the contributor path - it skips code signing at the same time, so it is not a release path. That runbook stays in AGENTS.md; what README owes is the sentence that keeps the reader from reading it as a broken build, plus the pointer.

Scope: the Development section of README.md and README.ja.md. No code, no CI, and no new copy of the signing runbook.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README.md and README.ja.md each carry a prerequisites list ahead of the Development commands, naming a stable Rust toolchain installed via rustup (with `cargo` on `PATH`), Node + pnpm, and each platform's system dependencies by reference to Tauri v2's own prerequisites page rather than by restating it
- [ ] #2 The text states that `pnpm install` covers only the frontend, and that the Rust toolchain is what `pnpm tauri dev`, `pnpm tauri build`, `cargo check` and `cargo test` all rest on - not the build command alone
- [ ] #3 The `cargo metadata … No such file or directory (os error 2)` line appears verbatim enough to be searchable, attributed to a missing toolchain, so a reader who already hit it identifies their own cause without reading further
- [ ] #4 The section says a local `pnpm tauri build` stops when `TAURI_SIGNING_PRIVATE_KEY` is unset, names `pnpm tauri build --no-sign` as the contributor path and `pnpm tauri dev` as the option needing no signing at all, and links AGENTS.md's signing runbook instead of duplicating it
- [ ] #5 Nothing unmeasured is claimed: no minimum Rust version, no assertion that Xcode Command Line Tools were absent in the measured event, and no claim about which Windows or Linux packages were verified
- [ ] #6 The English and Japanese sections carry the same content at the length the rest of the README is written at - a short list plus one or two sentences, with no reasoning about why the updater key is committed
<!-- AC:END -->
