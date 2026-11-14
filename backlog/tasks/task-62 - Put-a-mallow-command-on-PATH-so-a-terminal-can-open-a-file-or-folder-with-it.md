---
id: TASK-62
title: Put a mallow command on PATH so a terminal can open a file or folder with it
status: To Do
assignee: []
created_date: '2026-11-14 00:42'
updated_date: '2026-11-14 00:43'
labels:
  - feature
dependencies: []
references:
  - src-tauri/src/handover.rs
  - README.md
  - backlog/tasks/task-38 - Open-a-file-or-folder-the-OS-hands-to-mallow.md
priority: low
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow already takes a path as an argument (TASK-38, decision-16): `handover.rs` resolves argv in the first process, and a second launch forwards its argv to the running one through tauri-plugin-single-instance and exits. What is missing is **a `mallow` command a terminal can find**. README's "Command line: `mallow path/to/file.md`" holds only where the binary is on `PATH`:
- **macOS**: the binary sits inside the bundle (`/Applications/mallow.app/Contents/MacOS/mallow`), which is not on `PATH`; today a reader types that path in full or uses `open -a mallow file.md`, which goes through `RunEvent::Opened` rather than argv.
- **Windows**: neither the NSIS nor the MSI installer adds the install directory to `PATH`.
- **Linux**: the deb and rpm are expected to install `/usr/bin/mallow`, which would already work; an AppImage is not on `PATH`. Unverified — the first thing to check.

To settle at the start:
- **How the command is installed per platform.** macOS: a menu entry that links a shim into `/usr/local/bin` (VS Code's "Install 'code' command in PATH"; needs elevation where that directory is root-owned, and `/opt/homebrew/bin` is the Apple silicon alternative), or a documented `ln -s` only. Windows: the installer adding a directory to the user `PATH`, or a documented step. Whether a shim is a script or a link matters on macOS: launching the inner binary directly by a symlink and launching the bundle are not the same process from LaunchServices' side, so what the shim runs is part of the decision.
- **What the command does beyond opening a path**: `--help` / `--version` printed to the terminal and returning, rather than starting the GUI; whether a launch from a terminal returns at once (as the forwarded second launch already does) or stays attached. On Windows a GUI-subsystem binary has no console to print to, so `--help` output needs an answer there.
- **`mallow .` opens the current directory, and that is a requirement on the shim rather than new resolution.** `resolve` already folds `.` into the working directory it is given — the process's own on a first launch, the caller's as forwarded by tauri-plugin-single-instance on a second — so `.` works exactly as far as the shim keeps the terminal's working directory. A macOS shim that runs `open -a mallow --args .` does not: the app LaunchServices starts has `/` as its working directory, so `.` would open the root. Running the inner binary directly keeps it.
- **Relative paths and the working directory**: the forwarded argv arrives in the running process, whose working directory is not the terminal's. TASK-38 measured the macOS forward; whether every platform resolves a relative argument against the caller's directory is checked rather than assumed.
- Whether README's Command line line is corrected now to say what works today on each platform, independently of the rest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 How the command is installed on each platform, and what it runs, are settled and written in the task
- [ ] #2 From a fresh terminal on macOS, Windows and Linux, 'mallow <file>' and 'mallow <folder>' open in mallow, whether or not it is running
- [ ] #3 A relative path is resolved against the terminal's working directory on all three platforms, including when it is forwarded to a running mallow
- [ ] #4 --help and --version behave as settled, and README's Command line section says what works on each platform
- [ ] #5 'mallow .' opens the terminal's current directory as a folder on all three platforms, both when mallow is not running and when it is
<!-- AC:END -->
