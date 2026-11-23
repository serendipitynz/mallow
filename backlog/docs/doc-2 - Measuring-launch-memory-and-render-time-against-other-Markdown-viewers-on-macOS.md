---
id: doc-2
title: >-
  Measuring launch, memory and render time against other Markdown viewers on
  macOS
type: guide
created_date: '2026-11-23 04:27'
---

The procedure TASK-70 used, written to be repeated. The numbers it produced are
in doc-3. Everything here is an outside measurement — the screen and the OS's
process tables — so it applies to mallow and to every other app alike; no figure
mallow reports about itself is part of it.

## Terms

- **launch** — `open -a <App> --args <path>`, the app fully quit beforehand.
  **The args route** (the path as argv) is the one every app measured supports;
  the open-event route (`open -a <App> <path>`, what Finder's double-click
  sends) is ignored by Marky and SkimDown, which then show their empty window.
- **first paint** — from the launch command to the first frame in which the
  app's window area differs from the frame before the launch.
- **complete** — from the launch command to the last frame in which the window
  area changed, within a 12 s observation. A run whose last change falls in the
  final second is **unsettled** and its complete is a floor, not a value.
- **render time** — complete for the Medium, Large and Mermaid documents, read
  beside Small's. It covers what is on screen, so for a long document it is the
  first screenful, which is what the reader waits for.
- **warm / cold** — warm is a launch with the app's files in the page cache;
  cold is a launch right after `sudo purge`. Neither is a first launch after
  install, which Gatekeeper and first-run work make slower; that one is
  discarded.
- **footprint** — the sum of phys_footprint over the attributed processes, read
  by `footprint` 20 s after the launch. **RSS sum** is `ps` RSS over the same
  processes.
- **attributed processes** — the app's own process and every process macOS holds
  it responsible for. WKWebView's `com.apple.WebKit.WebContent`, `.Networking`
  and `.GPU` are XPC services launchd starts, so their parent pid is launchd and
  says nothing; their *responsible* pid is the app (the grouping Activity
  Monitor uses), read with `responsibility_get_pid_responsible_for_pid`.

## Why footprint and not RSS for the comparison

RSS counts every resident page a process maps, shared ones included, so summed
over an app and its WebKit processes it counts the dyld shared cache and the
WebKit frameworks once per process. phys_footprint is the kernel's per-task
ledger: private dirty and compressed memory, plus IOSurfaces and other memory
charged to exactly one owner, so a sum over processes counts each page once.
The RSS sum is recorded beside it as a reference and is not compared.

## Tools

All in `scripts/bench/`:

- `gen-data.mjs` — writes the test data, seeded, to `_sandbox/bench/data`:
  Small (≈23 KiB, README-like), Medium (≈200 KiB, headings, tables, code
  blocks), Large (≈1 MiB, long prose, 206 tables, 378 code blocks), Mermaid
  (five diagrams), each alone in its own folder; `tree-100` (104 files in 13
  folders) and `tree-1000` (989 files in 43 folders); and `switch/` (Small and
  Large side by side).
- `launchwatch.swift` — `watch` launches the app under a ScreenCaptureKit stream
  that leaves out every app running at the start, so only the launched app's
  windows are ever captured; it compares 4×4-pixel block sums of the window's
  area frame by frame at 60 fps (half a point per pixel) and prints first paint,
  complete and the window it measured, plus a PNG of the final frame. `procs`
  prints the attributed pids.
- `run.mjs` — `measure` quits the app, resets its saved state, launches it under
  launchwatch, waits until 20 s after the launch and reads the memory; runs are
  interleaved (run 1 of every app and target, then run 2 …). `summary` prints the
  median (min–max) per app, target and start.

## Preparation

1. Install the apps in `/Applications`. A third-party binary is downloaded and
   installed by the owner. Ad-hoc-signed apps are refused by Gatekeeper as
   "damaged" until the owner removes the quarantine attribute
   (`xattr -dr com.apple.quarantine /Applications/<App>.app`); record that.
2. Grant Screen Recording to the process that runs the scripts (the terminal, or
   the agent's host app).
3. `node scripts/bench/gen-data.mjs`, then
   `swiftc -O scripts/bench/launchwatch.swift -o _sandbox/bench/launchwatch`.
4. Launch every app once and throw the result away — the first launch after
   install pays for Gatekeeper's assessment (Marky's took 10 s to its first
   pixel).
5. Quit video playback and any app doing work, keep the machine on power, and
   leave the mouse and keyboard alone for the session: the launched windows come
   to the front.

### State each app keeps, and what `run.mjs` resets before every run

| App | Kept between launches | Reset to |
| --- | --- | --- |
| mallow | `settings.json`: the windows open at quit (restored at launch), and `autoCheckUpdates` | the owner's file, with `windows: []` and `autoCheckUpdates: false`; the original is kept in `_sandbox/bench/mallow-settings.backup.json` and put back at the end (`run.mjs restore-mallow` does it by hand) |
| Marky | `~/Library/Application Support/marky/settings.json`: every folder it was handed, reopened at launch | deleted |
| SkimDown | the file last selected per folder (`lastSelectedMarkdownByFolder`) | deleted |
| MD Viewer | nothing found | — |

mallow is single-instance — a launch while it runs is forwarded to the running
process — which is one more reason every run starts with the app quit.

## Steps

```sh
# warm: every app and target, five runs, on the args route
node scripts/bench/run.mjs measure --apps mallow,marky,mdviewer,skimdown \
  --targets small,medium,large,mermaid,tree-100,tree-1000 --route args --runs 5 \
  --out _sandbox/bench/results/warm-args.jsonl

# cold: Small only, run by a person (sudo purge before each launch)
node scripts/bench/run.mjs measure --apps mallow,marky,mdviewer,skimdown \
  --targets small --route args --runs 5 --cold \
  --out _sandbox/bench/results/cold-args.jsonl

node scripts/bench/run.mjs summary _sandbox/bench/results/*.jsonl
```

A warm session of 24 combinations × 5 runs takes about 50 minutes. Check the
PNGs under `_sandbox/bench/results/png/` for any run whose numbers stand out: a
window showing the app's empty or welcome state means the app did not take the
path, and that cell is N/A, not a time.

## Limits that hold for every run

- **The window sizes differ** — each app opens at its own default size, so each
  renders a different amount of the document. launchwatch records the window it
  measured.
- **Complete is the last change, not the first usable frame.** A late change
  anywhere in the window — a highlight arriving, a title updating, a sidebar
  filling — moves it. The frames per change can be written with
  `launchwatch watch … --frames-dir <dir>` to see what the change was; that
  costs a full image per frame, so it is for looking, not for timing.
- **The capture itself runs during the launch**: one stream at 60 fps and a block
  sum per changed frame, the same for every app.
- **Timing resolution** is one frame, 16.7 ms.
- File switch (P2) is not measured: it needs a click inside each app, and this
  procedure drives nothing inside an app.
