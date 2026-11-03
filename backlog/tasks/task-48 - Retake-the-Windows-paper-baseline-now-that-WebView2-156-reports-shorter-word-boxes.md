---
id: TASK-48
title: >-
  Retake the Windows paper baseline now that WebView2 156 reports shorter word
  boxes
status: To Do
assignee: []
created_date: '2026-11-03 22:25'
labels:
  - bug
dependencies: []
references:
  - scripts/paper/baseline.json
  - scripts/paper/measure-paper.mjs
  - .github/workflows/check.yml
priority: medium
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Windows leg of the CI paper job now fails its scale check on any PR that touches paper inputs. Run 41727437237 (PR #84, TASK-46) measured a median word height of 13.22 against the ci-windows baseline of 15.45 in scripts/paper/baseline.json — 14.4% off, tolerance 5%. Every other check in that job passed, and the macOS and Linux legs passed. The last passing Windows paper run was 41017907470 on 2026-10-30.

**The type did not shrink; the measure moved.** Between those two runs the runner image went from windows-2025-vs2026 20261021.278.1 to 20261030.294.1, and the PDF's producer from WebView2 155 / Skia m155 to WebView2 156 / Skia m156. The two PDFs embed the same fonts, run to the same 15 Letter pages and share the text extent 45.0–561.5. All 1,113 words sit at identical x positions with identical widths (max difference 0.0). Only the vertical boxes pdftotext -bbox reports got shorter (median 15.45 → 13.22), with their centres moving 0.15pt. So Skia m156 writes different vertical font metrics into the PDF, and the scale check — which reads box height — reports a shrink that did not happen.

Nothing on main fails today, because the paper job runs only when scripts/paper/affects-paper.mjs says a PR touched paper inputs. The next such PR goes red on Windows for this reason alone, and a red that is known to be noise is how a real 0.847-style shrink would slip through.

Two ways out, and which one is the owner's decision. (a) Retake ci-windows from a fresh run under baseline.json's own _how_to_add: the owner opens the PDF and accepts the number, and its from names the run and WebView2 156. This keeps the measure and will recur on the next metrics change. (b) Make measure-paper.mjs judge scale on a horizontal measure such as word width, which this change showed to be stable. That changes the instrument for every platform, so every baseline has to be retaken under it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Whether to retake the baseline or change what the scale check measures is decided with the owner and recorded on this task, with the reason
- [ ] #2 The Windows leg of the paper job passes on a run of the merged change, with the measurement it passed on recorded on this task
- [ ] #3 Any baseline retaken carries in its from the run id it came from and the WebView2 version that produced the paper, and was accepted by the owner after looking at the PDF
- [ ] #4 If the scale measure changes, every key in _required is retaken under the new measure and AGENTS.md's description of the paper job matches it
<!-- AC:END -->
