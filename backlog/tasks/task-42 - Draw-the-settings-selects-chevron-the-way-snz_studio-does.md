---
id: TASK-42
title: Bring the settings modal's selects and sections to snz_studio's look
status: Done
assignee: []
created_date: '2026-10-23 20:37'
updated_date: '2026-10-25 06:10'
labels:
  - design
milestone: m-6
dependencies: []
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The settings modal's selects (colour family, light / dark, prose measure, language) follow snz-design doc-8 §6.3 in mallow and in snz_studio alike, yet they look different. mallow draws its chevron as two CSS gradient triangles 5px across in the muted text colour; snz_studio draws a 20px stroked chevron (snz-design's icon-size-md) in the figure colour, which the spec's tokens leave to each app and which reads as the control's affordance at a glance. The owner prefers snz_studio's select and mallow's compact settings layout, so this takes the select's look from snz_studio and keeps the layout: label on the left, select on the right, one row per setting.

The chevron cannot be a CSS background here as it is in snz_studio, because there it is a data-URL SVG coloured per theme by styled-components, while mallow's palettes are CSS custom properties a data URL cannot read. The select is wrapped instead, with the chevron as an inline SVG following currentColor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every select in the settings modal shows a 20px chevron in the figure colour, with snz_studio's geometry (stroke 2.5, the 5-9 / 12-16 / 19-9 path), on all six palettes
- [x] #2 The settings modal keeps its layout: label left, select right, one row per setting, and the select height stays in step with the segmented controls beside it
- [x] #3 The select stays a native select: keyboard, the platform list, the disabled option and the focus ring are unchanged, and clicking the chevron opens the list
- [x] #4 pnpm lint, pnpm build and pnpm test pass
- [x] #5 Each section of the settings modal sits in its own box, as snz_studio's settings cards do: the nested surface, the divider line and the surface radius, with Dracula and Nord given a nested surface of their own
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-24: オーナーの追加依頼で範囲を広げた。設定の区画を snz_studio のカードと同じく枠で括る (面 surface-nested・輪郭 line-divider・角丸 radius-md)。モーダルの閉じるボタンは × のまま (オーナー判断、snz_studio の「閉じる」には合わせない)。

## 実装 (2026-10-24)
- `components/Select` が native の select を `span.select` で包み、シェブロンを inline SVG で同じグリッドの区画に重ねる (`pointer-events: none`)。snz_studio と同じ形 (M5 9l7 7 7-7、線幅 2.5、20px = --snz-icon-size-md、--color-figure)。右の余白は snz_studio と同じ 20px + 2 × --snz-space-sm。高さは mallow の行に合わせて上下 6px (snz_studio の 12px は行が高くなりすぎる)。
- 区画の枠は `.settings-group` に面 `$surface-nested` (新設の役割 surface-nested。Dracula #2b2d3a、Nord #3b4252)・輪郭 `$border`・角丸 `$radius-surface`・内側 14px 16px。
- 枠の内側の幅が 22rem ちょうどまで縮み、エクスプローラの位置のセグメントが全幅のモーダルでも縦積みになった。`.modal` の最大幅を 420px → 440px にして横並びに戻した (更新ダイアログも 20px 広がる)。

## 確認 (Chromium、静的な検証ページ。実窓ではない)
- 6 配色で枠の面に対する比: 補助文・区画名 標準ライト 6.05 / 標準ダーク 7.28 / Solarized ライト 5.39 / Solarized ダーク 5.26 / Dracula 5.30 / Nord 4.10 (以前のモーダル面の上では 3.52)。選択欄の輪郭 3.52〜5.30、シェブロン 3.52〜6.72。
- セグメントは 6 配色とも横並び。
- AC #3 (native の操作・シェブロンのクリックで一覧が開く) は WKWebView の実窓で未確認。オーナー確認待ち。
- `pnpm lint` / `pnpm build` / `pnpm test` (468) 通過。

- 2026-10-24: オーナーが `pnpm tauri dev` の実窓 (WKWebView) で確認し、問題なし。AC #3 をチェック。

- 2026-10-24: PR #79 がマージされた (`06cea94`)。Codex のレビューは 1 回目で指摘なしの承認。
<!-- SECTION:NOTES:END -->
