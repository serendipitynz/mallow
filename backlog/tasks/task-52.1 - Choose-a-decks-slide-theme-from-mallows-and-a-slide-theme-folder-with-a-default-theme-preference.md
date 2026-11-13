---
id: TASK-52.1
title: >-
  Choose a deck's slide theme from mallow's and a slide theme folder, with a
  default-theme preference
status: To Do
assignee: []
created_date: '2026-11-13 00:15'
updated_date: '2026-11-13 00:18'
labels:
  - feature
dependencies: []
references:
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
  - src/lib/deck.ts
  - src/lib/deck-css.ts
  - src/lib/custom-emoji.ts
  - src/lib/settings.ts
  - src/components/SettingsModal.tsx
parent_task_id: TASK-52
priority: medium
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds decision-19 §1–§6: the set of themes a deck can name, the default-theme preference, the slide theme folder and `@size`. Read decision-19 and decision-18 before starting; this task builds what they settle.

Today `lib/deck` builds one Marpit renderer per slide size with mallow's slide theme as the only theme and as `themeSet.default`, and records every theme name a deck asks for so the notice can name it. After this task the renderer's theme set holds mallow's slide theme (`default`) and every folder theme, `themeSet.default` follows the default-theme preference, and the name `kinari` is reserved for the copy TASK-52.2 bundles. Bundling kinari is not this task's: it waits for a release from the kinari repository.

What has to be built:
- **The default-theme preference** `defaultSlideTheme`, a store-backed preference that propagates through `saveSetting` and `settings:change` as the custom emoji folder does, and joins the `SettingChange` switch in `App`. Absent means mallow's slide theme. A stored name no longer held draws with mallow's slide theme and is shown as missing in Settings, not rewritten.
- **The slide theme folder** `slideThemeDir`, chosen in Settings with the folder dialog and granted with `allow_media_dir`. A theme is a `.css` file directly inside it carrying `@theme <name>`; `default` and `kinari` are reserved; two files claiming one name register neither. It is read when chosen, when a window starts, and each time a deck's Slides view is entered. Settings lists each registered name with its file and each skipped file with its reason.
- **The walk on a folder theme**: `walkDeckCss` over the theme's CSS before it is registered, with `url()` resolved against the theme file's own directory. What it removed is listed in Settings beside that theme, not in a deck's notice.
- **`@size`**: under a theme other than mallow's slide theme a deck's `size` takes the theme's `@size` entry of that name, and a theme with no entry draws at its own `section` size with the size reported. mallow's slide theme keeps its two generated sizes. The renderer cache, today keyed on size and the markdown config version, has to key on what the theme set now depends on as well.
- **The notice**: the theme entry is listed only for a name mallow does not hold, and `deckFeature.theme` says which theme was drawn instead, in ja and en.

**kinari's draft is the test theme**: `_sandbox/marp-theme/kinari.css`, copied into a slide theme folder under another `@theme` name (`kinari` is reserved), exercises the folder, the walk, `@size`, `light-dark()` under both modes and the default-theme preference with a real theme. It is not committed here.

To settle at the start and record in the notes: where the slide theme settings sit in the settings modal (a section of their own or beside the custom emoji folder), and how the pure parts — reading `@theme` and `@size` out of a file's text, the reserved and conflicting names, the fallback when the preference names nothing held — are split from the Tauri layer so they are unit-tested under Node, as `lib/custom-emoji` is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A deck naming default or a registered folder theme is drawn with it, in the Slides view and in a presentation
- [ ] #2 A deck naming no theme or an unknown one is drawn with the default-theme preference; absent, that is mallow's slide theme; the notice lists an unknown name and says which theme was drawn
- [ ] #3 The slide theme folder is chosen in Settings, registers the .css files carrying @theme directly inside it, refuses default and kinari, registers neither of two files claiming one name, and is re-read when Slides is entered
- [ ] #4 Settings lists each registered folder theme with its file, each skipped file with its reason, what the walk removed from a theme, and a stored default-theme preference naming nothing held as missing
- [ ] #5 A folder theme's CSS passes through walkDeckCss before it is registered, its url()s resolved against the theme file's directory and an asset: URL it wrote removed
- [ ] #6 Under a theme other than mallow's slide theme a deck's size takes the theme's @size entry, and a size with no entry is reported
- [ ] #7 kinari's draft, placed in the slide theme folder under another name, draws in both colour modes and serves size: 4:3 from its @size entry
- [ ] #8 Both preferences reach every window, and every new label reaches the reader in ja and en
- [ ] #9 pnpm lint, pnpm build and pnpm test pass; @theme and @size parsing, the name rules and the preference fallback are unit-tested
- [ ] #10 AGENTS.md (en/ja) and README (en/ja) describe the slide theme folder and state that a folder theme's CSS is walked and contained as a deck's CSS is
<!-- AC:END -->
