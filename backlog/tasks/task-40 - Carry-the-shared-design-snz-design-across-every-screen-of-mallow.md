---
id: TASK-40
title: Carry the shared design (snz-design) across every screen of mallow
status: Done
assignee: []
created_date: '2026-09-28 03:58'
updated_date: '2026-09-29 09:44'
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
- [x] #1 Every subtask is Done, and snz-design's adoption record for mallow lists each subtask with its merged revision
- [x] #2 Every screen and component in the adoption record has a result; no required item is left unapplied, and each intentional exception has its reason and handling
- [x] #3 The four schemes (Standard Light / Dark, Solarized Light / Dark) meet the contrast criteria, stored settings are kept, and the keyboard reaches every control; the environment and evidence are recorded (snz-design doc-5 §5.3). Checks in the real window (WKWebView) record the owner's confirmation
- [x] #4 Document, code and mermaid rendering, the explorer, the toolbar, the settings and the theme sync across several windows are regression-checked; Dracula and Nord keep their own palettes
- [x] #5 pnpm test, pnpm lint and pnpm build pass
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

## AC の状態 (2026-09-29)
- #4 (回帰確認) と #5 (test / lint / build) は上の記録を根拠にチェックした。
- #1〜#3 は snz-design の mallow 適用記録が作られるまで残す。#3 のコントラスト・キーボード到達・実窓確認の根拠は各子タスクのノートにあり、適用記録でまとめる。
- PR #72 のレビューで、問い合わせを仕様の書き方 `max-inline-size` にそろえ、容器の宣言の決まりを AGENTS.md / AGENTS.ja.md の Segmented の項に書いた。

## 適用記録 (snz-design doc-18) で見つかった未適用 2 件を直した (2026-09-29)
- 設定モーダルの「クリア」と「今すぐ確認」が native の `disabled` で焦点から外れ、理由の語を持たなかった (doc-8 §5.4)。TASK-40.1 が 40.3〜40.6 に回した項目で、TASK-40.6 で見落としていた。どちらも `aria-disabled` にして焦点を残し、理由の語に `aria-describedby` で結んだ。クリアの理由は上の「未設定」の行。今すぐ確認の理由は下の「確認しています…」の行で、そこに処理中の図形 (Busy) を置いた。ボタンの中に処理中の図形を出さないのは、このボタンが図形域を持たず、出すとボタンの幅が変わるため (doc-8 §6.1)。`.btn` に `[aria-disabled='true']` の描き方を足した。
- 通知帯が消えるときに即時に消えていた (doc-9 §6.4 は不透明度のフェードで出入りする)。`hooks/useExitFade` が消える値をフェードの終わりまで残し、その間は `inert` にする。動きを減らす設定でも残す (不透明度だけなので doc-5 §4.2 に反しない)。
- 確認 (Chromium のブラウザ窓、Tauri は stub): 最近のフォルダの消えた項目を選んで通知帯を出し、閉じると `notice-out` が走って `inert`、焦点は本体の最初の操作 (Open Folder) へ移り、動きの後に要素が消える。設定モーダルのクリアとテスト中の今すぐ確認は、焦点を受け、破線・不透明度 0.45、理由の語 (Not set / Checking…) を持つ。押しても何も起きない。`pnpm lint` / `pnpm build` / `pnpm test` (444) 通過。

## #73 の実窓の確認 (2026-09-29、オーナー)
- serendipitynz/mallow#73 (main `52f0241`) をオーナーが実窓 (WKWebView) で目視確認した。設定モーダルの「クリア」と「今すぐ確認」が焦点を受けて押しても何も起きないこと、通知帯が閉じるときにフェードすることを含む。
- これで子タスク 40.1〜40.6 と #72・#73 のすべてに実窓の確認がそろったので、AC#3 をチェックした (4配色の比・キーボードの到達・環境は各子タスクと上のノートにある)。
- AC#1・#2 は snz-design の適用記録 doc-18 の更新 (serendipitynz/snz-design#31) の統合を待つ。

## 完了 (2026-09-29)
- AC#1: 子タスク 40.1〜40.6 はすべて Done。snz-design の適用記録 doc-18 (snz-design main `354de86`、serendipitynz/snz-design#30・#31) が、各子タスクと TASK-37・TASK-40 (#72・#73) を PR と統合済みリビジョン付きで持つ。
- AC#2: doc-18 §2 の全行が適用の結果を持ち、§5 (未適用) は空。§3 の意図的な例外 3 件 (アウトラインの読み順・今すぐ確認の処理中・ビューアとエクスプローラの中の告知の退出) はどれも理由と扱い (恒久) を持つ。アウトラインの読み順はオーナー判断 (2026-09-29、いったんこの扱い)。
<!-- SECTION:NOTES:END -->
