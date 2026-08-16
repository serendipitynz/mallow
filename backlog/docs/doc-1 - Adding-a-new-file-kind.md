---
id: doc-1
title: Adding a new file kind
type: guide
created_date: '2026-07-30 08:57'
---

Every task that adds a viewable file kind touches the same seven places. Scope
limits on which kinds get added are in decision-2.

1. **[src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)** — `file_kind`,
   plus the unit tests that pin the mapping. A file with no dot in its name is
   rejected here by design.
2. **[src/lib/file.ts](../../src/lib/file.ts)** — `kindFromName`. **This
   duplicates the Rust mapping and must stay in sync.** It mirrors `file_kind`'s
   `None` as `null` for an unmapped extension, so `fileEntryFromPath` returns
   `FileEntry | null` and its caller has to handle "no kind" — a new entry here
   is therefore always a `case`, never a change to the `default` branch.
3. **[src/lib/types.ts](../../src/lib/types.ts)** — the `FileKind` union.
4. **[src/components/Viewer.tsx](../../src/components/Viewer.tsx)** — the switch
   in `ViewerBody`. Note `isMediaKind` above it: media kinds skip the text read
   entirely, so a new kind that reads bytes rather than text belongs there instead.
   A kind whose name is also a Shiki grammar id needs no kind→lang table: the
   `text` / `ini` / `diff` / `sql` case passes `file.kind` through as `lang`.
   `.doc` has no top padding of its own, so a view rendered without a `.doc__bar`
   adds `doc--no-bar` to get the same top spacing.
5. **[src/components/FileTree.tsx](../../src/components/FileTree.tsx)** —
   `FileKindIcon`. Optional rather than required: its `default` branch already
   returns `FileTextIcon`, so a new kind without an entry shows a text icon
   instead of breaking. Decide whether it deserves its own icon; if it does, copy
   Lucide path data inline rather than adding `lucide-react`.
6. **[src/lib/i18n.tsx](../../src/lib/i18n.tsx)** — new keys in **both** the `ja`
   and `en` dictionaries.
7. **[src-tauri/tauri.conf.json](../../src-tauri/tauri.conf.json)** — the CSP,
   only when a kind actually requires it. None of the currently planned tasks do.

Verify with `pnpm build`, `pnpm test`, and `cargo check` / `cargo test` inside
`src-tauri/`. Unit tests live next to the code and run under a Node environment,
so browser APIs (`DOMParser`, `document`) are unavailable in tests — keep those
calls at the component boundary and test the pure transform.

**There is no CSP under `pnpm tauri dev` on desktop.** `set_csp` runs only when
Tauri serves the assets (`manager/mod.rs:442`), the dev webview loads the Vite
`devUrl` directly (`PROXY_DEV_SERVER` is `cfg!(all(dev, mobile))`), `index.html`
has no CSP `<meta>`, and `devCsp` is unset. Anything whose containment or behavior
depends on the CSP has to be checked in a built app — in dev it is simply absent,
which makes a broken boundary look fine.

A corollary worth stating: when a kind's safety depends on how a real DOM behaves
(markup normalization, namespaces, SVG/MathML, mutation-XSS), pure-function tests
over strings cannot establish it. Either put the containment somewhere structural
that needs no such test (see decision-3, where sandbox flags and the inherited CSP
replace an allowlist), or plan a browser-environment check — do not let a passing
Node-only test read as evidence the boundary holds.

If a new kind adds a syntax-highlighted source view, check whether its grammar is
already in the `LANGS` list in [src/lib/shiki.ts](../../src/lib/shiki.ts);
unlisted languages fall back to plain text.

Two constraints apply to every text-reading kind, both from
[read_file](../../src-tauri/src/commands.rs):

- It is UTF-8 only, and a file that fails to decode comes back as a typed
  `ReadError` the frontend branches on — `invalidUtf8`, `binary`, `tooLarge` or
  `io` (decision-5). A new kind gets the encoding and binary messages for free;
  it needs work here only if it wants wording of its own. `readFile` resolves a
  discriminated result rather than rejecting, so a new caller cannot skip the
  failure branch. Which *encodings* are in scope is still decision-2's answer:
  none beyond UTF-8.
- The UTF-8 BOM is stripped in `read_file`, so a new parser must not strip it
  again.
- The 10 MiB cap bounds bytes, not work. A file well inside it can still stall the
  WebView once it is highlighted or expanded into DOM. The source view is bounded
  for you: above the caps in
  [src/lib/source-cap.ts](../../src/lib/source-cap.ts) it drops the highlighting,
  never the content, and says so in the UI (decision-6) — so a kind routed to
  `SourceView` needs no size check of its own, and any view may name it as its
  fallback. Every *other* way of expanding a document into DOM still needs its own
  ceiling: the config tree has one, and the CSV table and HTML renderer must get
  theirs.
