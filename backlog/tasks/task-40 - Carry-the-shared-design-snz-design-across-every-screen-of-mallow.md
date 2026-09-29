---
id: TASK-40
title: Carry the shared design (snz-design) across every screen of mallow
status: In Progress
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-29 03:55'
labels:
  - design
milestone: m-4
dependencies: []
references:
  - ../snz-design
priority: high
type: feature
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow's side of snz-design TASK-19 (complete the shared design across mallow's UI). snz-design is the shared design specification for the serendipitynz apps; check it out beside this repository as `../snz-design`. The trial (TASK-39, local branch `trial/snz-design-tokens`) put the shared colour tokens on the theme and settings UI only. This task carries the shared design to every screen and component of mallow.

Before building or changing a screen, read snz-design doc-16 (the adoption guide for the four Web apps) and snz-design's adoption record for mallow ("mallowの共通デザイン適用記録", created alongside the first subtask by the template in doc-16 §10, as snz_studio's doc-17 was). The changes the subtasks carry come from the mallow rows of snz-design doc-13 §10 and doc-14 §7, and from doc-16 §7.2.

Work is split by screen into the subtasks, one PR each. The first subtask holds the colour foundation and the basic controls; the others build on it. A subtask being Done does not by itself complete snz-design TASK-19: the adoption record is updated with each merged revision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every subtask is Done, and snz-design's adoption record for mallow lists each subtask with its merged revision
- [ ] #2 Every screen and component in the adoption record has a result; no required item is left unapplied, and each intentional exception has its reason and handling
- [ ] #3 The four schemes (Standard Light / Dark, Solarized Light / Dark) meet the contrast criteria, stored settings are kept, and the keyboard reaches every control; the environment and evidence are recorded (snz-design doc-5 §5.3). Checks in the real window (WKWebView) record the owner's confirmation
- [ ] #4 Document, code and mermaid rendering, the explorer, the toolbar, the settings and the theme sync across several windows are regression-checked; Dracula and Nord keep their own palettes
- [ ] #5 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 全体の回帰確認 (2026-09-29、オーナー)
- 子タスク 40.1〜40.6 の統合後の mallow 全体を、オーナーが実窓 (WKWebView) で確認し、不具合らしいものは見つからなかった。2 つの窓を開き、片方で配色を変えたときにもう片方が追うこと (doc-14 §7 が未確認として残した項目) も確認済み。

## 仕様の対象と扱いの整理 (2026-09-29)
- Dracula・Nord は doc-5 §3.1 の受入基準の対象外 (保持条件だけが掛かる)。TASK-40.5・40.6 のノートで「未達」と書いた Nord の比 (案内の語 4.10、失敗の図形 2.55、設定の補助文 3.52) は参考値であり、例外にも判断事項にも当たらない。AA を厳守するのは標準の 2 配色で、Solarized は測ったうえで緩めてよい (doc-5 §2.1 の付記)。
- 設定モーダルが操作域を持たないのは例外ではない (オーナー判断): 設定は押した時点で保存され、操作域に置く実行・取り消しがそもそも無い。操作域に置けるボタンがあるのにあえて設けない場合だけが例外。doc-9 §6.6 の本文への反映は snz-design の TASK-32 が行う。
- 表示切替を図形だけのセグメントにしたこと (TASK-40.4) は、snz-design TASK-33 (2026-09-29 完了) で仕様に入り、例外ではなくなった。

## セグメントの container に名前を付けた
- snz-design TASK-33 が doc-9 §6.12 に「問い合わせる容器に名前を付け、図形だけの組にはその名前の容器を持たせない」を足した。mallow は名前の無い `@container (max-width: 22rem)` だったので、`.settings-group` を `container: segmented / inline-size` にし、問い合わせを `@container segmented (max-width: 22rem)` にした。
- 確認 (Chromium のブラウザ窓、Tauri は stub): 幅 1024 で設定の区画 386px → 2 組とも横並び、幅 320 で区画 238px → 2 組とも縦積み。名前の無い容器 (幅 200px) の中に置いたセグメントは横並びのまま (名前を付ける前は縦積みになっていた条件)。`pnpm lint` / `pnpm build` / `pnpm test` (444) 通過。
<!-- SECTION:NOTES:END -->
