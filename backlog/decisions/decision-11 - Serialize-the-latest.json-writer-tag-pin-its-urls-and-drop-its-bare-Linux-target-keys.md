---
id: decision-11
title: >-
  Serialize the latest.json writer, tag-pin its urls, and drop its bare Linux
  target keys
date: '2026-08-22 23:08'
status: accepted
---
## Terms

- **target key** — a key of `platforms` in `latest.json`. Either
  *installer-qualified* (`linux-x86_64-deb`, three parts) or **bare**
  (`linux-x86_64`, two parts). The client looks up the installer-qualified key
  first and falls back to the bare one.
- **bare target key** — the two-part form. tauri-action always writes it
  alongside the qualified ones. On Linux its payload is the AppImage. It is what
  "no entry for me" resolves to, not a default update source.
- **bundle-type marker** — the token tauri-bundler rewrites into the main binary
  per bundle type before packaging. Without it a client cannot report its own
  bundle type and falls back to the bare target key. A failed patch is logged as
  a warning and the build continues.
- **cross-format overwrite** — an install of one distribution form replacing
  itself with another form's bytes: a deb install overwritten by AppImage. Worse
  than receiving no update at all, so the two are not the same failure.
- **lost update on latest.json** — `upload-version-json.ts` GETs the asset,
  merges its own platforms in, DELETEs it and re-uploads, with no lock and no
  conditional request. Two concurrent writers drop one set of platforms. Nothing
  errors; the result is indistinguishable from a build job that produced nothing.
- **latest-resolving url** / **tag-pinned url** — a download url of the form
  `releases/latest/download/<asset>`, which resolves to whatever is newest when
  the client downloads, versus `releases/download/<tag>/<asset>`, fixed to the
  release the entry describes.

## Context

TASK-11.1 turns on `bundle.createUpdaterArtifacts` and commits the updater's
public key, which makes `latest.json` a shipped artifact rather than a build
byproduct. Three properties of how it is produced were wrong or unsafe by
default, and all three fail without failing the build — the class the m-2
handoff calls a warning-only failure.

**The matrix races on the asset.** `release.yml` runs four build jobs with no
`max-parallel`, and each one read-modify-writes `latest.json`. A lost update
ships a release whose `latest.json` is missing a platform, and the release page
looks complete because the bundles themselves uploaded fine.

**The urls are not tag-pinned.** The action rewrites the `untagged-…` segment a
draft produces into `/latest/download/`, so every entry points at whatever is
newest at download time rather than at the release it describes. Nothing is
wrong until the first later release that carries no updater bundles, at which
point every url in every older client 404s — and those clients cannot be
reached to correct it.

**A Linux install with no entry of its own does not stop.** It falls back to the
bare target key, which is the AppImage, and installs it as one: a cross-format
overwrite. Two things put an install in that position. rpm's support is
inconsistent upstream — tauri-cli 2.11.4 signs `.rpm`, tauri-action collects
`.rpm.sig`, but the bundler check that decides whether to warn counts only
appimage, nsis, msi and deb as self-contained — so whether `linux-x86_64-rpm`
appears is not knowable before the first real `latest.json`. And a failed
bundle-type marker patch leaves any binary reporting no bundle type at all.

Doing nothing about the third is not a neutral choice; it is choosing the worse
of two failures for a case that cannot be ruled out in advance.

## Decision

**One writer at a time.** `max-parallel: 1` on the build matrix. Three writers
remain and only the interleaving is removed — a scheduling guarantee rather than
a structural one — which is sufficient because nothing else writes that asset.
The structural alternative (`includeUpdaterJson: false` plus an aggregation job)
was rejected on cost asymmetry: turning the input off removes the only thing
that writes `latest.json`, so the aggregation job would have to build the file
from the uploaded `.sig` assets itself. That is a bespoke script standing in for
a one-line ordering constraint, against this project's minimal-machinery bias.
The price paid is serialized release builds, which nothing else waits on.

**Tag-pinned urls.** `tagName` is passed alongside `releaseId`. This does not
disturb the hand-published draft: the action creates or edits a release only
when `tagName` is set and `releaseId` is not; with `releaseId` present it is
used for the JSON alone.

**No bare Linux target key.** A `finalize-updater-json` job runs after the
matrix and deletes `platforms["linux-x86_64"]` and
`platforms["linux-aarch64"]` before re-uploading. Every Linux form that can
self-update resolves its own installer-qualified key, so no correctly patched
install loses its update path; what is removed is only the fallback, and with it
the possibility of a cross-format overwrite. An install with no entry of its own
now finds nothing and reports no update available.

Deliberately Linux only. `darwin-<arch>` is the documented fallback for the
`-app` key and must stay. The Windows bare key points at the MSI, where both
distributed forms are installers that handle their own upgrade, so the fallback
there is not a cross-format overwrite in the sense above — it is left alone
rather than judged safe on evidence this task gathered.

**The same job asserts the platform set.** A lost update and a build job that
silently produced nothing both present as an absent platform, so
`finalize-updater-json` fails when any of `darwin-aarch64`, `darwin-x86_64`,
`windows-x86_64-nsis`, `windows-x86_64-msi`, `linux-x86_64-appimage`,
`linux-x86_64-deb`, `linux-aarch64-appimage` or `linux-aarch64-deb` is missing,
or when any entry carries an empty signature. Both Linux architectures are in
that set, and TASK-11.1's AC #5 was tightened to name them: the arm64 job is a
fourth writer of the asset, and the bare `linux-aarch64` key this decision
deletes was its only fallback, so an arm64 entry lost here leaves those installs
with nothing to resolve. rpm is deliberately absent — the job prints the full
key set before and after the edit, which is where rpm's answer will be read.

Also settled here, recorded because leaving them implicit invites the same
question again:

- **The updater key is password-protected**, making the CI secret count six plus
  two. tauri-cli substitutes an empty password when the variable is unset, so the
  password secret is not optional.
- **The endpoint names `serendipitynz`**, the owner the git remote points at, and
  the `takkyun` strings in `package.json`, `Cargo.toml` and `tauri.conf.json`
  were corrected in the same change. A rename redirect is tolerable in a homepage
  link and not in a url compiled into shipped binaries, and a config file holding
  both spellings reads as an oversight either way.
- **`tauri-action` is pinned to `action-v0.6.2`**, the newest v0 release, because
  the shape of `latest.json` comes from it. `action-v1.0.0` is not a version bump:
  it renames inputs, and Actions only warns about inputs it does not recognize,
  so a half-migrated config would silently restore the lost update this decision
  removes.
- **The plugin registrations are not `cfg(desktop)`-gated**, matching the four
  `.plugin()` calls already in `lib.rs`. Gating would have been defensible on its
  own; being the only gated pair would not.
- **`scripts/setup-ci-signing-secrets.sh` is left alone.** It takes a `.p12` as a
  required argument, so teaching it the updater key would make rotating that key
  demand the whole certificate. The two `gh secret set` calls are documented
  instead (TASK-11.3).

## Consequences

- An rpm install never receives an in-app update until `linux-x86_64-rpm` is
  confirmed present in a real `latest.json`. It reports no update rather than
  breaking itself, and TASK-11.3 has to say so plainly so an rpm user is not
  left waiting.
- An install whose bundle-type marker patch failed also receives nothing. That is
  the intended outcome, but it means the build log is the only place the patch
  failure is visible, and the release round has to read it.
- `finalize-updater-json` is now a required part of a release: a red job there
  means the draft's `latest.json` still carries its bare Linux keys, so the
  draft must not be published until it is green.
- Serialized builds make a release run take roughly the sum of its jobs rather
  than the slowest. The v0.6.0 round already showed a Linux job stalling for
  tens of minutes on apt (TASK-24), and that stall now blocks the other jobs
  instead of running beside them.
- The client-side half of the Linux decision is untested until an install with
  no matching entry exists. Nothing here was measured against a published
  release; that is what the v0.7.0 round closes.
