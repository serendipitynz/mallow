---
id: TASK-64
title: Submit mallow to the Microsoft Store
status: To Do
assignee: []
created_date: '2026-11-17 19:38'
labels:
  - feature
dependencies:
  - TASK-58
references:
  - >-
    backlog/tasks/task-58 -
    Build-a-prototype-MSIX-of-mallow-for-the-Microsoft-Store-and-measure-it-on-Windows.md
  - scripts/msix-build.ps1
  - src-tauri/windows/msix/AppxManifest.xml
  - >-
    https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/create-app-submission
  - 'https://v2.tauri.app/distribute/microsoft-store/'
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-58 built a prototype MSIX of mallow's Store variant and measured it on Windows, under a placeholder identity (`mallow.prototype`, `CN=mallow-prototype`) and a self-signed certificate. Submitting it was out of scope there. This task takes mallow from that prototype to a listing in the Microsoft Store, so that a Windows reader can install it with no SmartScreen warning and receive updates through the Store.

**The release workflow builds no MSIX.** `release.yml` produces the NSIS and MSI bundles only, so the package for a given release is built by hand on a Windows machine with `scripts/msix-build.ps1`, from that release's tag. v0.15.0 is the first candidate.

**The identity comes from Partner Center, and reserving it is the owner's.** Reserving the app name issues the `Package/Identity/Name`, the `Publisher` (`CN=…`) and the `PublisherDisplayName` the Store will accept; the script takes them as `-IdentityName`, `-Publisher` and `-PublisherDisplayName`. Where those values live afterwards (the script's defaults, or arguments given each time) is to be decided. The Store re-signs the package it accepts, so a code-signing certificate of mallow's own is not expected to be needed; that is read from third-party guides rather than from Microsoft's documentation, and is checked on the first upload.

**The submission carries what the package does not**: pricing and availability, category, a privacy policy URL, the IARC age-rating questionnaire, the store listing (description and at least one screenshot), and a justification for `runFullTrust`. That restricted capability cannot be dropped, because mallow is a Win32 app in a package. Reports exist of individual accounts being refused submissions that use it, and of a submission staying Incomplete after the justification was given, with Partner Center support as the only way forward; this task records what happens to mallow's.

**What TASK-58 left unmeasured, and has to be settled before a reader meets it:**
- The Store build and the GitHub build share the identifier `net.serenebach.mallow`, so they share settings (measured) and possibly the single-instance check (not measured). Whether a reader with both installed gets one forwarded to the other is the question.
- TASK-63's fix (the menu acting on the window in front from launch) has not been tried inside a package.
- Launching from the package's Start menu entry, and whether uninstalling the package removes its `LocalCache` data.

Out of scope: building the MSIX in CI (a separate task once the Store route is settled), the `mallow` command inside the package (`uap5:AppExecutionAlias`), ARM64 Windows, and code signing of the NSIS / MSI bundles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app name is reserved in Partner Center, the identity it issued (Name, Publisher, PublisherDisplayName) is recorded in the task, and where those values live in the repository is decided
- [ ] #2 Inside an MSIX built with that identity, TASK-63's fix, a launch from the Start menu entry, both builds installed side by side (single-instance forwarding and settings) and what an uninstall leaves behind are measured and recorded
- [ ] #3 A package built from a release tag passes the Windows App Certification Kit, and the steps that built and checked it are recorded
- [ ] #4 The submission's listing, category, privacy policy URL, age rating and runFullTrust justification are written, and their text is recorded in the task
- [ ] #5 The submission passes certification and mallow installs from the Microsoft Store, or the refusal and its stated reason are recorded
- [ ] #6 README tells Windows readers about the Store route and how it differs from the GitHub bundles: updates through the Store, no mallow command, and where settings live
<!-- AC:END -->
