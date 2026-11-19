---
id: TASK-71
title: Stop linking bare file names whose extension spells a country-code TLD
status: To Do
assignee: []
created_date: '2026-11-19 20:43'
labels:
  - bug
dependencies: []
references:
  - src/lib/markdown.ts
  - src/lib/markdown.test.ts
priority: medium
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A file name written bare in a Markdown document — `README.md`, `AGENTS.ja.md`, `main.rs`, `build.sh`, `setup.py` — is rendered as a link to `http://README.md` and so on, and clicking it opens that address in the OS browser. Found through TASK-68's status bar (2026-11-20), which shows the destination; the behaviour itself predates it.

**Cause.** `lib/markdown` turns on linkify-it's `fuzzyLink` on purpose (ba4d015: linkify-it 6 stopped linking a schemeless `example.com` / `www.example.com`, and earlier mallow linked them). A fuzzy link is accepted for a fixed TLD list plus **every two-letter country code**, so an extension that happens to be one is read as a domain: `.md` (Moldova), `.rs` (Serbia), `.sh` (Saint Helena), `.py` (Paraguay). `index.ts` and `app.js` are not linked, since `ts` and `js` are not country codes.

**The two obvious switches each take more than this** (the first two rows measured against markdown-it 15 / linkify-it 6 on 2026-11-20; the third is what the proposed rule is meant to give):

| Change | `README.md` | `www.example.jp` | `example.com` |
|---|---|---|---|
| `fuzzyLink: false` | not linked | not linked | not linked |
| `linkify.tlds(<default list>)` (drops all country codes) | not linked | not linked | linked |
| filter below (proposed) | not linked | linked | linked |

**Proposed rule.** Refuse a fuzzy match — one written with no scheme — that does not start with `www.` and whose TLD is in a short list of country codes that are also common file extensions (at least `md`, `rs`, `sh`, `py`; the list is settled at the start). Everything written with a scheme stays as it is. The price is that a real site under such a TLD written bare (`docs.example.md`) is no longer linked; `www.` or a scheme brings it back.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The rule and its list of excluded TLDs are settled at the start and recorded in the task
- [ ] #2 Bare README.md, AGENTS.ja.md, main.rs, build.sh and setup.py in a document are not linked
- [ ] #3 example.com, www.example.com, example.jp and www.example.jp are still linked, and anything written with a scheme (http://README.md included) is linked as before
- [ ] #4 markdown.test.ts covers both sides, and the excluded list lives in one place with the reason beside it
<!-- AC:END -->
