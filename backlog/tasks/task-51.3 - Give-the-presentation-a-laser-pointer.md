---
id: TASK-51.3
title: Give the presentation a laser pointer
status: To Do
assignee: []
created_date: '2026-11-11 01:30'
labels:
  - feature
dependencies:
  - TASK-51.2
references:
  - src/components/MarkdownView.tsx
parent_task_id: TASK-51
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While presenting (TASK-51.2), the presenter can switch the mouse cursor to a laser pointer: a bright dot that follows the pointer over the slide, with the system cursor hidden while it is on. It is drawn over the slide by the app and never touches the slide's own DOM, so the slide does not re-render as the pointer moves.

To settle at the start: how it is switched on (a key such as L as a toggle, holding a key or the mouse button, or both), its colour and size against both light and dark slides, and whether it leaves a short fading trail. The pointer is off when a presentation starts and is turned off when it ends.

It is a mouse feature: on a touch screen or with no pointer movement there is nothing to show, and that is acceptable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 During a presentation the laser pointer can be switched on and off, and while on, a dot follows the pointer over the slide with the system cursor hidden
- [ ] #2 The dot stays visible against both light and dark slides
- [ ] #3 Moving the pointer does not re-render or mutate the slide's DOM
- [ ] #4 The pointer is off when a presentation starts and when it ends
- [ ] #5 How it is switched on is shown to the reader (a tooltip or the presentation's help), in both ja and en
<!-- AC:END -->
