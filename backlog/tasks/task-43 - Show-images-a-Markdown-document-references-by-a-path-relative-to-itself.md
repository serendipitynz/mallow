---
id: TASK-43
title: Show images a Markdown document references by a path relative to itself
status: To Do
assignee: []
created_date: '2026-10-29 20:32'
labels:
  - feature
  - 決定先行
dependencies: []
references:
  - src/lib/markdown.ts
  - src/components/MarkdownView.tsx
  - src/lib/html-doc.ts
  - src/lib/path.ts
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Markdown document cannot show an image that sits beside it. `![logo](media/logo@2x.png)` in `_sandbox/samples/foo.md` renders as `<img src="media/logo@2x.png">` unchanged, and the WebView resolves that against the app's own URL (`tauri://localhost/…`, or the Vite dev URL), so the image is broken. A path starting with `/` fails the same way, and `file:` is dropped by markdown-it's `validateLink` before an `<img>` is emitted at all. The rendered HTML view already solves this for its own documents: `lib/html-doc`'s `RefResolver` resolves a reference against the document's directory (`lib/path`'s `dirname` / `resolvePath`) and hands it to `convertFileSrc`. Nothing does the same for Markdown. Remote `http(s)` images already load and stay as they are.

The fix touches a security statement that is currently false. README "Security" and AGENTS.md both say a Markdown document cannot emit an `asset:` reference because markdown-it's link validation blocks that scheme. It does not: `validateLink` refuses only `vbscript:`, `javascript:`, `file:` and non-image `data:`, so `![x](asset://localhost/%2F…)` comes out as a live `<img src="asset://…">`, and `img-src` allows `asset:`. What such a reference can reach is limited to folders `allow_media_dir` has already granted, but the documented boundary ("media only loads for files chosen in the tree") does not hold today. So this starts with a decision, not with code: either the app keeps sole authorship of `asset:` URLs in Markdown (a document-written `asset:` is refused, and only paths the app rewrote become one), or a document-written `asset:` URL is accepted, and the boundary text is rewritten to say so. Either way the docs have to match the result.

Scope is images written with Markdown image syntax. A link to a local file (`[x](other.md)`) is out of scope, and so is raw HTML `<img>`, which `html: false` keeps escaped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision records whether a Markdown document may write an asset: URL itself, and how a path starting with / and a Windows drive path are treated
- [ ] #2 An image written as a path relative to the document (media/x.png, ./x.png, ../x.png, a percent-encoded name, an angle-bracketed name with a space) shows in the preview on macOS, resolved against the document's own directory
- [ ] #3 A path that cannot be read (missing file, or outside every granted folder) shows as a broken image and breaks nothing else in the document
- [ ] #4 The image is on the paper from Print and Export as PDF on macOS
- [ ] #5 README Security and AGENTS.md describe the asset: boundary as the decision leaves it
- [ ] #6 lib/markdown stays free of Tauri APIs, and the rewriting is covered by unit tests
- [ ] #7 pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
