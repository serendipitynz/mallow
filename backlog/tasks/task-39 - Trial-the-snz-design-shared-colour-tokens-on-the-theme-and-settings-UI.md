---
id: TASK-39
title: Trial the snz-design shared colour tokens on the theme and settings UI
status: Done
assignee: []
created_date: '2026-09-24 06:39'
updated_date: '2026-09-28 04:53'
labels:
  - feature
dependencies: []
references:
  - ../snz-design
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The mallow side of snz-design TASK-12 (the shared design for the five apps; checked out as the sibling `../snz-design`). It checks whether mallow's SCSS and its existing theme setting (localStorage `theme`, 7 ids) can carry the four shared schemes — Standard Light / Dark and Solarized Light / Dark — without rewriting a stored value.

Done on the local trial branch `trial/snz-design-tokens` with no PR (owner, 2026-09-24). What mallow adopts is decided after reviewing the result, in snz-design's full-adoption task (TASK-19 there).

snz-design references: doc-7 (theme switching and migration) §6.2 / §6.4 / §7.4, doc-10 (shared tokens) §4 / §7, doc-4 §5.2 (the document, code and diagram rendering to preserve).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 light / dark / solarized-light / solarized-dark draw the shared token values; Dracula and Nord keep their own palettes
- [x] #2 data-color-family and a resolved data-color-mode are set before first paint and on every theme change, derived from the stored theme id without rewriting it
- [x] #3 The paper palette in print.scss stays light whatever scheme is on screen
- [x] #4 The settings modal and the theme menu are checked in the four schemes, and the differences are reported back to snz-design
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Trial branch `trial/snz-design-tokens`, branched from main `ceb391d`. `src/styles/snz-tokens.css` is a copy of snz-design `9584b5b` `tokens/dist/snz-tokens.css`, imported first in `main.tsx`.

## What changed
- `_vars.scss`: the light / dark / solarized-light / solarized-dark mixins are replaced by one `theme-shared` mixin whose values are `var(--snz-*)`. Which of the four is drawn is decided by the `data-color-family` / `data-color-mode` attributes, not by the selector that includes it. `on-dark` now keys on `data-color-mode='dark'` (resolved, never auto), so the Shiki dark swap no longer needs the media query. Dracula and Nord keep their literal palettes.
- `print.scss` includes `theme-print`, the pre-trial light palette kept as literals: a `var()` would resolve to the on-screen scheme and print a dark theme dark.
- `index.html` and `lib/theme.ts` derive the two attributes from the theme id (light/dark/auto → standard, solarized-* → solarized, dracula/nord → their own name with mode dark; auto resolves against the OS). `applyTheme` and the OS listener both go through `notify`, so a change arriving from another window through `settings-sync` sets them as well. The stored id is never rewritten.
- `.btn` takes the control line instead of `$border` and the shared disabled look (dashed, 0.45).

## Checked (2026-09-24, macOS 26.6.2, Chromium 152 in the Claude browser pane, Vite dev server with a stub of `__TAURI_INTERNALS__`, OS emulated dark)
- `pnpm test` 30 files / 385 tests passed, `pnpm lint` clean, `tsc --noEmit` clean, `vite build` succeeded.
- For each stored `theme` value (none, auto, light, dark, solarized-light, solarized-dark, dracula, nord, bogus) the stored value was unchanged after load; attributes were standard/dark (none, auto, dark, bogus), standard/light, solarized/light, solarized/dark, dracula/dark, nord/dark. Ink on the viewer ground 10.61–14.42, link 5.41–7.52, control line 3.26–4.13 in the four shared schemes; Dracula and Nord measured as before (13.36 / 10.84).
- Settings modal in the four schemes: selected choice text 6.25–7.86; the unselected choice outline was 1.19–1.39 against the dialog with `$border`, and 3.64–4.39 after moving `.btn` to the control line.

## Left open
- Keyboard (Tab / arrows in the modal and the theme menu) was not exercised: the browser pane was hidden, so key events could not be sent.
- Two windows and WKWebView were not tried; neither was a document with code and mermaid (the Tauri file reads were stubbed out).

The differences are reported back in snz-design doc-14 (the Web four-app trial results).

Owner's check in the real Tauri window (WKWebView, macOS, 2026-09-24): the theme follows a live OS light/dark switch, and Tab moves focus through every control, buttons included. wry turns on WKWebView's `tabFocusesLinks` on macOS, so this holds whatever the OS keyboard-navigation setting is.

## AC#3 の確認と完了 (2026-09-28, TASK-40.1 の中で)
- 本適用 (TASK-40.1) の判断で、紙の配色は旧 light の直書きから標準 Light へ移した (オーナー決定 2026-09-28)。theme-print は `_snz-tokens.scss` (0.1.1) の `$snz-colors` の standard/light からコンパイル時に作る。
- 確認: MALLOW_UNATTENDED=1 のデバッグビルド (macOS 26.6.2 / WKWebView) で scripts/paper/print-pagebreaks.md を `--theme light` と `--theme dark` で書き出し、PDF の塗り色を読んだ。dark の実行でも本文 #232a36・リンク #14549e・区切り線 #d7dbe2・補助文 #555e6c で、light の実行と同じ標準 Light の値だった。dark の実行では mermaid が暗い側で描かれ、コードは単色 (印刷の on-dark 規則) になっており、暗い経路を通ったうえで紙が明るいままであることを示す。measure-paper.mjs は両方とも全項目通過 (14 ページ、文字高 18.55 / 基準 18.56)。
- 試験ブランチの unattended/run.ts は `data-theme` だけを置いていたため、`--theme dark` が明暗属性に届かず、紙の検査の dark 側が暗い経路を通らなくなっていた。TASK-40.1 で applyTheme を通すよう直した。
- 試験として Done にする (TASK-40.1 の AC#1)。本適用は TASK-40 とその子タスクが引き受ける。
<!-- SECTION:NOTES:END -->
