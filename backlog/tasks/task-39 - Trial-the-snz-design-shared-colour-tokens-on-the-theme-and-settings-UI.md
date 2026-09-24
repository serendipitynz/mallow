---
id: TASK-39
title: Trial the snz-design shared colour tokens on the theme and settings UI
status: In Progress
assignee: []
created_date: '2026-09-24 06:39'
updated_date: '2026-09-24 10:42'
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
- [ ] #3 The paper palette in print.scss stays light whatever scheme is on screen
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
<!-- SECTION:NOTES:END -->
