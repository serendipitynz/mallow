---
id: TASK-41
title: Give the Dracula family its light side (Alucard)
status: To Do
assignee: []
created_date: '2026-09-28 08:00'
updated_date: '2026-10-01 20:34'
labels:
  - feature
milestone: m-5
dependencies:
  - TASK-40.2
references:
  - src/lib/color-choice.ts
  - index.html
  - src/styles/_vars.scss
  - src/styles/global.scss
  - ../snz-design
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-40.2 the colour is two choices, a family and a light / dark mode (snz-design doc-7 §4). Dracula is one of the two families that carry only a dark side, so on Dracula the mode menu and the settings select disable Light and Auto (OS) with a reason. The Dracula project publishes an official light variant, Alucard; this task gives the Dracula family that light side, so that Light and Auto (OS) become choosable there.

Nord stays dark only: it has no official light variant (owner, 2026-09-28).

Where the change lands: a family's sides are one table in `lib/color-choice.ts` (`SIDES`) and one in the bootstrap in `index.html`, and the two copies move together; the palette is a new block beside `theme-dracula` in `_vars.scss`, selected in `global.scss` on the family and the mode attributes. Take Alucard's values from the Dracula project's official specification and name the source and version in the comment, since the values are not mallow's own.

A behaviour change to settle while starting: a stored mode the family could not draw was kept rather than rewritten (doc-7 §4.2), so an install that chose Dracula while its mode was Auto (OS) or Light has that mode stored. Once Dracula has both sides that stored mode takes effect, and such an install opens in Alucard on a light OS without the reader choosing again. This is doc-7 §4.2 working as designed, but it is a visible change and should be accepted or handled deliberately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Dracula family draws Alucard as its light side and Dracula as its dark side; Light and Auto (OS) are choosable on Dracula in both the mode menu and the settings modal, and Nord stays dark only with its reason
- [ ] #2 The sides table in lib/color-choice.ts and the copy in index.html agree, and unit tests cover Dracula resolving to light and dark
- [ ] #3 Every stored value opens as before or as the reading rule now decides: the pre-split 'dracula' still opens Dracula dark, and the stored Dracula + Auto (OS) / Light case is handled as decided when starting, with that decision recorded in Implementation Notes
- [ ] #4 Alucard's palette values come from the official Dracula specification, cited with its source; text, code and mermaid rendering are checked in Alucard, and the print paper stays Standard Light
- [ ] #5 AGENTS.md / AGENTS.ja.md and README describe Dracula as two-sided and Nord as dark only
- [ ] #6 pnpm test, pnpm lint and pnpm build pass
<!-- AC:END -->
