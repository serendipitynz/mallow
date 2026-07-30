---
id: decision-2
title: >-
  Keep file-kind support scoped: no Office documents, no source code, no
  extensionless files
date: '2026-07-30 08:57'
status: accepted
---
## Context

Expanding the set of viewable file kinds raises the question of where support
stops. Three candidate groups were evaluated and each is declined for a different
reason, recorded here so they are not re-litigated per task.

`read_dir_tree` filters files by an allowlist of extensions, so anything not
mapped by `file_kind` simply does not appear in the tree — declining a group is
the default state, not extra work.

## Decision

### Office documents are out of scope

Not planned in any format — neither OOXML (docx / xlsx / pptx) nor the legacy OLE
formats (doc / xls / ppt).

- `read_file` returns UTF-8 text only, so a bytes-returning command would have to
  be added.
- The 10 MiB read cap is exceeded by real-world Office files with embedded images.
- Every conversion route needs a large new production dependency, against
  mallow's stated "lightweight" positioning (`bundle.shortDescription`).
- pptx has no usable OSS renderer, and docx→HTML loses the column layout, figure
  placement, and pagination that make those documents worth opening at all.

xlsx was the one candidate with an acceptable cost/benefit ratio (a read-only
grid), and is still declined for the dependency reason.

mallow has no answer for these files, and that is the accepted outcome — not
"open them with the OS viewer instead". Two things make that phrasing false:
`file_kind` keeps unsupported extensions out of the tree, so such a file cannot
be selected in the first place, and `OpenWith.tsx` offers only detected editors
plus reveal-in-OS, with no "open with the default application" action at all
(`capabilities/default.json` grants `opener:default`, which does not include
`open_path`). Users go to Finder or Explorer for these files, outside mallow.

### Source-code files are out of scope for now

Adding `ts` / `js` / `py` / `rs` / `go` / `sh` costs almost nothing technically —
the Shiki grammars are already bundled and `SourceView` already renders them. It
is declined because it changes what mallow *is*: a Markdown and config-file
viewer becomes a code viewer, which is a product decision to make deliberately
rather than a side effect of adding extensions. Revisit as its own decision.

### Extensionless files are out of scope

`Makefile`, `Dockerfile`, and `LICENSE` stay filtered out: `file_kind` requires a
dot in the name, and its unit tests pin that behavior. Supporting them needs a
separate name-based mapping table, duplicated on the frontend side like the
extension mapping already is.

Dotfiles are a different case and the dot rule does not explain them. `.gitignore`
*does* contain a dot, so `file_kind` treats `gitignore` as its extension and
excludes it only because that extension is not mapped. The same mechanism works in
reverse: `.editorconfig` yields `editorconfig`, which TASK-1 *does* map, so it
appears in the tree and opens — intentionally. Dotfiles are in scope exactly when
their trailing segment is a mapped extension.

### Non-UTF-8 text is out of scope

`read_file` is `fs::read_to_string`, so a file that is not valid UTF-8 fails to
read at all and `Viewer.tsx:86-95` surfaces the raw decoding error. Decoding other
encodings would mean a new production dependency, so it is declined for now — but
the two cases where this bites are common enough that the tasks must handle them
as *messages*, not as raw errors:

- CSV exported by Excel in Japan is usually CP932 (TASK-3).
- `.plist` on macOS is usually a binary plist (TASK-4).

Requirement for both: say what the file is and why it cannot be shown. A UTF-8 BOM
must also be stripped, or it leaks into the first CSV header cell and ahead of the
XML declaration.

## Consequences

- The extension allowlist stays explicit. A catch-all "show any unknown extension
  as text" rule is specifically not adopted: it would fill the tree with noise in
  any folder containing build output or `node_modules`.
- Each newly supported kind keeps costing the same set of touch points enumerated
  in doc-1, so the allowlist growing slowly is intended rather than a backlog of
  neglect.
