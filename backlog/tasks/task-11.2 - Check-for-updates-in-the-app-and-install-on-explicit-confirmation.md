---
id: TASK-11.2
title: Check for updates in the app and install on explicit confirmation
status: In Review
assignee: []
created_date: '2026-08-01 23:14'
updated_date: '2026-08-23 04:26'
labels:
  - feature
milestone: m-2
dependencies:
  - TASK-11.1
parent_task_id: TASK-11
priority: high
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The in-app half of TASK-11. Depends on TASK-11.1 - there is nothing to check against until latest.json exists, and TASK-11.1 also adds the two JS packages this consumes.

## Work

- A check on launch, deferred so it never competes with first paint or session restore in App.tsx.
- A manual check in SettingsModal, next to the other preferences, showing the running version beside it. Today the version is only visible in the macOS About dialog (the AboutMetadataBuilder in lib.rs), which leaves Windows and Linux users with no way to confirm an update landed. Reading it needs no new capability - core:default already covers it.
- A preference to turn the automatic check off, persisted through lib/settings (the plugin-store), alongside customEmojiDir and the rest.
- On an available update: show the target version, install only after the user says yes, show download progress, then relaunch.
- New UI strings go into both the ja and en dictionaries in lib/i18n.tsx.

## Relaunch is not symmetric across platforms

macOS and Linux keep running after the install returns, so the app relaunches itself through the process plugin. Windows does not: the plugin hands the installer to the shell and immediately exits the process, with the installer restarting the app. So the promise to await downloadAndInstall and then call relaunch never resumes there. Design the dialog state machine for both - a Windows install ends with the app disappearing, not with a restarting state.

## Release notes are empty today

The notes field in latest.json comes from the releaseBody input of tauri-action, and release.yml passes only releaseId and args, so it is an empty string - the notes the create-release job generates live on the release, not in latest.json. Passing releaseBody is safe and cheap: the action only creates or edits a release when tagName is set without releaseId, so with releaseId present the value is used for the JSON alone and the drafts generated notes are untouched. The alternative is a dialog that falls back to a link to the release page. Either way, do not design the dialog assuming notes is populated.

## Failure is the normal case

Offline, rate-limited, or simply no release yet must be silent on the automatic path and stated plainly on the manual path. A viewer that pops an error box because the network is down is worse than one that never checks.

## Say what the user is about to be asked for

Installing an update is not silent, and an unexplained authentication prompt reads as malware. What actually happens, from the plugin source:

- Windows msi: msiexec under UAC. Windows NSIS: the setup.exe runs in update mode.
- Linux deb and rpm: privilege escalation with three fallbacks, tried in order - pkexec, then a zenity or kdialog password dialog, then sudo on a terminal. The third one is the dangerous case: a GUI-launched app prompts on stdin, which the user sees as a hang. So do not name pkexec in the copy - the plugin decides at runtime and the promise would often be wrong. Say that the system will ask for a password.
- macOS: usually silent, because the .app is moved in place. When that move is denied - a standard user account, or an .app owned by another user - the plugin falls back to AppleScript with administrator privileges, which is an admin password dialog. So it is not unconditionally silent either.

## Do not branch on error variants

A refused prompt must read as a cancelled install, not a broken download, but the plugin gives nothing structured to branch on. Its errors serialize to a bare message string, so no variant name or code reaches JS. And the variants themselves do not line up with the cases: DebInstallFailed is never constructed, AuthenticationFailed is swallowed by the caller before it propagates, a refused Linux sudo surfaces as PackageInstallFailed, a denied macOS move as an IO permission error, and a cancelled Windows UAC as an IO error carrying the OS cancel code. Matching on message text would break the first time upstream rewords one. Treat any failure after the user confirmed as the install not having happened, and say so plainly.

Do NOT assume a SmartScreen warning on the Windows update path. The updater downloads through its own HTTP client into a temp path, so no Mark-of-the-Web is attached, and the NSIS default installMode in Tauri is currentUser. Check the real behaviour on a Windows install before writing any warning copy: a warning about a warning that never appears is worse than saying nothing. (SmartScreen on the first browser download of an unsigned installer is real, but that belongs in the README distribution section, TASK-11.3.)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The app checks for an update shortly after launch without delaying first paint, and the check can be turned off in Settings with the choice persisted through lib/settings
- [x] #2 A manual check in SettingsModal reports all three outcomes - up to date, update available, check failed - and shows the running version
- [x] #3 Nothing is downloaded or installed without an explicit confirmation that shows the target version
- [x] #4 The update dialog is still readable when the notes field in latest.json is empty
- [x] #5 Download progress is visible; macOS and Linux relaunch through the process plugin, and the Windows path does not leave the UI waiting for a relaunch that never comes because the process has already exited
- [x] #6 The confirmation warns that the system may ask for a password or administrator approval, without naming a mechanism the plugin chooses at runtime
- [ ] #7 Refusing the authentication prompt on macOS, Windows and Linux reports a cancelled or failed install rather than a download failure, without matching on upstream error text
- [x] #8 Every new string is added to both the ja and en dictionaries in lib/i18n.tsx
- [x] #9 Launching offline produces no error UI on the automatic path
- [ ] #10 The Windows update path has been run on a real or virtual install and the copy matches what actually happens there
- [x] #11 pnpm build and pnpm test pass
<!-- AC:END -->
