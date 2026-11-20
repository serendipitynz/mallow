---
id: TASK-71
title: Stop linking bare file names whose extension spells a country-code TLD
status: Done
assignee: []
created_date: '2026-11-19 20:43'
updated_date: '2026-11-20 05:26'
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
- [x] #1 The rule and its list of excluded TLDs are settled at the start and recorded in the task
- [x] #2 Bare README.md, AGENTS.ja.md, main.rs, build.sh and setup.py in a document are not linked
- [x] #3 example.com, www.example.com, example.jp and www.example.jp are still linked, and anything written with a scheme (http://README.md included) is linked as before
- [x] #4 markdown.test.ts covers both sides, and the excluded list lives in one place with the reason beside it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 除外 TLD 一覧を着手時に確定する (2026-11-20、オーナー判断で Broad): md, rs, sh, py, pl, pm, cc, mm, ml, mk, am, tf, ps, in, ac, ai, so。
2. lib/markdown の createMarkdownIt で md.linkify.match をラップし、schema が空 (スキームなしのリンク) で host が www. で始まらず、TLD が一覧にある match を落とす。スキーム付きは inline ルール (matchAtStart) と core ルールの schema 付き match のどちらも触らない。スキームなしのメール (mailto:) も対象外。
3. 一覧は markdown.ts の定数 1 か所に理由を添えて置く。デッキも createMarkdownIt を通るので同じ規則が効く。
4. markdown.test.ts に両側 (リンクされないファイル名 / リンクされ続けるドメインとスキーム付き) のテストを足す。
5. pnpm lint / build / test。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**確定した規則と一覧 (AC#1, 2026-11-20 オーナー判断)**: スキームなしで書かれたリンク (linkify-it の match で schema が空) のうち、ホストが `www.` で始まらず、TLD が次の一覧にあるものはリンクにしない。一覧は Broad 案の 17 個: ac, ai, am, cc, in, md, mk, ml, mm, pl, pm, ps, py, rs, sh, so, tf。タスクが挙げた 4 個に、リポジトリでよく見る拡張子 (Perl / C++ / Objective-C++ / OCaml / make / automake / Terraform / PostScript) と、ドメインとしても使われる in / ac / ai / so を足した。代償として `example.in` や `example.ai` をスキームなしで書くとリンクにならない。`www.` かスキームを付ければリンクになる。

**実装**: `createMarkdownIt` で `md.linkify.match` をラップして該当する match を落とした。markdown-it 15 でスキームなしのリンクを拾うのは core の linkify ルールだけで、それは `match()` しか呼ばない。inline ルールは `://` のあとで `matchAtStart()` を呼ぶので、スキーム付きのリンクは経路ごと影響を受けない。`linkify.tlds(<既定>)` で国別コードを落とす案は `www.example.jp` までリンクされなくなるので採らなかった (タスクの表)。スキームなしのメール (`user@example.md`, schema `mailto:`) は対象外で、リンクのまま残る。Marp デッキも同じ `createMarkdownIt` を通るので同じ規則が効く。一覧は `FILE_EXTENSION_TLDS` の 1 か所に、各コードの拡張子としての用途と理由を添えて置いた (AC#4)。

**検証**:
- AC#2: README.md, AGENTS.ja.md, main.rs, build.sh, setup.py と、一覧の残り 13 コードそれぞれのファイル名、大文字の NOTES.MD、`README.md#usage`、`README.md:12` がリンクにならないことを markdown.test.ts で確認した。
- AC#3: example.com, www.example.com, example.jp, www.example.jp, www.example.md, http://README.md, https://example.md/x がリンクのまま残ること、ファイル名の直後のドメインも同じテキストの中でリンクになることを確認した。
- フィルタを外すと新しいテストが 2 件落ちることを確認した。
- `pnpm mutation --since main`: 差分内の変異は全部 kill (100%)。最初の実行で一覧の各コードと schema 判定の変異が生き残ったので、全コードのファイル名とスキームなしのメールのテストを足した。
- `pnpm lint` / `pnpm build` / `pnpm test` (746 件) はすべて通った。

**未確認**: 実機のアプリでの表示とリンクステータスの表示は見ていない。描画結果は単体テストでの確認のみ。
<!-- SECTION:NOTES:END -->
