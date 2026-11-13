---
id: TASK-60
title: >-
  Keep a code block legible on a slide whose code ground is not the drawn mode's
  side
status: To Do
assignee: []
created_date: '2026-11-13 23:05'
labels:
  - bug
dependencies: []
references:
  - src/styles/slides.scss
  - src/lib/deck.ts
  - src/slide-themes/kinari.css
  - >-
    backlog/decisions/decision-19 -
    Let-a-deck-choose-its-slide-theme-from-mallows-a-bundled-kinari-and-a-slide-theme-folder-with-a-default-theme-preference-for-decks-that-name-none.md
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a kinari slide with the `invert` class, a code block's tokens are drawn for the wrong side of the paper and are close to unreadable (v0.14.0): in Light mode the slide and its code ground are dark while the tokens keep github-light's colours, so `console.log(…)` is near-black on near-black; in Dark mode the slide is light and the tokens are github-dark's pale colours on a pale ground.

**Why the colours are what they are.** mallow highlights code with Shiki for decks too (decision-18 — the deck renderer is built by the preview's factory), so every token carries an inline github-light colour and a `--shiki-dark` value, and `slides.scss` swaps to the dark one under the app's `on-dark` rule. decision-19 §5 settled exactly that: *code blocks keep following the drawn mode whatever the theme*. Two things meet that rule here:
- **kinari's code ground follows the slide, not the mode.** Its `pre` background is `--kinari-code-ground`, and `section.invert` swaps every `light-dark()` pair, so on an inverted slide the ground is the other side's while Shiki's tokens stay on the drawn mode's side. mallow's own theme does not hit this, because its `pre` keeps `--color-surface` under `invert`; a folder theme with a dark `pre` in Light mode would hit it with no `invert` at all.
- **kinari's own token palette never applies.** kinari colours the highlight.js classes (`.hljs-keyword`, `.hljs-string`, …) that Marp CLI and the VS Code extension emit; Shiki emits none, so `--kinari-code-keyword` and its siblings are unused in mallow. That is by design on kinari's side (decision-19 §7: the hljs colours are for Marp's own tools), so **nothing here is a change to the kinari repository**.

So decision-19 §5 is the thing to amend: the rule was written without `invert` in view, and "follow the drawn mode" is only right while the theme's code ground follows the drawn mode too.

Directions to weigh at the start, none chosen:
- Pick Shiki's side per code block from the slide rather than from the app — e.g. from the computed colour of the `pre` ground after Marpit's CSS applies — so a token's side follows the ground it sits on, under any theme.
- Give themes a way to state their code side (a class or custom property mallow reads), which is a new contract decision-19 §5 says mallow does not offer today.
- Emit highlight.js-compatible classes for decks so a theme's own palette applies. decision-18 rejected statically importing highlight.js (1.0 MB) and this would be a second highlighter, so it needs a reason the other two lack.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Under kinari, a code block on an invert slide is legible in Light and Dark modes, with its tokens drawn for the side of its ground
- [ ] #2 Code blocks on ordinary slides under kinari and mallow's theme look as they do now
- [ ] #3 decision-19 §5 is amended to say what decides a code block's side under a theme
- [ ] #4 No change is made to mallow's copy of kinari, and no highlighter is added unless the amended decision gives the reason
- [ ] #5 Checked on the three WebViews in both modes
<!-- AC:END -->
