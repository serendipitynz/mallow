---
id: decision-17
title: >-
  Resolve a Markdown image's path against the document's own directory, and keep
  asset: URLs the app's to write
date: '2026-10-29 21:47'
status: accepted
---
## Context

TASK-43: a Markdown document cannot show an image that sits beside it.
`![logo](media/logo.png)` is emitted as `<img src="media/logo.png">`, which the
WebView resolves against the app's own URL, so the image is broken. The rendered
HTML view solved the same problem for its own documents in TASK-5.1:
`lib/html-doc`'s `rewriteRef` resolves a document-relative reference against the
document's directory and hands it to `convertFileSrc`. Nothing did the same for
Markdown.

**The documented boundary for local media was false before any of this.** README
"Security" and AGENTS.md said a Markdown document cannot emit an `asset:`
reference because markdown-it's link validation blocks that scheme. It does not:
the default `validateLink` refuses `javascript:`, `vbscript:`, `file:` and
non-image `data:` and nothing else. Measured against the pinned markdown-it
(2026-10-30), these are the `src` values it emits:

| written in the document | `src` emitted |
|---|---|
| `![a](media/logo@2x.png)` | `media/logo@2x.png` |
| `![a](<my pic.png>)` | `my%20pic.png` |
| `![a](日本語.png)` | `%E6%97%A5%E6%9C%AC%E8%AA%9E.png` |
| `![a](/abs/x.png)` | `/abs/x.png` |
| `![a](C:\dir\x.png)` | `C:%5Cdir%5Cx.png` |
| `![a](C:/dir/x.png)` | `C:/dir/x.png` |
| `![a](asset://localhost/%2Ftmp%2Fx.png)` | `asset://localhost/%2Ftmp%2Fx.png` |
| `![a](http://asset.localhost/x.png)` | `http://asset.localhost/x.png` |
| `![a](file:///tmp/x.png)` | no image — dropped by `validateLink` |

`img-src` carries `asset:` and `http://asset.localhost`, so the two `asset` rows
are live images today. What they can reach is bounded by the asset-protocol
scope, which holds only the folders `allow_media_dir` has granted in this
process: every folder a window has opened, and the custom emoji folder.

**Resolving relative paths makes that reach available without `asset:` at
all.** `resolvePath` lets `..` climb to the filesystem root, deliberately (its
own comment says the grant decides what is readable), so enough `../` reaches
any granted folder. Whether a document may write `asset:` itself therefore does
not change *what* it can reach once this task lands. It changes two other
things: whether the boundary can be stated as one sentence about who authors the
URL, and whether a document can carry a URL whose spelling is mallow's internal,
per-platform one (`asset://localhost/…` on macOS and Linux,
`http://asset.localhost/…` on Windows).

## Decision

### 1. mallow alone writes the `asset:` URLs in a rendered Markdown document

An image whose `src`, as markdown-it emits it, has the `asset:` scheme or the
host `asset.localhost` (under any scheme) is **refused**: the `<img>` is emitted
without a `src`, so it shows as a broken image and keeps its alt text. Every
`asset:` URL a rendered Markdown document loads is one mallow built from a path
by the rule in §2.

Accepting them was the alternative, and it would reach nothing more (see
Context). It was rejected because the URL is an implementation detail with a
different spelling per platform — a document carrying one works on the machine
that wrote it and nowhere else — and because a boundary stated as "only what
mallow wrote" can be checked against one function, while "anything inside a
granted folder" has to be re-argued every time the set of grants changes.

This covers images only. A link (`[x](asset://…)`) loads nothing, and
`MarkdownView`'s click handler already makes every non-`http(s)` link inert.

### 2. Only a path relative to the document is resolved

The rule is the rendered HTML view's, and it is the same function:
`lib/html-doc`'s `classifyRef` decides which references are rewritten and
`rewriteRef` rewrites them. A `src` with no scheme that starts with neither `/`
nor `//` is percent-decoded, stripped of any query and fragment, resolved
against the document's own directory with `resolvePath`, and handed to
`convertFileSrc`. So `media/x.png`, `./x.png`, `../x.png`, a percent-encoded
name and an angle-bracketed name with a space all resolve, and `..` past the
opened folder is not special-cased: the asset-protocol scope decides whether the
file can be read, and a path outside every granted folder is a broken image like
a missing file.

**Absolute paths are left as written**, which makes them broken images:

- **A path starting with `/`** is not resolved against the filesystem root or
  against the opened folder. Either reading is right for some documents and
  wrong for others — GitHub and VS Code take the repository root, editors such
  as Typora write filesystem paths — and the HTML view already leaves it alone
  for the reason its `classifyRef` comment gives.
- **A Windows drive path** (`C:\…`, `C:/…`) reads as a URL with the scheme `C:`,
  so it falls under the same "explicit scheme, left alone" branch as any other
  scheme. It is not special-cased into a filesystem path.
- **A UNC path** cannot be written as an image destination without escaping
  each backslash, and what markdown-it emits for one (`%5Cserver%5C…`) is a
  relative-looking name. It is resolved under the document's directory like any
  other relative name, so it never reaches a share.

`http(s)` images, protocol-relative `//host/…` and `data:` images are untouched,
as they were.

### 3. `lib/markdown` takes the resolver as an argument

`renderMarkdown` gains an optional resolver of the HTML view's shape
(`{ dir, toAssetUrl }`), and `MarkdownView` supplies it with `convertFileSrc`.
The rewriting happens in the `image` render rule through markdown-it's per-render
`env`, so the cached MarkdownIt instance is not rebuilt per document, and
`lib/markdown` still imports no Tauri API. Without a resolver relative paths are
left as written; the refusal in §1 applies either way.

## Consequences

- README "Security" and AGENTS.md describe the boundary as §1 and §2 leave it,
  replacing the claim that link validation blocks `asset:`.
- A document that relied on writing an `asset:` URL itself stops showing that
  image. No such document is known; the spelling was never documented.
- The HTML view is unchanged: a document-written `asset:` URL inside rendered
  HTML still loads, because decision-3 gives that view no sanitizer and its
  containment is the frame. This decision does not extend §1 to it.
- A document using `/`-rooted image paths still shows broken images. Revisiting
  that means choosing a root, which is a new decision rather than an amendment of
  this one.
