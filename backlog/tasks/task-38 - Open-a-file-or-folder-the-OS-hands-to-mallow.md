---
id: TASK-38
title: Open a file or folder the OS hands to mallow
status: In Review
assignee: []
created_date: '2026-09-16 00:39'
updated_date: '2026-10-01 10:44'
labels:
  - feature
milestone: m-4
dependencies: []
priority: high
type: feature
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow can only be given a location from inside itself — the folder picker, Open
Recent, or a restored session. A file or folder handed to it by the OS (a
double-click on an associated file, "Open With", a path on the command line, a
drag onto the window) does nothing.

**There is no single "hand it over" mechanism; there are three, and they are
structurally different.** They are named separately throughout this task on
purpose — collapsing them into one word is what would hide that one of them
exists on one platform only.

| route | how the path arrives | where it exists |
|---|---|---|
| a command-line argument | `std::env::args()` at startup | Windows and Linux (file associations, and a CLI invocation); **not how macOS delivers a Finder double-click** |
| `RunEvent::Opened { urls }` | an event on the running app | **macOS only** — tauri 2.11.3 gates it `cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))` (`app.rs:257-266`) |
| a drag onto the window | a webview drag-drop event | all three, and independent of any OS registration |

## The decision this cannot start without

**What happens when mallow is already running.** On macOS the `Opened` event
reaches the running app. On Windows and Linux an association starts **a second
process**, and a second process sits outside the single lock this app's state
rests on:

- `recent.rs` owns `recentFolders` in Rust **because a read-modify-write from
  two windows loses entries**, with `RecentLock` covering the decision between
  the store's own locks. Two processes do not share it.
- `session.rs` owns the restored session for the same reason, one mutex over the
  live set and the store write.
- `settings.rs` holds **one high-water mark for the process**, and that is what
  makes windows converge on a preference. A second process has its own.

So a second process is not a heavier second window; it is the case all three of
those were written to exclude. Whether to forward to the running instance, to
accept a second one, or to register no association at all is the first thing to
settle.

**Whether mallow claims a file type at all is the user's call, not this task's.**
`bundle.fileAssociations` registers the app with the OS as a handler, which
changes the reader's machine rather than this app. Claiming `.md` from whatever
editor currently owns it is not something anyone should get by installing a
viewer.

## What it reuses rather than reinvents

`openLocation` is the one sequence the picker and a created or restored window
already take, and `take_window_init` / `WindowInitRegistry` is how a location
reaches a window at mount. A handed-over location is a third caller of that, not
a fourth path — the tree, the `allow_media_dir` grant and the watch all hang off
it, and a path that skips it opens a window that cannot render its images or
notice its edits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three routes are settled before implementation and each is named separately, because they are structurally different: a command-line argument (Windows and Linux file associations, and a CLI invocation), RunEvent::Opened (macOS only — tauri 2.11.3 app.rs:257-266 gates it on cfg(any(macos, ios, android))), and a drag onto the window
- [x] #2 What happens when the app is already running is decided and written down: on Windows and Linux an association opens a second process, which sits outside the single lock that recent.rs and session.rs hold — settings.json, recentFolders and the restored session are all written on the assumption of one process
- [x] #3 Whether mallow registers itself as a handler for any extension is decided by the user, not assumed: bundle.fileAssociations claims the type system-wide, and claiming .md from a reader's editor is a change to their machine rather than to this app
- [x] #4 A handed-over location goes through openLocation and the WindowInitRegistry like every other one — it is a third caller of the one sequence the picker and a restored window already take, not a fourth path of its own
- [x] #5 A handed-over file gets its folder's asset-protocol grant (allow_media_dir) and its watch, or media in it will not render and edits to it will not reload
- [x] #6 A path that does not exist, is not a kind mallow opens, or is a folder where a file was expected, is reported rather than opening an empty window with no explanation
- [x] #7 Each route is exercised on the platform it exists on; a route measured on one platform is not evidence for another, and any route not measured is recorded as not measured
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Measured 2026-10-01 (PR #77, HEAD `eb76f2b`), owner's machines.** Each route was exercised on the platform it exists on; nothing below is evidence for a platform it was not run on.

- **Windows, (a) command-line argument** (`pnpm tauri dev` running, then `src-tauri\target\debug\mallow.exe` as the second launch): a `.md` in another folder opened in a new window with the file selected, and `tasklist` listed **one** `mallow.exe` with two windows, so the second launch was forwarded and exited. A second file in the same folder switched the existing window rather than opening a third. A relative argument resolved against the launching directory.
- **macOS, (b) `RunEvent::Opened`** (debug `.app` bundle, running): Finder's Open With lists mallow **without** the default mark, and choosing it opened the file's folder with the file selected.
- **Linux, (a) command-line argument** (`pnpm tauri dev` running, then `src-tauri/target/debug/mallow <file>`): the running window opened the file's folder, the command returned at once, and `pgrep -c mallow` was 1.
- **(c) drop, all three**: a `.md` from another folder replaced the window's folder with the file selected. On Windows a dropped `.docx` was reported in the notice and not opened (AC #6).

**Not measured**: the Linux association itself (the deb's `.desktop` `Exec ... %F` and `MimeType=text/markdown`, whether mallow appears under the file manager's Open With, and whether a desktop environment then makes it the default); the Windows installer registering nothing, and a second launch from the Start menu; a handed location reaching mallow when it is not running, on all three; the CLI route on macOS; a Linux session with no DBus session bus. Steps for the rest: `_sandbox/handoff/task-38/measure.md`.
<!-- SECTION:NOTES:END -->
