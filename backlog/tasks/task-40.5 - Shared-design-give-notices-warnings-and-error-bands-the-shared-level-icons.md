---
id: TASK-40.5
title: 'Shared design: give notices, warnings and error bands the shared level icons'
status: In Review
assignee: []
created_date: '2026-09-28 03:59'
updated_date: '2026-09-28 22:40'
labels:
  - design
milestone: m-4
dependencies:
  - TASK-40.1
references:
  - ../snz-design
  - src/App.tsx
  - src/components/ErrorBanner.tsx
  - src/components/Viewer.tsx
  - src/styles/source.scss
  - src/styles/table.scss
  - src/styles/xml.scss
  - src/styles/html.scss
parent_task_id: TASK-40
priority: high
type: feature
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtask of TASK-40, on the foundation of TASK-40.1. The notice bar under the toolbar (.app__notice), the notices of the source, table, XML and HTML views, the syntax error bands (ErrorBanner, .doc-error) and the viewer's loading and failure placeholders tell their level by text and colour only, with no icon (snz-design doc-13 §4 and §7.1). Colour alone does not meet WCAG 1.4.1.

snz-design references: doc-9 §6.4 (notices and their levels); doc-8 §6.7 (in progress); doc-5 §3.2 (1.4.1); doc-13 §10 (the mallow rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each notice, warning and error band carries the icon of its level from doc-9 §6.4, so its level is not told by colour alone
- [x] #2 The notice bar keeps its close button and role=status, and the syntax error bands keep role=alert and stay undismissable (doc-9 §6.4)
- [x] #3 The viewer's loading and failure placeholders follow doc-9 §6.4 and doc-8 §6.7
- [ ] #4 Contrast at the measuring points of snz-design doc-5 §3.2 in the four schemes, keyboard reach to every control of the screen, and the environment (doc-5 §5.3) are recorded in Implementation Notes; the real-window (WKWebView) check records the owner's confirmation
- [x] #5 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Notice を4段 (failure/warning/degraded/info) に拡張: 段ごとの図形 (lucide circle-x / triangle-alert / ban / info)、操作域 (actions)、閉じる (info のみ、アイコンのみボタン)。role は failure=alert、それ以外=status。面・語・帯・図形のトークンは doc-9 §6.4 の表どおり。
2. 適用先 (doc-13 §10 の割当): 通知帯=案内(閉じられる, role=status維持) / 強調省略=縮退 / 表・XMLの注記=案内 / HTMLを外で開く=縮退+操作域 / 構文エラー帯・描画エラー(MarkdownView, mermaid の命令的DOM)=失敗 / ビューアの読み込み失敗=失敗、待ち=Busy。
3. 通知帯を閉じたら焦点を次の受け手へ移す。出現は不透明度のフェード (reduced motion でもフェードは残す)。
4. i18n に段名を ja/en 両方に追加。旧クラス (.src-notice/.tbl-notice/.xml-notice/.html-notice/.doc-error/.cfg-error-banner/.mermaid-error/.app__notice-close) を整理。
5. 4配色+Dracula/Nord のコントラストを計測して Implementation Notes に記録。pnpm lint / build / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 実装 (doc-13 §10 の割当どおり)
- `Notice` を4段 (failure / warning / degraded / info) に拡張。図形は lucide の circle-x / triangle-alert / ban / info。warning と degraded は同じ配色なので図形が唯一の区別 (doc-9 §6.4)。操作域 (`actions`) と、info だけが持つ閉じる (アイコンのみボタン、24px) を追加。role は failure=alert、他=status。
- 適用先: 通知帯=案内 (閉じられる、role=status 維持) / 強調省略=縮退 / 表・XML の注記=案内 / HTML を外で開く=縮退 + 操作域 / 構文エラー帯 (ErrorBanner)・Markdown の描画エラー・mermaid の描画エラー=失敗 (role=alert のまま、閉じる無し) / ビューアの読み込み失敗・メディア非対応=失敗、読み込み待ち=`Busy`。
- mermaid の描画エラーは markdown の DOM に手で差し込む要素なので、React の図形を置けず、`codeblock.ts` の先例どおり SVG 文字列を `mermaid.ts` に持つ。この図形は `aria-hidden` (語が失敗を述べており、言語を持たないモジュールで段名を付けられないため。doc-8 §6.6 の decorative の条件)。
- 通知帯を閉じたら、body 内の最初の操作へ焦点を移す (doc-9 §6.4 の move_focus)。出現は不透明度のフェード (`--snz-motion-state`、reduced motion でも残す)。**退出のフェードと積み替えの滑りは未実装** — 通知帯は同時に1件しか出ないので積み替えが起きず、退出は unmount で即時。
- 旧クラス (.src-notice / .tbl-notice / .xml-notice / .html-notice* / .doc-error / .app__notice-close と .cfg-error-banner の箱) を削除。`.cfg-error-message` の `$muted` は失敗の面の上で読めなくなるので外した。
- 判断: 空の Mermaid ファイルの「空のファイルです。」は失敗ではなく案内の段にした (旧 `.doc-error` は赤だったが、何も失敗していない)。同時に直書きの日本語を i18n (`mermaidEmpty`) へ移した。warning の段は mallow に置き場が無いが、Notice の4段は一組の仕様なので、図形・色・i18n を用意した。
- 通知帯の文言は、これまでの「閉じる」語ボタンからアイコンのみ (title + aria-label は「閉じる」) に変わった (doc-8 §6.2)。

## 計測 (AC #4 の一部。コントラスト)
測定点は doc-5 §3.2 の「警告・エラー・成功」①語 対 面 (4.5:1) ②帯・図形 対 面 / 外側の面 (3:1)。スクリプトは snz-tokens.css と `_vars.scss` の値から計算 (半透明の面は `--color-bg` に合成)。
| 配色 | 語 失敗/警告・縮退/案内 | 帯・図形 対 面 失敗/警告・縮退/案内 | 帯 対 外側 (bg) 失敗/警告・縮退/案内 |
|---|---|---|---|
| Standard Light | 7.59 / 7.78 / 5.53 | 5.50 / 5.48 / 3.42 | 6.78 / 6.43 / 4.05 |
| Standard Dark | 8.34 / 7.36 / 7.87 | 6.47 / 6.39 / 4.49 | 6.16 / 6.90 / 3.83 |
| Solarized Light | 7.04 / 6.34 / 5.04 | 5.20 / 4.47 / 3.64 | 6.17 / 5.14 / 4.13 |
| Solarized Dark | 8.04 / 7.26 / 5.61 | 6.39 / 4.47 / 3.76 | 5.39 / 4.05 / 3.26 |
| Dracula | 6.05 / 5.99 / 6.14 | 3.83 / 5.99 / 6.14 | 4.53 / 8.36 / 5.54 |
| Nord | 5.00 / 5.61 / **4.10** | **2.55** / 3.08 / 4.10 | 3.05 / 4.39 / 5.09 |
- 共有4配色は全点が基準を満たす。
- 案内の帯・図形は `border-strong` ではなく `control-border` にした。`border-strong` だと面に対して Dracula 2.33、Nord 1.36 で 3:1 に届かない。
- **Nord に2点の未達 (mallow が持つ配色)**: 案内の語 4.10:1 (`--color-muted` #9aa6bd が面 #3b4252 に載る、基準 4.5)、失敗の帯・図形 2.55:1 (`--color-danger` #bf616a が面に載る、基準 3)。原因は Nord 本来の値そのもの (Nord11 と muted) で、直すには Nord の値を動かす必要があり、「Dracula と Nord は自分の配色を保つ」(TASK-40.1) の方針と衝突するため、この課題では動かしていない。判断は持ち主に委ねる。失敗の図形の 2.55 は TASK-40.3 で入れた failure Notice から既にあった値。

## 計測 (キーボード・環境)
- キーボード: このタスクで増えた操作は通知帯の閉じるボタン (button、Tab で到達、Enter/Space で閉じる) と HTML の「既定のアプリで開く」ボタン (既存の `.btn`) のみ。失敗・縮退・案内 (閉じない) は操作を持たず Tab の停止を増やさない。**実機のキーボード操作は未確認** (コードからの確認のみ)。
- 見た目の確認: ビルド済み CSS を静的 HTML に当て、Chromium (ブラウザペイン) で Standard Light と Solarized Dark の4段を目視した (折り返し・操作域・閉じるの配置)。**WKWebView ではない**。
- 環境 (doc-5 §5.3): mallow / feat ブランチ (base 6287f2e) / snz-design tokens 0.1.1 / macOS 26.6.2 / Chromium (Claude Code のブラウザペイン、Safari 26.6.2 と同じ OS) / 表示倍率・解像度は未記録 / ポインタ + 物理キーボード / Standard Light・Solarized Dark を目視、6配色の値を計算 / 表示言語 ja・en は文言の追加のみ、描画は en 文字列 / 2026-09-29。
- 実ウィンドウ (WKWebView) の確認とオーナーの確認、Nord の判断は未了のため AC #4 は未チェック。

## 検証
- `pnpm lint` / `pnpm build` / `pnpm test` (440 件) 通過。Rust の変更なし。
<!-- SECTION:NOTES:END -->
