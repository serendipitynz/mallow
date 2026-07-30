---
id: TASK-10
title: Return a typed read error from read_file
status: To Do
assignee: []
created_date: '2026-07-30 10:27'
updated_date: '2026-07-30 10:46'
labels:
  - feature
dependencies: []
priority: high
ordinal: 500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prerequisite for the encoding messages TASK-3 and TASK-4 promise.

commands.rs:90-96 is fs::read_to_string, so the only thing that reaches the frontend on a non-UTF-8 file is the string '<path>: stream did not contain valid UTF-8', which Viewer.tsx:86-95 prints raw. Two consequences the plan depended on but could not deliver:

- The frontend cannot see file bytes, so it cannot detect the bplist00 magic TASK-4 needs, or tell a CP932 CSV from a binary plist - both surface the same io::Error text.
- Matching on that text is the only alternative, which is brittle across Rust versions and cannot distinguish causes.

Change read_file to read bytes, strip a UTF-8 BOM, then String::from_utf8, and return a typed error the frontend can branch on: at minimum an invalid-UTF-8 variant and a binary-file variant recognised from leading magic bytes (bplist00 to start). Keep the 10 MiB cap where it is. Doing the BOM strip here means CSV headers and XML declarations do not each need their own.

Decide the error shape once - a serialisable enum or a code plus message - since Viewer, ConfigView and the new views all render it. See decision-2 on encoding scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A non-UTF-8 file produces an error the frontend can branch on, not a raw io::Error string
- [ ] #2 A binary plist is reported as a binary file rather than as a decoding failure
- [ ] #3 A UTF-8 BOM is stripped once in read_file, and no parser has to strip it again
- [ ] #4 The 10 MiB cap still applies and its message is unchanged
- [ ] #5 commands.rs unit tests cover the BOM, an invalid-UTF-8 file and a binary-magic file
- [ ] #6 cargo check, cargo test, pnpm build and pnpm test all pass
- [ ] #7 The existing not-found, permission and too-large errors still reach the UI as the same readable messages in Viewer and ConfigView
- [ ] #8 The readFile wrapper in lib/tauri.ts has its return and reject types updated, and the read-failure path in custom-emoji.ts still behaves
<!-- AC:END -->
