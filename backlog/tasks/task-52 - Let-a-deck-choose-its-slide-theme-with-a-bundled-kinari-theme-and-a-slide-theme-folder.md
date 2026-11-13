---
id: TASK-52
title: >-
  Let a deck choose its slide theme, with a bundled kinari theme and a slide
  theme folder
status: Done
assignee: []
created_date: '2026-11-13 00:15'
updated_date: '2026-11-13 02:59'
labels:
  - feature
dependencies: []
references:
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
  - src/lib/deck.ts
  - src/lib/deck-css.ts
priority: medium
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow draws every Marp deck with its one slide theme (decision-18 §5), so a reader who wants their decks in a look of their own has no way to get it. This task lets a deck choose its theme from mallow's slide theme, a bundled theme, and themes the reader keeps in a folder, and lets the reader choose which of them a deck that names no theme gets.

decision-19 is the decision, and this task builds what it settles without reopening it: the three kinds of theme and how a deck's `theme` directive picks one (§1); the default-theme preference `defaultSlideTheme` (§2); the slide theme folder `slideThemeDir`, what in it is a theme, reserved and conflicting names and when it is read (§3); a folder theme walked as a deck's CSS is, with what was removed reported in Settings (§4); the inherited `color-scheme` as the one thing a theme is given of the colour mode (§5); a deck's `size` taken from the theme's `@size` entries (§6); and kinari, kept in a repository of its own and bundled as mallow's copy of one of its releases (§7).

kinari is the Marp theme the owner is publishing in its own repository. Its draft — the theme, a sample deck and a script that renders it with Marpit on mallow's markdown-it — is in `_sandbox/marp-theme` (not tracked) until that repository exists. It follows the owner's earlier Keynote decks (`_sandbox/slide-sample`, not tracked): a paper ground on both sides, terracotta headings, an orange accent, pink rounded notes, and colours in `light-dark()` pairs.

Subtasks:
- TASK-52.1 — the theme set, the slide theme folder, the default-theme preference and `@size`.
- TASK-52.2 — bundle a kinari release as mallow's copy and measure it on the three WebViews. Waits for kinari's first release.

Out of scope: kinari's own design, README, licence and releases, which are the kinari repository's; drawing Marp's built-in `gaia` and `uncover` (decision-18 calls that a decision of its own); loading fonts from a theme; a theme per window; and editing a theme inside mallow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A deck is drawn with the theme its theme directive names among mallow's slide theme, kinari and folder themes, and a deck naming none or an unknown one with the default-theme preference, per the subtasks
- [x] #2 mallow's copy of a kinari release ships with the app and follows the reader's light / dark mode in the Slides view and in a presentation
- [x] #3 No boundary AGENTS.md records is widened beyond what decision-19 says, and the CSP and the dependency list are unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
子タスクの証跡で親の AC を確認した（2026-11-13）。
- #1: TASK-52.1 の AC #1・#2（default とフォルダのテーマ、既定のテーマのフォールバックと通知）と、TASK-52.2 の deck.test.ts（theme: kinari がフォルダあり・なしで kinari で描かれること、既定のテーマ kinari）で満たす。PR #96・PR #97。
- #2: TASK-52.2 の AC #1（写しを同梱）、AC #3（Chromium で color-scheme の light → dark に追従）、AC #4（オーナーがビルドしたアプリの macOS / Windows / Linux で、スライド表示と発表中のモード切り替えを確認し、問題なし）で満たす。
- #3: TASK-52 着手前の fe3b288 から 0f904f3 までで、package.json・pnpm-lock.yaml・src-tauri/Cargo.toml・Cargo.lock・tauri.conf.json（CSP）・capabilities・index.html の差分は 0。AGENTS.md の境界の記述に増えたのは、フォルダのテーマをデッキの CSS と同じ走査と封じ込めに通すこと（decision-19 §4）と、kinari の写しはアプリの CSS なので走査しないこと（§7）の 2 点で、どちらも decision-19 が定めた範囲。フォルダは allow_media_dir で付与する（§3）。list_slide_theme_files はカスタムコマンドで、capability の対象外。
<!-- SECTION:NOTES:END -->
