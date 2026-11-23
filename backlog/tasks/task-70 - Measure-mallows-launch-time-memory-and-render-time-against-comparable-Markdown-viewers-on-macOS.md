---
id: TASK-70
title: >-
  Measure mallow's launch time, memory and render time against comparable
  Markdown viewers on macOS
status: Done
assignee: []
created_date: '2026-11-18 22:15'
updated_date: '2026-11-23 07:26'
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
- [x] #1 At least three apps including mallow are chosen, with each excluded candidate's reason recorded
- [x] #2 The environment (apps and versions, CPU, RAM, macOS version, background load, mallow's session and update-check state) is recorded, and every difference in conditions between apps is stated
- [x] #3 Small, Medium, Large and Mermaid test documents and the P2 folder layouts are reproducible from a generator script
- [x] #4 Launch time (cold and warm), memory (steady state and with the Large document) and render time are measured on one machine with the same data, five runs each, medians reported
- [x] #5 The memory method says which processes count toward each app and how shared memory is kept from being counted twice
- [x] #6 No figure from instrumentation added to mallow alone is compared with an outside measurement, and unsupported features are N/A rather than zero
- [x] #7 The procedure and the report are written as backlog docs, the report covering mallow's strengths and weak spots
- [x] #8 Improvement candidates are listed only for a clear weakness, each proposed as a separate task
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手時の判定 (オーナーと合意、2026-11-23):
- 対象は mallow 0.15.0 / Marky 0.1.3 / MD Viewer 0.1.9 (プレリリースのみ) / SkimDown 0.16.0 の 4 本。除外なし。3 本とも ad-hoc 署名・未公証で Gatekeeper が「壊れている」と拒否し、オーナーが quarantine を外して起動 (doc-3 に記録)。
- mallow の settings.json は退避し、毎回 windows: [] / autoCheckUpdates: false を差し込んで計測、終了後に元へ戻した (cmp で同一を確認)。
- cold は sudo purge 後 (再起動ではない)。オーナーのターミナルで実行。
- 「画面で使える状態」は画面録画のフレーム解析で判定。

方式の選択:
- ffmpeg の全画面録画は他のウィンドウ (オーナーの私的な画面) まで写るので捨てた。ScreenCaptureKit で「計測開始時に動いていた全アプリを除外」したストリームにし、起動したアプリのウィンドウだけを収録する Swift ツール (scripts/bench/launchwatch.swift) にした。
- 変化検出は SCStream の dirty rect では誤る (除外したアプリの背面更新も dirty として報告され、8 ms から変化が出続けた)。ウィンドウ領域の 4×4 ブロック和をフレーム間で比べる方式に変更。後半の変化が実際の描画 (空状態 → ファイル選択 → 本文描画) であることは --frames-dir の画像で確認。
- 経路は open -a <App> --args <path> に統一。Marky と SkimDown は open イベント (Finder の経路) で渡したファイルを無視するため。mallow は両経路を測り差は約 0.1 s。
- WebKit の XPC プロセスは launchd の子なので、responsibility_get_pid_responsible_for_pid で帰属させた。比較は phys_footprint の合計 (所有者 1 つの台帳なので二重計上しない)。RSS 合計は参考値として記録のみ。
- Marky は渡されたフォルダを settings.json に残して次回起動時に読むので、毎回の計測前に削除。SkimDown のフォルダごとの最終選択も削除。

計測 (詳細は doc-3、手順は doc-2):
- warm: 4 アプリ × 6 対象 × 5 回 = 120 回、失敗 0、unsettled 2。mallow の open イベント経路の補足 10 回。
- cold: Small で 9〜10 回 (初回の 3 件は画面収録の許可前で失敗、その後オーナーが全体をもう一度回したため 5 回を超えた)。有効な回は全部数えた。
- mallow の弱点 (5 回の範囲が重ならないもの): Small 表示後のメモリ 272 MiB に対し他は 152〜173 MiB (差はほぼ WebContent: 217 対 89〜114)。Medium の描画は 4 本中最遅 1,576 ms。→ TASK-73 / TASK-74 として起票。
- 強み: Large のメモリは Tauri/WebView 系で最少 (438 対 560 / 664)、1,000 ファイルのフォルダでも 672 ms・104 MiB。

計測していないもの: P2 のファイル切り替え (アプリ内のクリックが必要)。MD Viewer のフォルダ読み込みは引数でフォルダを開けないので N/A。

検証: pnpm lint (既存の biome.json スキーマ info のみ)、pnpm test 767 件成功、gen-data.mjs を別ディレクトリへ再生成して diff -r が一致。
<!-- SECTION:NOTES:END -->
