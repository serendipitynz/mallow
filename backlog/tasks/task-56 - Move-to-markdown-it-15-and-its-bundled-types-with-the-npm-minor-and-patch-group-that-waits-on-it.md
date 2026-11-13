---
id: TASK-56
title: >-
  Move to markdown-it 15 and its bundled types, with the npm minor-and-patch
  group that waits on it
status: To Do
assignee: []
created_date: '2026-11-13 10:04'
labels:
  - chore
dependencies: []
priority: medium
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two Dependabot pull requests fail the frontend type check and cannot be merged alone (checked 2026-11-13):

- **PR #110** moves markdown-it 14.3.3 → 15.0.3. markdown-it 15 ships its own types, and `MarkdownIt` is now a value that cannot be used as a type: `src/lib/markdown.ts` (the plugin functions taking `md: MarkdownIt`, `createMarkdownIt`'s return type) and `src/lib/deck.ts:176` fail with TS2749, and the renderer-rule callbacks lose their parameter types (TS7006).
- **PR #116** (the npm minor-and-patch group) carries @shikijs/markdown-it 4.3.0 → 4.6.0, whose types are written against markdown-it 15's. Against mallow's `@types/markdown-it` 14.1.2, `md.use(fromHighlighter(...))` at `src/lib/markdown.ts:370` fails with TS2769 (`Ruler<RuleInline>` vs `Ruler<[StateInline, boolean], boolean>`). The same group also carries unrelated updates (react 19.3, @biomejs/biome 2.6, @types/node, sass, yaml, markdown-it-emoji 3.1).

markdown-it-anchor 10.1 (PR #109, merged) already supports markdown-it 15 and makes `@types/markdown-it` an optional peer.

What moves together: markdown-it 15, the removal of `@types/markdown-it` (and `src/shims.d.ts`'s `PluginWithOptions` import, the `markdown-it/lib/token.mjs` type import, and `markdown-it-emoji`'s data import, each checked against 15's exports), @shikijs/markdown-it and shiki 4.6, and the type fixes in `lib/markdown` and `lib/deck`. Whether markdown-it-github-alerts and markdown-it-emoji type-check against 15 is checked here too.

**Behaviour is the risk, not the types.** `lib/markdown` carries the untrusted-Markdown boundary (`html: false`, `validateLink`, the local-image rule, the emoji shortcode table) and its test suite covers it; markdown-it 15's changelog is read for anything that changes rendering, link validation or the token stream those rules read. `lib/deck` builds Marpit on a second markdown-it instance, so Marpit's own markdown-it range is checked as well.

The rest of PR #116 may be split off and merged first if it is green without the shiki half.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 markdown-it is on 15.x, @types/markdown-it is removed, and pnpm build type-checks with no casts added to paper over the new types
- [ ] #2 @shikijs/markdown-it and shiki are on 4.6 (or the release the npm group then offers), and PR #110 and PR #116 are closed or superseded by this work
- [ ] #3 markdown-it 15's changelog is read for changes to rendering, link validation and the token stream, and anything that touches the untrusted-Markdown boundary or the deck's Marpit instance is recorded with what was checked
- [ ] #4 pnpm lint, pnpm build, pnpm test (the markdown suite's security-boundary tests included) and the paper job pass
- [ ] #5 On one platform by hand: a markdown document with code, mermaid, task lists, emoji and custom emoji, alerts, a local image and a Marp deck render as before
<!-- AC:END -->
