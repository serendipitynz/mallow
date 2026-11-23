---
id: doc-3
title: >-
  Launch, memory and render time of mallow and three Markdown viewers on macOS
  (TASK-70)
type: other
created_date: '2026-11-23 06:07'
---

Measured 2026-11-23 with doc-2's procedure; the terms (first paint, complete,
footprint, attributed processes, warm / cold, args route) are defined there.
Every figure is a median, with min–max in brackets, over the runs counted in
`n`. Raw records, logs and the final frame of every run are in
`_sandbox/bench/results/` (not tracked).

## Apps

| App | Version | Stack | Signing | Note |
| --- | --- | --- | --- | --- |
| mallow | 0.15.0 (latest release, signed DMG) | Tauri v2, React, markdown-it, Shiki, mermaid | Developer ID, notarized | |
| Marky (`GRVYDEV/marky`) | 0.1.3 | Tauri v2, React, markdown-it, Shiki, mermaid | ad-hoc, not notarized | nearest in stack |
| MD Viewer (`CreateChance/mdviewer`) | 0.1.9 (pre-release; no full release exists) | Tauri, React, highlight.js, mermaid | ad-hoc, not notarized | |
| SkimDown (`07JP27/SkimDown`) | 0.16.0 | Swift 6 + AppKit, WKWebView for the preview | ad-hoc, not notarized | a native shell; reported, not ranked against the Tauri apps |

No candidate was dropped. All three third-party apps were refused by Gatekeeper
as "damaged and can't be opened" until the owner removed the quarantine
attribute (`xattr -dr com.apple.quarantine`). Editors were out of scope by the
task's definition.

## Environment and conditions

- **Machine**: MacBook Air, Apple M2 (8 cores), 24 GB, macOS 26.7.3 (25G342),
  on AC power and fully charged. The windows opened on the main display, a 5K
  external monitor at 2× (2560 × 1440 points).
- **Background load**: video playback and other working apps were quit and the
  machine left alone during the runs. Still running: the Claude desktop app
  driving the warm session, Microsoft Defender's real-time scanning, and at the
  start of the warm session Spotlight indexing the freshly generated data
  (`mds` 27 %) and `duetexpertd` (92 % in one sample). The warm session ran
  17:27–18:15 NZDT from the Claude desktop app; the cold sessions ran from the
  owner's terminal.
- **mallow's state**: `settings.json` with `windows: []` (no session to
  restore; one window opens on the handed path) and `autoCheckUpdates: false`
  (no network at launch), put in place before every run; the owner's own file
  was restored afterwards. Single instance: every run starts with mallow quit.
- **The other apps' state**: Marky's `settings.json` (folders it was handed)
  deleted and SkimDown's last-selected-file record deleted before every run;
  MD Viewer keeps nothing that was found.
- **Route**: every app launched with `open -a <App> --args <path>`. Marky and
  SkimDown ignore a path handed by the open event (what Finder sends), so the
  argv route is the only common one. For mallow the open-event route was
  measured too: Small 1,065 ms (1,056–1,102) and Large 3,463 ms against 946 and
  3,436 on argv, so the two routes differ by about 0.1 s.
- **Differences that could not be made equal**:
  - Each app opens at its own default window size — mallow 1071 × 730 points,
    Marky 1200 × 800, MD Viewer 1100 × 750, SkimDown 960 × 660 — so each
    renders a different amount of a long document before it is complete.
  - What the window shows differs: mallow, Marky and MD Viewer show a file or
    folder sidebar beside the document, MD Viewer and SkimDown a table of
    contents, Marky a "Welcome" tab beside the opened file.
  - Code highlighting differs: Shiki in mallow and Marky, highlight.js in
    MD Viewer, SkimDown's own bundle.
  - Every launch is a fresh process, so mallow pays its lazy loads (Shiki's
    WASM and grammars on the first code block, mermaid on the first diagram)
    on every run; so does every other app for whatever it loads lazily.

## Launch — Small document

| App | Start | n | First paint ms | Complete ms |
| --- | --- | --- | --- | --- |
| mallow | warm | 5 | 433 (426–650) | 946 (917–1,175) |
| Marky | warm | 5 (1 unsettled) | 408 (353–467) | 812 (692–12,305) |
| MD Viewer | warm | 5 | 412 (366–446) | 928 (883–1,004) |
| SkimDown | warm | 5 | 473 (454–583) | 765 (746–866) |
| mallow | cold | 9 | 1,045 (993–1,147) | 1,691 (1,668–7,789) |
| Marky | cold | 9 | 904 (847–964) | 1,472 (1,430–1,579) |
| MD Viewer | cold | 9 | 913 (895–949) | 1,729 (1,671–1,807) |
| SkimDown | cold | 10 | 1,075 (1,037–1,323) | 1,484 (1,442–4,240) |

Cold ran nine or ten times per app rather than five: the first cold round of
three apps failed before Screen Recording was granted to the terminal, and the
session was then run again in full. All valid runs are counted. The Marky run
at 12,305 ms is unsettled (its window still changed at the end of the 12 s
observation) and the 7,789 ms and 4,240 ms cold runs are single outliers; the
medians are what is compared.

## Render time

Complete on a warm launch with the document as the argument. Small's row above
is the baseline the others are read against.

| App | Medium (≈200 KiB) ms | Large (≈1 MiB) ms | Mermaid (5 diagrams) ms |
| --- | --- | --- | --- |
| mallow | 1,576 (1,529–1,617) | 3,436 (3,392–3,513) | 965 (938–1,043) |
| Marky | 1,304 (1,265–1,371) | 2,938 (1,204–2,997) | 848 (817–905) |
| MD Viewer | 1,477 (1,417–1,503) | 4,377 (4,255–4,473) | 828 (820–1,093) |
| SkimDown | 978 (948–1,122) | 1,709 (1,683–1,777) | 877 (873–948) |

n = 5 for every cell. The error of a complete time is one frame (17 ms) plus
whatever the app changes last: complete is the last change anywhere in the
window, which for mallow includes the window title being set once the document
has rendered.

## Memory

Footprint (sum of phys_footprint over the attributed processes) 20 s after the
launch; n = 5 per cell. RSS sums are in the raw records and are not compared,
because they count shared pages once per process.

| App | Small (steady) MiB | Large shown MiB | Mermaid MiB | tree-1000 MiB |
| --- | --- | --- | --- | --- |
| mallow | 272 (262–274) | 438 (433–688) | 295 (289–339) | 104 (104–105) |
| Marky | 166 (163–224) | 560 (552–749) | 201 (199–204) | 199 (197–203) |
| MD Viewer | 152 (135–152) | 664 (637–669) | 193 (190–203) | N/A |
| SkimDown | 173 (173–173) | 391 (389–392) | 203 (202–212) | 138 (138–138) |

Where it sits, Small (medians, MiB): WebContent 217 / 114 / 99 / 89, the app
process 32 / 27 / 29 / 63, GPU 11–13 and Networking 5–6 in every app. With a
folder and no document, mallow's WebContent holds 46 MiB (tree-100).

## Folder load (P2)

Complete on a warm launch with the folder as the argument; n = 5.

| App | tree-100 (104 files) ms | tree-1000 (989 files) ms | Scanning model |
| --- | --- | --- | --- |
| mallow | 674 (643–709) | 672 (664–718) | lazy: the top level is read, folders on expansion |
| Marky | 749 (730–792) | 771 (711–790) | shows the tree expanded below the folder; how much it reads at once was not established |
| MD Viewer | N/A | N/A | does not open a folder handed as an argument (shows its empty state) |
| SkimDown | 779 (721–819) | 871 (859–881) | eager: counts every Markdown file ("989 Markdown files") and opens a file |

File switch (P2) was not measured; it needs a click inside each app, which the
procedure does not drive.

## What the numbers say about mallow

A difference is called clear below only where the five runs do not overlap.

**Strengths**

- **A large document's median memory is below the other Tauri app's and MD
  Viewer's**: 438 MiB against Marky's 560 and MD Viewer's 664, behind only
  SkimDown's 391. This is a lower median, not a clear difference: one mallow run
  read 688 MiB, so its range (433–688) overlaps Marky's (552–749) and MD
  Viewer's (637–669); the other four mallow runs were 433–439.
- **Opening a folder is cheap and does not grow with it**: 672 ms and 104 MiB
  for 989 files, the same as for 104 — the lazy tree doing what it was built
  for. Marky holds about twice the memory for the same folder.
- **Launch is level with the others**: Small completes within about 0.2 s of every
  other app warm and cold; no app is clearly ahead of the Tauri peers by more
  than that.

**Weak spots**

- **Memory after rendering a small document is clearly the highest**: 272 MiB
  against 152–173, almost all in WebContent (217 against 89–114 MiB). Opening
  the document adds about 170 MiB to WebContent over the folder-only state,
  while Marky, which also uses Shiki, holds 114 MiB. Mermaid shows the same gap
  (295 against 193–203).
- **Render time grows faster with code-heavy documents**: on Medium mallow is
  clearly the slowest of the four (1,576 ms against 978–1,477); on Large it is
  clearly behind Marky (3,436 against 2,938) and SkimDown, and clearly ahead of
  MD Viewer (4,377). Small is level, so the gap is per-block work rather than
  launch.
- Mermaid renders about 0.1 s later than the others (965 ms against 828–877),
  a small difference whose ranges overlap SkimDown's and MD Viewer's.

**Improvement candidates**, each its own task: TASK-73 (what the markdown view
keeps resident after a small document) and TASK-74 (where a code-heavy
document's render time goes). The Mermaid delay is not proposed: its ranges
overlap.

## Limits

- One machine; one warm session, and two cold sessions whose valid runs are
  pooled. The numbers compare apps under the same conditions and are not
  absolute launch times for other Macs.
- **The first cold session's screenshots are lost**: the driver named a
  screenshot by app, target, start and run number only, so the second cold
  session wrote over the first one's frames (its records are intact). The
  driver now puts the session's start time in the name and records the path.
- Cold means after `sudo purge`, not after a reboot.
- Complete is the last on-screen change in the window, and covers the visible
  part of a long document only.
- No published figure for any app is used here, and no figure mallow reports
  about itself.
