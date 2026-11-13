---
id: TASK-52.2
title: Bundle a kinari release as mallow's copy and measure it on the three WebViews
status: To Do
assignee: []
created_date: '2026-11-13 00:15'
updated_date: '2026-11-13 00:19'
labels:
  - feature
dependencies:
  - TASK-52.1
references:
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
  - src/styles/snz-tokens.css
  - src/lib/deck.ts
parent_task_id: TASK-52
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bundles kinari as decision-19 §7 settles it: mallow's copy of one kinari release, registered under the reserved name `kinari`, and measured where mallow runs. **This task waits for kinari's first release** from the kinari repository, which is outside mallow's ledger; it also depends on TASK-52.1, which reserves the name and builds the theme set the copy joins.

kinari itself — its palette, its layout, its README, its licence, its highlight.js colours for Marp's own tools — is changed in the kinari repository and nowhere else. A change mallow needs in it is made there and arrives with the next release; mallow's copy is never edited by hand.

What has to be done:
- **Copy a release into mallow's tree** as mallow's copy of kinari: its first line names the release it came from, it is updated from a release in a commit of its own (the rule `src/styles/snz-tokens.css` follows), and it is read as text and registered under `kinari`. Where in `src/` it lives, and how the version line is checked, is this task's to settle — snz-design's `vendor.mjs verify` is the model, not a requirement.
- **Check the release against what decision-19 §7 takes from it**: colours as `light-dark()` pairs, the `@supports not (color: light-dark(#000, #fff))` block giving its light side, `@size` entries for `16:9` and `4:3`, and nothing `walkDeckCss` would remove. A release missing one goes back to the kinari repository rather than being patched here.
- **Measure on a built app** (`pnpm tauri build --debug --no-bundle`), on macOS, Windows and Linux: kinari follows the drawn mode in the Slides view and in a presentation, a mode switch while a deck is shown included; its paper texture draws with no seam; and where an engine lacks `light-dark()`, the `@supports` block gives the light side.
- **AGENTS.md (en/ja)**: the kinari repository joins snz-design as a project mallow may name as an origin, in the same sentence, and mallow's copy of kinari joins the vendored copies that are never edited by hand.
- **THIRD-PARTY-NOTICES.md**: whether mallow's copy needs a line follows from the licence the kinari repository chose (decision-19 Consequences); if it does, the line is added by hand beside the generator.
- **README (en/ja)**: kinari is named as a theme a deck can ask for with `theme: kinari`, with a pointer to its repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 mallow's copy of a kinari release is in the tree, its first line names the release, and it is registered under kinari
- [ ] #2 The release carries what decision-19 §7 takes from it: light-dark() colours, the @supports fallback to its light side, @size entries for 16:9 and 4:3, and nothing walkDeckCss would remove
- [ ] #3 A deck naming kinari, or one drawn with the default-theme preference set to kinari, follows the drawn mode in the Slides view and in a presentation
- [ ] #4 On a built app on macOS, Windows and Linux, kinari follows a mode switch while a deck is shown and its paper texture shows no seam; the results are recorded in the task
- [ ] #5 AGENTS.md (en/ja) names the kinari repository beside snz-design and lists mallow's copy of kinari among the copies never edited by hand; README (en/ja) names kinari and its repository
- [ ] #6 Whether THIRD-PARTY-NOTICES.md needs a line for kinari is settled from its licence and recorded in the task
- [ ] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
