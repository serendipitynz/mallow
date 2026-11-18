---
id: TASK-70
title: >-
  Measure mallow's launch time, memory and render time against comparable
  Markdown viewers on macOS
status: To Do
assignee: []
created_date: '2026-11-18 22:15'
labels:
  - research
dependencies: []
references:
  - scripts/paper
  - src-tauri/src/session.rs
  - src/hooks/useUpdater.ts
  - src/hooks/useFileTree.ts
priority: medium
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
How mallow compares with other lightweight Markdown viewers on launch time, memory and render time has never been measured (requested 2026-11-19). The aim is a comparable set of numbers and a reproducible way to take them again, as the baseline for later performance work — **not** an improvement, a benchmark framework, or a sweep of every platform.

**Apps (settle at the start, by how easily each installs and measures).** At least three, at most four:
- **mallow** — the latest published release, from its signed DMG.
- **Marky** (`GRVYDEV/marky`) — Tauri v2 + React, the nearest in stack.
- **MD Viewer** (`CreateChance/mdviewer`) — a Tauri-based viewer.
- **SkimDown** (`07JP27/SkimDown`), optional — native macOS; added only if it installs easily, and reported as a native app rather than ranked against the WebView ones under one condition.

An app that needs real effort to build or set up may be dropped, with the reason recorded. Editors (Obsidian, VS Code, Typora) are out. A third-party binary is downloaded and installed by the owner, not by an agent, and its Gatekeeper / signing state is recorded.

**Environment.** One macOS machine; release builds where they exist. Record each app's name and version, the CPU, RAM and macOS version, and how background load was kept down. The same files and folders for every app. Five runs per measurement, median reported (min / max where they help); cold launch (first after a reboot or purge) kept apart from warm. Wherever conditions cannot be made equal, say how they differ.

**P1 — required.**
1. **Launch time** — from the launch command to the given small Markdown document being *usable on screen*, not process start. The same route for every app where possible (`open -a <App> <file>`), cold and warm separately.
2. **Memory** — a steady state some fixed time after launch, and with the Large document shown. RSS as the basis, including the WebView's helper processes; on macOS WKWebView's `com.apple.WebKit.WebContent` / Networking / GPU processes are XPC services launched by `launchd`, not children of the app, so how each is attributed to its app is written down, and shared memory is not counted twice (whether `footprint` / phys_footprint is used beside RSS is decided and stated).
3. **Render time** — generated test files: **Small** (README-like, 10–30 KB), **Medium** (headings, tables, code blocks, ~200 KB), **Large** (long prose, tables, many code blocks, ~1 MB), and a Mermaid file separately where the apps support it. Where "render finished" cannot be judged alike across apps, the time is recorded as the user-visible completion (screen recording) and its error stated as large.

**P2 — only if easy.**
4. **Folder load** — ~100 and ~1,000 Markdown files with nested folders: from opening the folder to the list being operable. Each app's scanning model (eager or lazy) recorded beside the number.
5. **File switch** — small and large files in one folder, from the action to the document shown.

**Method.** OS process and memory tools, the least shell script that works, screen recordings and hand timing. A devtools figure is a reference value only. **No number from instrumentation added to mallow alone is compared with an outside measurement of a competitor.** What cannot be measured is written as not measurable or as a reference value, not forced into a number. An unsupported feature is N/A, never a zero. No ranking is claimed without a clear difference, and published figures for competitors are never mixed with these.

**What mallow does that skews a naive measurement** (record the state used):
- **Session restore** — mallow reopens every window open at quit, each a WebView with its own Shiki and mermaid. Launch is measured from a stated session (e.g. a single window), with `settings.json`'s `windows` noted.
- **Launch update check** — reaches the network unless `autoCheckUpdates` is off; record which.
- **Single instance** — a launch while mallow runs is forwarded to the running process, so every launch run starts with mallow fully quit.
- **Lazy loads** — Shiki's WASM and mermaid load on first need, so the first code block or diagram costs more than later ones; the explorer tree is read lazily per folder.

**Deliverables.**
1. Sample data — reproducible documents and folder layouts, from a generator script (`scripts/bench/`) rather than committed bulk files.
2. Procedure — a backlog doc: environment, preparation and steps, short enough to repeat.
3. Report — a backlog doc: a table per measurement and app (median, and min / max where useful), conditions and limits, and what the numbers say about mallow's strengths and weak spots. Raw recordings and logs stay in `_sandbox/` (git-ignored).
4. Improvement candidates — only where a clear weakness shows; each proposed as its own task, none implemented here.

**Out of scope.** A benchmark framework; CI integration; other OSes; an exhaustive set of competitors; detailed CPU / GPU profiling; power and battery; any performance fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 At least three apps including mallow are chosen, with each excluded candidate's reason recorded
- [ ] #2 The environment (apps and versions, CPU, RAM, macOS version, background load, mallow's session and update-check state) is recorded, and every difference in conditions between apps is stated
- [ ] #3 Small, Medium, Large and Mermaid test documents and the P2 folder layouts are reproducible from a generator script
- [ ] #4 Launch time (cold and warm), memory (steady state and with the Large document) and render time are measured on one machine with the same data, five runs each, medians reported
- [ ] #5 The memory method says which processes count toward each app and how shared memory is kept from being counted twice
- [ ] #6 No figure from instrumentation added to mallow alone is compared with an outside measurement, and unsupported features are N/A rather than zero
- [ ] #7 The procedure and the report are written as backlog docs, the report covering mallow's strengths and weak spots
- [ ] #8 Improvement candidates are listed only for a clear weakness, each proposed as a separate task
<!-- AC:END -->
