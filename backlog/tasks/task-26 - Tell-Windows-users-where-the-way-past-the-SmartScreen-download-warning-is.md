---
id: TASK-26
title: Tell Windows users where the way past the SmartScreen download warning is
status: Done
assignee: []
created_date: '2026-08-26 09:21'
updated_date: '2026-08-27 06:58'
labels:
  - documentation
milestone: m-3
dependencies: []
priority: high
type: docs
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A user on Windows / Edge tried to receive `mallow_0.7.0_x64-setup.exe` from the v0.7.0 release and gave up once. They were not blocked - the way forward is inside the dropdown on the `Delete` button, and nothing on the surface says so.

What was measured (Windows / Edge, v0.7.0, 2026-08-25, in two passes): the download list shows `isn't commonly downloaded`; the confirmation that follows says `Microsoft Defender SmartScreen couldn't verify if this file is safe because it isn't commonly downloaded`, reports `Publisher: Unknown`, and offers exactly two visible buttons, `Cancel` and `Delete` with a dropdown arrow; pressing that arrow reveals `Keep anyway`, which saves the file. Reaching this confirmation from the list's own `Keep` item does not save the file by itself. Chrome received the file (whether it warned was not checked).

The second pass is what separates a cheap fix from an expensive one. After the first pass this read as "Windows' default browser cannot receive the file", which is an argument for code signing. It is in fact one sentence of guidance: "could not proceed" and "the way forward was hidden" are different referents and produce completely different README text.

Only one cause can be named: `Publisher: Unknown` is how an unsigned Windows bundle is displayed, which matches what AGENTS already records ("Windows/Linux bundles are not code-signed"). Whether that is a sufficient condition for the warning is a separate question and is not settled here.

Not measured, and therefore not to be written: whether the `.msi` behaves the same, whether a run-time warning appears, whether the update path warns (that is TASK-11.2's AC #10, and a different event), browsers other than Edge, other Windows versions, and whether code signing removes the warning - SmartScreen judges on reputation, so signing may only change how reputation accumulates across versions rather than clearing the warning outright. Code signing stays a separate decision with no material to decide on yet.

Scope: the install section of README.md and README.ja.md, nothing else. mallow's code is not involved at any point in this event.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and README.ja.md each tell a Windows user what they will see when the browser receives a release asset, and name the control that lets them continue - the dropdown on the Delete button, and Keep anyway inside it - rather than only saying that a warning appears and can be dismissed
- [x] #2 Nothing is claimed that was not measured: the .msi, the run-time warning, the update-path warning, browsers other than Edge, other Windows versions, and whether code signing removes the warning are all absent from the text
- [x] #3 The English and Japanese sections carry the same content, and both stay at the length the rest of the README is written at - a short paragraph, with no reasoning about SmartScreen's reputation model
<!-- AC:END -->
