---
id: TASK-11.3
title: Document the update channel and the signing-key runbook
status: To Do
assignee: []
created_date: '2026-08-01 23:14'
updated_date: '2026-08-02 00:04'
labels:
  - documentation
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
- Every distributed form self-updates: the macOS .app, the Windows setup.exe and .msi, and the Linux AppImage, deb and rpm.
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
- [ ] #1 README.md and README.ja.md gain an install and update section covering self-update, the coverage of every distributed form, and how to turn the automatic check off
- [ ] #2 Both READMEs and the first updater-carrying release note say that users on earlier versions must update once by hand
- [ ] #3 AGENTS.md and AGENTS.ja.md name publishing the draft as the rollout trigger, list the new CI secrets, and state both that a plain build without the private key fails and that --no-sign is the contributor escape hatch that must not be used for releases
- [ ] #4 The chosen latest.json concurrency fix and the tauri-action pin are recorded with their reasons
- [ ] #5 The key runbook states where the private key is kept and that losing or rotating it forces every user to reinstall
- [ ] #6 The prompts users will meet are described without naming a mechanism the plugin chooses at runtime, and no warning is documented that was not actually observed
- [ ] #7 The ja and en versions of both documents carry the same content
<!-- AC:END -->
