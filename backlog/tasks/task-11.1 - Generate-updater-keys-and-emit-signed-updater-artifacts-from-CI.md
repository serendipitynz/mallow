---
id: TASK-11.1
title: Generate updater keys and emit signed updater artifacts from CI
status: To Do
assignee: []
created_date: '2026-08-01 23:13'
updated_date: '2026-08-19 20:48'
labels:
  - feature
milestone: m-2
dependencies: []
parent_task_id: TASK-11
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The release mechanism half of TASK-11: an installed build must be able to discover and verify a new version. It also owns the dependency additions for the whole group: tauri-plugin-updater and tauri-plugin-process in src-tauri/Cargo.toml, their JS counterparts in package.json. TASK-11.2 only consumes them.

## Work

- pnpm tauri signer generate for the minisign keypair. The public key goes into plugins.updater.pubkey in tauri.conf.json - note there is no plugins key in that file today, so this is a new top-level section. The private key and its password become repo secrets TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD, wired into the tauri-action step env in .github/workflows/release.yml.
- Decide at generation time whether the key carries a password. In CI, tauri-cli substitutes an empty password when the variable is unset, so a password-less key needs one secret and a password-protected key needs two. That choice is what makes the CI secret count six-plus-one or six-plus-two, which TASK-11.3 has to state correctly.
- Committing the public key changes what a plain build does, so handle it in the same change. Three failure modes, and they do not fail alike:
  - No TAURI_SIGNING_PRIVATE_KEY while a public key is configured: the build stops.
  - A key set but no password outside CI: tauri-cli logs that it expects a password prompt and blocks on stdin, which would hang the non-interactive scripts/macos-sign-build.sh.
  - A private key that does not match the committed public key: only a warning, and the build succeeds. That is the dangerous one - it ships signatures every client rejects at runtime. Keep the variable empty in .env.signing.example rather than filling in a placeholder, so a copied file fails loudly on the first mode instead of quietly on the third.
  Add both variables to .env.signing and .env.signing.example. macos-sign-build.sh exports .env.signing with set -a, so appending is enough. Note the limits of that container: it is described as macOS signing and notarization credentials and is read by that one script, so a contributor bundling on Windows or Linux still has to export the variables by hand.
- tauri build --no-sign skips updater signing (and logs that it did), so contributors without the key are not locked out of local bundling. It also skips code signing, so it is not a substitute on the release path. TASK-11.3 records both halves.
- bundle.createUpdaterArtifacts: true in tauri.conf.json.
- plugins.updater.endpoints pointing at https://github.com/serendipitynz/mallow/releases/latest/download/latest.json. Owner comes from the git remote. The takkyun strings still in package.json, Cargo.toml and tauri.conf.json are a separate question - correct them here or record that they stay; either way it needs to land somewhere rather than being left to the next reader.
- Register tauri-plugin-updater and tauri-plugin-process in src-tauri/src/lib.rs and add updater:default plus process:allow-restart to src-tauri/capabilities/default.json. Custom commands are not gated by capabilities but plugin APIs are. If the new registrations are put under cfg(desktop), know that this introduces the pattern rather than following one: none of the four .plugin() calls at lib.rs:10-13 are gated today, and the mobile_entry_point attribute at lib.rs:7 is the only mobile-aware line in the file. Gating with no mobile target is defensible as future-proofing, and so is leaving it out - decide, and keep the four existing calls consistent with whatever is decided.
- scripts/setup-ci-signing-secrets.sh cannot register these on its own: it takes a .p12 as a required argument and prompts for its export password, so rotating only the updater key would demand the whole certificate. Add an updater-only path or document the gh secret set calls separately.

## Decide: confirm rpm before promising it

Read the pinned toolchain rather than the docs or the CLI help text, because they disagree with each other. In tauri-cli 2.11.4, which the lockfile pins, sign_updaters signs the app archive plus nsis, msi, appimage, deb and rpm, so a .rpm.sig is produced. But the bundler check that decides whether to warn about a missing updater target counts only appimage, nsis, msi and deb as self-contained, and the warning it prints lists only app, appimage, msi and nsis. deb is therefore solidly supported and the warning text is simply stale; rpm is the one with inconsistent treatment upstream.

Three components have to agree before an entry appears, and they were checked one by one. For deb all three do: tauri-cli signs it, the bundler counts it self-contained, and tauri-action build.ts at the pinned action-v0.6.2 collects the .deb.sig under bundle: deb, which is what puts linux-x86_64-deb into latest.json. For rpm the action collects .rpm.sig the same way and the CLI signs it, so only the bundler check disagrees - which is exactly why it is a question and deb is not.

So do not carry rpm as a settled fact. The first CI run that produces a latest.json is what decides it: if linux-x86_64-rpm is absent, drop rpm from the reach claim in TASK-11 and from both READMEs in TASK-11.3 rather than shipping a promise that does not hold.

Whatever the answer, TASK-11.1 owes one more thing: what a deb or rpm install should do when latest.json has no entry for it. Doing nothing is not neutral - the client falls back to the bare linux-x86_64 entry, which is the AppImage, and installs it as one.

## Known defect to design around (not something to verify afterwards)

Every matrix job read-modify-writes latest.json: upload-version-json.ts GETs the existing asset, merges platforms into it, DELETEs it and re-uploads, with no lock or conditional request. release.yml runs the three build jobs in parallel with no max-parallel, so a lost update ships a latest.json that is silently missing a platform. Choose a fix in this task:
- max-parallel 1 on the build matrix. One line, serialises release builds only. It leaves three writers and removes only the interleaving - a scheduling guarantee, not a structural one, which is enough here because nothing else writes the file.
- includeUpdaterJson false plus an aggregation job after the matrix. Structurally one writer, but the cost is not symmetric: turning the input off removes the only thing that writes latest.json, so the aggregation job has to build the file itself from the uploaded .sig assets. That is a bespoke script, not a config toggle.

## Decide: the download URLs inside latest.json are not tag-pinned today

At the pinned version below, the per-platform urls in latest.json come from each asset browser_download_url, and the action rewrites the untagged-... segment a draft produces into /latest/download/. Because release.yml passes releaseId without tagName, every shipped url therefore reads releases/latest/download/<asset> - it resolves to whatever is newest at download time, not to the release the entry describes. Publishing any later release that lacks updater bundles turns those urls into 404s for clients still on the older version.

The fix is one line: pass tagName alongside releaseId in the tauri-action step. That does not disturb the draft, because the action only creates or edits a release when tagName is set and releaseId is not; with releaseId present it is used for the JSON only. Decide and record either way.

## Bundle-type detection is a binary patch, and it fails quietly

The client only resolves os-arch-installer because tauri-bundler rewrites a marker token in the main binary per bundle type before packaging. Worth knowing because the failure mode is silent twice over: patch_binary failures are logged as a warning and the build continues, and a binary without the marker reports no bundle type, so the client falls back to the bare os-arch entry - AppImage on Linux, MSI on Windows - and then installs it as an AppImage. A deb install would try to overwrite itself with AppImage bytes. The same fallback is what a missing latest.json entry produces, which is why the rpm question above has to be answered rather than left open. The build log is the only place the patch failure shows, so check it. macOS is the exception at both ends: native bundles skip the patch by design, so the Developer ID signature is never at risk, and an unpatched macOS binary still reports the app bundle type.

## Already settled upstream - do not re-investigate

- Universal macOS is handled: upload-version-json.ts writes darwin-aarch64 and darwin-x86_64 (plus the -app variants) from the single universal artifact. On macOS the -app key is the one actually used - the client asks for darwin-arch-app first and only falls back to the bare key.
- updaterJsonPreferNsis defaults to false, so the bare windows-x86_64 entry points at the MSI while windows-x86_64-nsis and windows-x86_64-msi both exist. The client looks up os-arch-installer first, so each install form resolves to its own bundle.
- release.yml uses the floating tauri-apps/tauri-action@v0 tag and the shape of latest.json depends on it, so pinning is worth doing now that a bad generation would be a shipped bug. Pin to action-v0.6.2, the newest v0 release. Do NOT jump to action-v1.0.0 as part of this task: it renames the inputs (includeUpdaterJson became uploadUpdaterJson, assetNamePattern became releaseAssetNamePattern), drops others, and changes the url form written into latest.json. Actions only warns about unknown inputs, so a half-migrated config would silently restore the concurrency defect this task is fixing.

## Verification plan

Nothing here can be proven on a draft release, because releases/latest resolves published non-prerelease releases only. Cutting a throwaway test release is also not free: scripts/release-version.mjs refuses to run off the default branch or on a dirty tree, and release.yml re-checks tag against manifests. Three routes, pick one before starting:
- Point the endpoint at a hand-written latest.json (gist or raw.githubusercontent.com) referencing a signed bundle. Check and download can be exercised from a dev build; install and relaunch must be run from an installed bundle, because the updater derives its replacement target from the running executable path and would rewrite the debug target directory instead.
- Publish a prerelease and point the endpoint at it temporarily.
- Ship the updater in 0.5.0 and prove the real path when 0.5.1 goes out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm tauri signer generate has been run, the public key is committed in tauri.conf.json, and the private key - plus its password if the key has one - exists as repo secrets without ever being committed
- [ ] #2 Whether the key is password-protected is decided and recorded, and the CI secret list matches that decision
- [ ] #3 The updater variables are present in .env.signing.example with empty values, and scripts/macos-sign-build.sh still runs to completion without an interactive prompt
- [ ] #4 A local pnpm tauri build emits the .app.tar.gz alongside its .sig, and a build with --no-sign still produces bundles without the private key
- [ ] #5 A published test release carries a latest.json containing at least darwin-aarch64, darwin-x86_64, windows-x86_64-nsis, windows-x86_64-msi, linux-x86_64-appimage and linux-x86_64-deb, each with a signature. The bare os-arch and -app entries appearing alongside them is expected, not a misconfiguration
- [ ] #6 Whether linux-x86_64-rpm appears in that latest.json is confirmed from the real artifact, and the reach claims in TASK-11 and TASK-11.3 are made to match the answer
- [ ] #7 What a Linux install with no matching latest.json entry should do is decided and recorded, rather than being left to the bare-key fallback that would install an AppImage over it
- [ ] #8 The download urls in latest.json are either tag-pinned, or the decision to leave them resolving to latest is recorded with its reason
- [ ] #9 No two matrix jobs can write latest.json concurrently, and one real release confirms every expected platform is present
- [ ] #10 The release build log shows the bundle-type patch applied for deb, rpm, nsis and msi, since a failed patch is only a warning
- [ ] #11 release.yml pins tauri-action to a v0 release rather than the floating v0 tag
- [ ] #12 The endpoint URL names the owner the git remote points at, not the redirecting one, and the takkyun strings elsewhere are either corrected or recorded as deliberately left
- [ ] #13 The two Rust crates and their two JS packages are added, registered in lib.rs, and permitted in capabilities/default.json, with the plugin registrations either all desktop-gated or all ungated
- [ ] #14 The macOS .app.tar.gz contains the signed and notarized .app, so an updated install still passes Gatekeeper
- [ ] #15 cargo check and cargo test pass in src-tauri, and pnpm build and pnpm test pass
- [ ] #16 THIRD-PARTY-NOTICES.md is regenerated with pnpm notices after the new dependencies land
<!-- AC:END -->
