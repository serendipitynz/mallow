---
id: TASK-11.3
title: Document the update channel and the signing-key runbook
status: Done
assignee: []
created_date: '2026-08-01 23:14'
updated_date: '2026-08-24 22:25'
labels:
  - documentation
milestone: m-2
dependencies:
  - TASK-11.1
  - TASK-11.2
parent_task_id: TASK-11
priority: medium
type: docs
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The operational half of TASK-11. Two audiences, two documents.

Note on timing: the release-note half of AC#2 can only be closed when the first updater-carrying release is cut, so this task stays open past the README work. That is the same reason the parent DoD waits for two releases.

## Users - README.md and README.ja.md

Neither README has an install or download section, nor any mention of Releases, so this means adding one and choosing where it goes - not inserting a paragraph.

- mallow updates itself from GitHub Releases, and the check can be turned off in Settings.
- Which distributed forms self-update: the macOS .app, the Windows setup.exe and .msi, and the Linux AppImage, deb and rpm. Whether rpm belonged in that list was decided by TASK-11.1 against the real v0.7.0 latest.json, which carried it - write what was observed, not what was hoped, and say plainly which forms are download-only so an rpm user is not left waiting for an update that never comes.
- One-time exception, and the reason the promise needs a caveat: anyone on a release older than the first updater-carrying one has a binary with no updater in it, so nothing will reach them. They download once by hand and are then on the channel. Put the same sentence in that release note.
- What the update will ask for: UAC on the Windows msi, a system password prompt on deb and rpm, and on macOS a password only when the .app is not writable by the user. Describe the prompt, not the mechanism - the Linux path picks between pkexec, a GUI dialog and terminal sudo at runtime.
- Windows SmartScreen belongs here, in the distribution context - it appears on the first browser download of the unsigned installer, and per TASK-11.2 it is not expected on the in-app update path. Only state what was actually observed.

## Maintainer - AGENTS.md and AGENTS.ja.md, releasing section

- Publishing the draft release is what starts a rollout; until then the tag exists but no installed copy sees it, because GitHub resolves releases/latest against published non-prerelease releases only.
- The updater key is minisign and has nothing to do with the Developer ID certificate. Record the resulting CI secret count as TASK-11.1 decided it: six plus one for a password-less key, six plus two for a password-protected one.
- Once the public key is committed, a plain build without the private key fails, so .env.signing is now part of local bundling and not only of signed releases. State the escape hatch in the same breath: tauri build --no-sign skips updater signing and lets a contributor without the key build, but it skips code signing too, so it is not a release path. Note also that .env.signing is only read by scripts/macos-sign-build.sh, so on Windows and Linux the variables have to be exported by hand.
- Whichever concurrency fix TASK-11.1 chose for latest.json, record why, so a later change does not restore the parallel matrix and quietly break a platform. Same for whether the download urls inside latest.json were tag-pinned.
- Note that tauri-action is pinned and that moving to action-v1 is a migration, not a bump: the input names changed and so did the url form written into latest.json.
- The runbook that matters: where the private key lives, and that losing OR rotating it strands every installed copy, since a client only trusts the public key compiled into the build it is already running. Recovery is a manual reinstall by every user - so this is a backup problem, not an incident-response one.

Keep the two language versions of each document in step; they are parallel files, not translations that may drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and README.ja.md gain an install and update section covering self-update, the coverage of every distributed form, and how to turn the automatic check off
- [x] #2 Both READMEs and the first updater-carrying release note say that users on earlier versions must update once by hand
- [x] #3 AGENTS.md and AGENTS.ja.md name publishing the draft as the rollout trigger, list the new CI secrets, and state both that a plain build without the private key fails and that --no-sign is the contributor escape hatch that must not be used for releases
- [x] #4 The chosen latest.json concurrency fix and the tauri-action pin are recorded with their reasons
- [x] #5 The key runbook states where the private key is kept and that losing or rotating it forces every user to reinstall
- [x] #6 The prompts users will meet are described without naming a mechanism the plugin chooses at runtime, and no warning is documented that was not actually observed
- [x] #7 The ja and en versions of each document have the same sections and make the same statements - self-update coverage per install form, the one-time manual update, the prompts to expect, and for AGENTS the rollout trigger, the secret list and the key runbook
<!-- AC:END -->

## Comments

Recorded on the task rather than only in the handoff notes, because the handoff is
rewritten per milestone and these outlive that.

**AC #2 is checked on the README half only, and stays unchecked until the release
round.** Both READMEs now carry the sentence, but the release note half needs a
published note to be written into: v0.7.0's draft notes are generated from PR
labels, so the one-time-manual-update sentence is added by hand in the release
session. AGENTS (both languages) now says that in the release workflow section, so
the requirement does not live only in the handoff.

**rpm was documented as download-only, the release round measured it, and the
answer went the other way.** decision-11 left `linux-x86_64-rpm` deliberately
outside the platform set that `finalize-updater-json` asserts, because upstream
support is inconsistent and the answer is not knowable before a real
`latest.json`. Both READMEs therefore stated plainly that the `.rpm` was
download-only rather than hedging, since a hedge is what leaves an rpm user
waiting — scoped to 0.7.0, because that is the release whose `latest.json` can be
read before publishing. The v0.7.0 round read it (TASK-11.1 AC #6): both
`linux-x86_64-rpm` and `linux-aarch64-rpm` were there, signed and tag-pinned. So
that claim was wrong, and both READMEs were corrected in that session, rpm joined
the required key set, and decision-11 gained a second addendum. **Writing it
plainly rather than hedging is what made the correction a one-line edit** — a
hedge would have been defensible after the fact and would have told the reader
nothing either way.

**What the measurement covers.** A client resolves an rpm target key. That
installing the `.rpm` succeeds on a real rpm system is not covered, and is not
covered for deb, AppImage, msi or nsis either — which is why README puts rpm on
the same row as the rest rather than on a stronger claim.

**An install with no matching key sees an error, not reassurance** — corrected in
review, and decision-11 carries an addendum for the same statement. This no longer
describes rpm (above), but it still describes any install whose bundle-type marker
patch failed, which is the case decision-11 kept the bare-key deletion for.
`check()` in
tauri-plugin-updater 2.10.1 resolves the target through `get_urls` before it
compares versions, so a missing key raises `TargetsNotFound` rather than yielding
the no-update outcome; at the JS boundary that is indistinguishable from a network
failure. A manual check therefore reports "Could not check for updates" and the
launch check reports nothing.

**`latest.json`'s `notes` stays empty (decided 2026-08-25).** `releaseBody` is not
passed to `tauri-action`. Filling it would route multi-line generated markdown
through a job output, which cannot be verified before a real release round, and it
leans on the same reading of `tagName` / `releaseId` that keeps the hand-published
draft's generated notes intact — so a mistake there costs the only release
description users read. The dialog was built to read without notes (TASK-11.2's
AC #4), and the reasoning is now in AGENTS (both languages) so a later round does
not re-open it as an oversight.

**The exclusion of source-built copies was wrong and is gone.** A copy built from
source carries the same endpoint and public key and the same updater client, and
nothing checks where the running binary came from — so it does check, and it can
install an official update. The handoff's third break case (`--no-sign`) is about
producing artifacts, not about receiving them; reading it as the latter is what
put the sentence there.

**The user cut the README section down, and two of the description's bullets went
with it.** The prompts are one line naming no mechanism and no platform, and there
is no signing subsection — so SmartScreen is not documented at all, where the
description had placed it in the distribution context. AC #6 still holds by the
stricter reading (nothing unobserved is claimed, and the per-platform prompt
detail that carried the unmeasured parts is gone); AC #1's three requirements are
each still stated. The maintainer half in AGENTS is untouched, so nothing was lost
from the runbook.
