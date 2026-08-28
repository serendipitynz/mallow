# AGENTS.md

> 日本語: [AGENTS.ja.md](AGENTS.ja.md)

Guidance for agents and contributors working in this repository. **mallow** is a
standalone, lightweight desktop Markdown / config-file viewer. See
[README.md](README.md) for the user-facing overview.

## Commands

```sh
pnpm install
pnpm tauri dev      # run the app with hot reload
pnpm build          # frontend type-check (tsc) + bundle (vite) — validate FE changes
pnpm test           # frontend unit tests (Vitest, run once); pnpm test:watch to watch
pnpm lint           # Biome lint + format + import-order check (no writes)
pnpm lint:fix       # apply Biome's safe fixes, sort imports, format
pnpm format         # format only
pnpm lint:ci        # what CI runs (biome ci) — non-writing, fails on errors
pnpm tauri build    # release build + bundle
./scripts/macos-sign-build.sh   # signed + notarized macOS build (needs .env.signing)
pnpm tauri icon src-tauri/icons/app-icon.png   # regenerate all app icons
pnpm notices        # regenerate THIRD-PARTY-NOTICES.md (bundled dep licenses)
pnpm release 0.4.0  # bump the version everywhere, commit, tag (--push to push)
cargo check         # run inside src-tauri/ to validate Rust
cargo test          # run inside src-tauri/ to run the Rust unit tests
cargo fmt           # run inside src-tauri/ to format Rust (--check to verify only)
```

## Stack

Tauri v2 (Rust) + Vite + React + TypeScript + SCSS. **No Tailwind.**

## Architecture

**Frontend (`src/`)**
- `App.tsx` — top-level state: open folder, selection, file-watch wiring, explorer
  width/side, session restore, settings-modal open state (footer button, the
  `menu:settings` event, and the Cmd/Ctrl+, shortcut all open it), and the
  launch update check (deferred behind session restore; the `autoCheckUpdates`
  preference turns it off).
- `hooks/useFileTree.ts` — centralized lazy file-tree state (expanded set, children
  map, `refresh`, `expandPaths`). The tree components are controlled by this.
- `hooks/useUpdater.ts` — the update check, the install consent and the relaunch
  (tauri-plugin-updater + tauri-plugin-process). Holds the `Update` handle
  between the check and the confirmation.
- `components/` — Explorer/FileTree, Viewer (routes by file kind), MarkdownView,
  ConfigView/ConfigTree, SourceView (shared, line-numbered), TableView (csv/tsv),
  XmlView/XmlTree (xml/plist/xsd/xsl), HtmlView (sandboxed srcdoc frame + source
  toggle), ErrorBanner (shared syntax-error banner), MermaidView,
  MediaView (image/pdf/video via the asset protocol), Outline, Toolbar, OpenWith,
  ThemePicker, SettingsModal, UpdateDialog (target version, consent, progress),
  icons (inlined Lucide SVGs, no runtime dependency).
- `lib/` — `markdown` (markdown-it pipeline), `shiki` (highlighter singleton +
  `stripPreBackground`), `mermaid` + `mermaid-copy` + `codeblock` (imperative DOM
  enhancements), `frontmatter`, `config-parse`, `source-cap` (source-view size
  caps), `delimited` (CSV/TSV parser + table caps), `xml-tree` (XML DOM → bounded
  tree model + parse-error text), `html-doc` (HTML markup transform + render
  caps), `html-headings` (heading ids inside the frame), `html-notice` (which
  notice-bar lines a rendered document carries), `clip` (shared value clip),
  `custom-emoji` (user
  emoji folder →
  shortcode table), `heading` (the `Heading` type, the injected lookup root and the
  pure coordinate conversion), `scroll` (anchor preservation), `watch`, `settings`
  (plugin-store), `theme`, `i18n` (ja/en dictionary + provider/hooks; language
  persisted in localStorage), `update-flow` (the check and install states, the
  download accumulator), `file`, `path`, `tauri` (invoke wrappers), `types`.
- `styles/` — SCSS: `_vars` (palettes + `on-dark` mixin), `global`, `app`,
  `markdown`, `config`, `source`, `html`, `table`, `xml`.

**Backend (`src-tauri/src/`)**
- `commands.rs` — `read_dir_tree`, `read_file`, `path_exists`, `allow_media_dir`
  via plain `std::fs` (NOT the fs plugin), so any user-picked folder works without
  scope config. `allow_media_dir` widens the asset-protocol scope to an opened
  folder so its image/pdf/video files can be rendered via `convertFileSrc`.
- `watch.rs` — `notify` recursive watcher; emits the `fs:change` event (list of
  paths). The watcher handle lives in `WatcherState`.
- `editors.rs` — `detect_editors` / `open_in_editor` / `reveal_in_os` /
  `open_in_default_app` via `std::process`, gated per-OS with `cfg`. The last one
  hands a file to the OS handler registered for it, and is here rather than on
  tauri-plugin-opener because that plugin's path scope cannot be satisfied without
  a second runtime-scope mechanism beside `allow_media_dir` (decision-3). **On
  Windows it is `rundll32 url.dll,FileProtocolHandler`, and the two obvious
  spellings are both wrong about paths**: `explorer <file>` splits on a comma
  (measured — `a,b.html` opened an Explorer window, not the handler) and
  `cmd /C start` re-parses by `cmd`'s rules rather than the ones `Command` quotes
  for.
- `print.rs` — `print_window`, which hands the calling webview window to
  `WebviewWindow::print()` (decision-13). Named for the window because the engine
  paginates the whole `<body>`, so a name promising a document would be false at
  the boundary that matters, and a print stylesheet would not make it true. Not
  `cfg(desktop)`-gated though `print()` is, so a mobile build fails to compile
  rather than reporting a missing command at runtime.
- `lib.rs` — plugin registration (opener, dialog, store, window-state,
  updater, process — none `cfg(desktop)`-gated, per decision-11), the
  `invoke_handler`, and (macOS only) a native app menu whose Settings… item
  (⌘,) emits the `menu:settings` event the frontend listens for.

## Conventions

- SCSS only — never introduce Tailwind.
- Do not commit `src-tauri/target` (build output; already git-ignored).
- Treat mallow as an independent project — do not add references to any external
  project as its origin in code/comments/docs.
- Ask before adding new production dependencies.
- Third-party license notices (`THIRD-PARTY-NOTICES.md`) are generated by
  `pnpm notices` (`scripts/gen-third-party-notices.mjs`) and bundled into the app
  via `bundle.resources`. Regenerate after changing dependencies.

### Lint and formatting

**Biome is the only lint/format dependency, and stays that way.** One
devDependency (`biome.json` at the root) covers linting, formatting and import
order for TypeScript, TSX and JSON. Do not add Prettier or ESLint alongside it.
`cargo fmt` handles Rust from `rustfmt.toml`, and costs no dependency because
rustfmt ships with the toolchain.

The settings are chosen against the code that is already here rather than taken
from Biome's defaults, which assume tabs and double quotes: `indentStyle: space`,
`indentWidth: 2`, `lineWidth: 120`, `quoteStyle: single`, `semicolons: always`.
At those values the tracked JSON needs no reformatting at all. `rustfmt.toml`
holds `max_width` at 120 with `use_small_heuristics = "Max"` but pins
`chain_width` to 72 — the only combination that keeps the compact struct literals
*and* leaves the method chains that were broken by hand alone.

**Scope is an explicit include list plus an explicit exclude list** in
`biome.json`, so there is nothing to infer. In: `src/**/*.ts(x)` (unit tests
included), `scripts/*.mjs`, `vite.config.ts`, `vitest.config.ts`, `package.json`,
`tsconfig*.json`, `.vscode/extensions.json`. Out: `src-tauri/**` (rustfmt's, and
Biome's JSON formatter would collapse the one-per-line `icon` and `permissions`
arrays there onto single lines), plus `.scss` and `.md`. Generated output is
covered by `vcs.useIgnoreFile` reading `.gitignore`, so `dist/` and
`src-tauri/target` need no second list. `src-tauri/gen/schemas` is ignored by
`src-tauri/.gitignore` and also sits outside the include list.

**SCSS and Markdown are deliberately unformatted — this is not a
misconfiguration.** Biome lists SCSS as in progress for parsing and formatting
and not started for linting. Handing it a `.scss` file is a silent skip; renaming
one so the CSS parser takes it produces 199 parse errors on `_vars.scss` and 40 on
`global.scss`, because 1,688 lines of SCSS here use 116 `//` comments, 5 `@use`,
7 `@mixin`, 10 `@include`, 24 `$variables` and 6 `#{}` interpolations. Nothing
formatted the stylesheets before either, so this is not a regression, and Biome's
roadmap has SCSS as its most-wanted feature with work started. **Do not add
Prettier just for SCSS** — that reinstates the two-tool setup Biome was chosen to
avoid, for files nothing was formatting anyway. Markdown is in the same state and
matters less: most tracked `.md` files are backlog tasks a formatter would churn.

**stylelint was measured and rejected; do not reopen it without new evidence.**
It is a linter, not a formatter (stylistic rules were deprecated in v15 and
removed in v16), so it would not have closed the formatting gap. As a checker it
found nothing: `stylelint-config-recommended-scss` reports 1 finding across all
six files and it is a false positive (`scss/comment-no-empty` on a bare `//` line
inside an ordinary comment block). `stylelint-config-standard-scss` reports 85,
none of them defects — 62 demand kebab-case, rejecting the BEM `__element` /
`--modifier` naming used deliberately throughout; 14 want blank lines before `//`
comments; 6 want CSS keywords lowercased (font names, `optimizeLegibility`,
`currentColor`); and its `property-no-vendor-prefix` advice about
`-webkit-backdrop-filter` is actively wrong here, since this app's macOS WebView
is WKWebView. The real safety net already runs: `sass` fails `pnpm build` on an
undefined variable, a bad `@use`, or a syntax error. Revisit only if the
stylesheets grow well beyond their current size or gain a second author.

**Suppressions.** When a rule is wrong about a specific line, suppress it there
with `biome-ignore` and a stated reason rather than turning the rule off — a rule
switched off globally lets the next, unjustified case land silently. Two
mechanics are worth knowing because both cost a round to discover: a `//`
suppression only counts when the `biome-ignore` line is the one *immediately*
above the code, so multi-line reasons must use `/* … */`; and a diagnostic
reported against a JSX attribute needs the comment above that attribute, not
above the element, or the formatter re-wrapping the element will detach it.

### Coding style

**These rules bind new and changed code, not the existing tree.** Do not reshape
comments or restructure code you are not otherwise touching in order to satisfy
them — if something pre-dating the rules reads badly, say so rather than
rewriting it as a drive-by. Concretely, the doc comments that restate a
signature, the `// ---- Section ----` banners in `src/`, `scripts/` and the SCSS,
and the stale plan citations in `src/hooks/useFileTree.ts:5-7` all stay until
their surrounding code is edited for another reason.

Nothing checks the Comments or Functions rules mechanically; no linter can judge
whether a comment restates its code or whether an extraction improved anything.
They are held in review, so they are written to what a reviewer can reasonably
hold rather than as an exhaustive style guide.

**Comments** — reviewer-enforced.

- Don't write comments by default. Prefer clear naming and structure.
- Write comments in English (this applies to every language in the repo:
  TypeScript, Rust, SCSS, and the `scripts/*.mjs`).
- When a comment is warranted, prefer one that explains **why**, and where
  relevant **why not** — the reasoning behind the approach taken, including why
  an obvious alternative was rejected. `src/lib/markdown.ts:40-47` (prototype
  pollution) and `src/lib/mermaid.ts:27-32` (why not `securityLevel: 'sandbox'`)
  are the shape to copy.
- Use comments only for what the code cannot say itself: intent, constraints,
  invariants, external requirements, non-obvious trade-offs.
- Never use a comment merely to restate what the code does.
- API doc comments follow the same rule — don't document what the name, types
  and signature already convey. Document only caller-relevant contracts that
  code cannot express: behavioural guarantees, preconditions, side effects,
  error semantics, compatibility constraints.

**Control flow** — machine-enforced by Biome's `style/useBlockStatements`, at
`error`.

- Always use explicit block syntax for control-flow bodies, including where the
  language lets the braces be omitted.

**Functions** — reviewer-enforced.

- Extract a function when a block is a coherent, nameable responsibility.
- Extraction should improve abstraction, readability or testability, not merely
  reduce line count.
- Call count decides nothing in either direction: two call sites do not by
  themselves justify an extraction, and a single call site does not rule one out.
- Keep tightly coupled, trivial operations local when extracting them would cost
  locality or add indirection for nothing.

## Implementation notes / gotchas

- **The extension→kind mapping is written twice and both copies have to move.**
  `file_kind` in `commands.rs` decides which files appear in the tree at all;
  `kindFromName` in `lib/file.ts` mirrors it so a restored session can synthesize
  a `FileEntry` from a bare path. Adding a kind to one alone is not a partial
  feature but a broken state: only in Rust and the file lists but will not open,
  only in TypeScript and session restore selects a file the tree cannot show. The
  TS side mirrors Rust's `None` as `null` for that reason, which is why a new
  entry is always a `case` and never a change to the `default` branch. doc-1
  lists the seven places a kind touches; these are the first two.
- **Reading a file cannot fail with a bare string.** `read_file` returns
  `Result<String, ReadError>`, a serde-tagged enum whose `kind` is `invalidUtf8`,
  `binary`, `tooLarge` or `io` (decision-5). `readFile` in `lib/tauri.ts`
  **resolves** `{ ok: true, text } | { ok: false, error }` rather than rejecting —
  TypeScript cannot type a rejection value, so resolving a discriminated union is
  what makes `tsc` force a caller through the failure branch. The mirrored type,
  the decoder and the message selector live in `lib/read-error.ts`, which imports
  no Tauri API so it stays testable under Node. `tooLarge` and `io` print the
  backend's message verbatim; `invalidUtf8` and `binary` are worded in
  `lib/i18n`. A new binary format is one entry in `BINARY_MAGICS`. **The UTF-8
  BOM is stripped in `read_file`** — no parser downstream should strip it again.
- Markdown is rendered **at runtime in the WebView** (not at build time).
  `renderMarkdown` returns `{ html, headings }`; leading front-matter (YAML `---`
  / TOML `+++`) is extracted and shown as a key/value table.
- The markdown HTML is injected via `dangerouslySetInnerHTML`. Imperative
  enhancements (code-copy buttons, mermaid render, external-link interception) run
  in a `useEffect` keyed on `[result, mode]`. Toggling preview↔source remounts the
  article, so those enhancements must re-run — **keep `mode` in the deps.**
- **Untrusted-Markdown boundary** (so `dangerouslySetInnerHTML` stays safe — see
  README "Security"): markdown-it runs with `html: false`, so raw HTML in a
  document is escaped to text, never live DOM. markdown-it's default `validateLink`
  drops dangerous link schemes (`javascript:`, `vbscript:`, `file:`, non-image
  `data:`). The `MarkdownView` click handler only forwards `http(s)` to the OS
  browser, lets `#anchors` scroll, and makes every other scheme inert. mermaid uses
  `securityLevel: 'strict'` (NOT `sandbox`, which would iframe the diagram and break
  the SVG re-render / copy controls). A CSP in `tauri.conf.json` is the second layer:
  no `'unsafe-inline'`/`'unsafe-eval'` in `script-src` (only `'self'` +
  `'wasm-unsafe-eval'` for Shiki's WASM regex engine); `style-src` keeps
  `'unsafe-inline'` because Shiki/mermaid emit inline `style` attributes. If you add
  a dep that needs `eval`/`new Function` or fetches remote assets, the CSP must be
  revisited.
- **Untrusted-HTML boundary** (the rendered view — decision-3, amended by
  decision-9 and decision-10; see README "Security"): the document is fed to an
  iframe through `srcdoc` with `sandbox="allow-same-origin"` and deliberately
  **no** `allow-scripts`, so nothing in it executes while the parent can still
  read and drive `contentDocument` — which is what the outline, the height
  measurement and the link handling rest on. The two flags are a pair, not two
  independent choices: together they would let a document remove its own
  sandbox, and with same-origin in place a script in the frame would be a script
  in the app origin, where `read_file` is plain `std::fs` with no scope and no
  capability gating. `allow-forms`, `allow-popups` and `allow-top-navigation`
  stay off for the same kind of reason. The `srcdoc` document also inherits the
  parent CSP, and that is the second layer — **but the two are not equally
  broad, so do not write "two independent layers"**: an inline `<script>`, an
  `on*` attribute, a `javascript:` URL and a remote `<script src>` are each
  stopped by the sandbox *and* the CSP, while a relative `<script src="./x.js">`
  is stopped by **the sandbox alone**, because a `srcdoc` document resolves it
  against the app's own URL where `script-src 'self'` permits it (decision-3's
  table). **There is no element allowlist and no sanitizer.** What the transform
  removes is `<iframe>` / `<frame>` — a nested frame pointed at `asset:` would
  load a document carrying no CSP of its own, so its subresource loads would sit
  outside both the CSP and the notice-bar count — and `<base>`, which would
  redirect every reference the rewriting resolves. It also drops one attribute,
  the app-origin `href` on an `<area>` (TASK-25), which is a navigation fix and
  not a containment one — a mapped region that follows it lands on the app shell
  inside a sandboxed frame, which is a blank page rather than an escape. All
  three removals are for rendering, navigation and network reasons, not
  sanitization; `<object>` / `<embed>` need none, since `object-src 'none'`
  already covers them. **Network exposure
  remains and is accepted**: remote images load because `img-src` carries
  `https:`, and so does `url(https://…)` inside a `<style>` block or a `style`
  attribute. CSS is a side channel sandboxing does not close and DOMPurify would
  not have closed either; it is the exposure Markdown already has, so this adds
  no new class of outbound request. **Adding `allow-scripts` later is not a
  one-line change** — with `allow-same-origin` in place the failure mode is
  arbitrary local file read, not a broken widget — and needs its own decision.
- **There is no CSP at all under `pnpm tauri dev` on desktop, so that second layer
  is absent for the whole of development.** `set_csp` runs only where Tauri serves
  the assets; the dev webview loads the Vite `devUrl` directly, `index.html`
  carries no CSP `<meta>`, and `devCsp` is unset. Nothing about it is broken —
  it simply is not there, which is worse than a visible failure: a boundary that
  leans on the CSP looks fine in dev and gives way in a built app. **Anything whose
  containment depends on the CSP has to be checked against `pnpm tauri build`** —
  `--debug --no-bundle` is enough and is not a dev build. **Setting `devCsp` does
  not give dev a CSP** (TASK-7 established this): `AppManager::csp` is its only
  reader and is reached only from `get_asset`, which a desktop dev run never
  enters for the main document. A second trap sits next to it:
  `style-src`'s `'unsafe-inline'` stops applying the moment that directive gains a
  nonce or hash, and tauri-codegen adds a hash for any inline `<style>` it finds in
  `index.html` — so putting one there would break Shiki, mermaid and every inline
  `style` attribute at once. Treat that as a standing constraint on `index.html`.
- **Media (image/pdf/video)** is rendered by `MediaView` straight from disk via
  the Tauri asset protocol (`convertFileSrc` → `asset:` URL); no bytes pass through
  JS, so the 10 MiB `read_file` text cap does not apply and `Viewer` skips the text
  read for media kinds. The asset protocol needs the `protocol-asset` cargo feature
  + `assetProtocol.enable` in `tauri.conf.json`; its scope starts empty and is
  widened per opened folder by `allow_media_dir` (called from `App.tsx` on open and
  on session restore). The CSP allows `asset:` / `http://asset.localhost` for
  `img-src` / `media-src` / `frame-src` (frame for the WebView's native PDF viewer).
  This does not widen the untrusted-Markdown boundary: `html: false` + markdown-it's
  `validateLink` block the `asset:` scheme, so a document cannot emit an `asset:`
  reference — media only loads for files chosen in the tree. Media support is bounded
  by the platform WebView (heic/heif are gated to macOS in `file_kind`; PDF is absent
  on some Linux WebKitGTK builds). `<img>`/`<video>` fall back to a message on decode
  error; `<iframe>` (PDF) has no reliable error signal, so it can show blank.
- **A leading dot is not covered by the recursive grant on its own, which is why
  `assetProtocol.scope` is an object rather than `[]`.** `allow_media_dir` calls
  `Scope::allow_directory`, which pushes a `<dir>/**` glob, and the scope matches
  with `glob::MatchOptions`, whose `require_literal_leading_dot` defaults to `true`
  on unix and `false` on Windows (tauri 2.11.3, `src/scope/fs.rs`). Under that
  default `*` and `**` refuse every path component starting with a dot, so an image
  in `.assets/` — and a `.hidden.png` beside the document — is refused with a 403 the
  WebView shows as a broken image, in `MediaView` and in the rendered view's
  rewritten references alike. `requireLiteralLeadingDot: false` in `tauri.conf.json`
  turns that off for the whole asset-protocol scope. **It widens nothing past the
  folders `allow_media_dir` has granted**: the patterns are unchanged, the static
  `allow`/`deny` lists stay empty, and `is_allowed` canonicalizes before matching, so
  a `..` component never reaches the glob. **A second grant cannot replace it** — no
  finite set of globs covers dot directories at every depth or the dot-prefixed files
  themselves, and one created after the grant would be missed anyway. It also puts
  unix where Windows and `read_dir_tree` already were: that command never filtered
  dot directories, so the tree has always listed those files. Measured on macOS
  against tauri 2.11.3's own `Scope` (TASK-21), and `commands.rs`'s
  `asset_scope_reaches_media_behind_a_leading_dot` reads the key back out of
  `tauri.conf.json` rather than restating it, so removing it fails the suite.
- **Printing is one call that takes three structurally different routes, and
  `window.print()` is only the Windows one.** `print_window` hands the webview
  window to `WebviewWindow::print()`; wry 0.55.1 builds an `NSPrintOperation` on
  macOS, evaluates `window.print()` on Windows and runs GTK's
  `PrintOperation::run_dialog(None)` on Linux. **So a JS print event cannot be
  assumed to fire** — the shape decision-9 established for parent-registered
  listeners — and anything needing the DOM rearranged before printing must do it
  synchronously in the frontend before invoking. **Tauri's own doc comment says
  macOS-only while the pinned wry implements all three**; the pinned source is
  what this rests on, the same disagreement TASK-11.1 hit. **A returned `Ok(())`
  is not evidence a print UI appeared**: macOS's route is guarded by
  `respondsToSelector(printOperationWithPrintInfo:)` and returns success having
  done nothing where that guard fails, Windows returns before the evaluated JS
  has run, and Linux's dialog has a `None` parent so it need not be in front of
  mallow. **The entry is gated on the active view, never on `file.kind`**
  (decision-13): `Print…` is disabled unless the active view is markdown in
  preview, and the accelerator therefore lives inside `MarkdownView`, where being
  mounted with `mode` at `preview` *is* that condition rather than a copy of it —
  `file.kind === 'markdown'` is true of the source half of the toggle, which must
  not print. **What the engine paginates is the whole `<body>`**, explorer and
  toolbar and footer and settings modal included, so the paper carries the app
  shell until a print stylesheet lands; that stylesheet must go in a `.scss` and
  **never as an inline `<style>` in `index.html`**, which would add a hash to
  `style-src` and retire its `'unsafe-inline'`, and it must neutralise
  `.toolbar`'s `will-change: transform` only inside `@media print`. **`@page` is
  not written before the margins are measured** — macOS's route zeroes all four
  print margins and writes them into the application-wide
  `NSPrintInfo::sharedPrintInfo()` while the other two leave the paper to their
  print UI, so both setting margins and leaving them are wrong until observed.
  **No automated check sees any of this**: Biome and Vitest do not read SCSS, no
  harness opens a platform print dialog, and `src/probe/` measures with counters
  where the evidence here is a screenshot and a PDF.
- **Emoji.** Unicode emoji are wrapped in `<span class="emoji">` so CSS can put a
  colour-emoji stack (`$font-emoji`) in front for them alone. Without the wrapper
  the JP body font wins the fallback race for the few emoji it covers — `:ok:` is
  U+1F197, a Japanese carrier symbol Hiragino / Noto Sans JP ship as a monochrome
  glyph — so those render flat next to colour ones. Do NOT fix this by leading the
  body stack with the emoji font: Apple Color Emoji also covers the ASCII digits
  it needs for keycap sequences.
- **Custom emoji.** `lib/custom-emoji` turns a user-picked folder (Settings →
  Custom emoji, persisted as `customEmojiDir`) into a shortcode table and hands it
  to `setCustomEmoji` in `lib/markdown`. Images on disk are the source of truth;
  `emoji.json` is optional and only adds unicode entries plus a preferred file per
  name. Splitting it this way keeps `lib/markdown` free of Tauri APIs so it stays
  unit-testable under a Node environment. Applying a set discards the cached
  MarkdownIt instance (the shortcode table compiles into a regexp at `md.use`
  time) and bumps a version that `MarkdownView` reads via `useSyncExternalStore`,
  so an open document re-renders. Emitting `<img>` for a shortcode does not widen
  the untrusted-Markdown boundary: the document only supplies the *name*, and a
  name only matches when it is a key of the app-built table — the URL never comes
  from the document. The folder needs its own `allow_media_dir` grant.
- Theme = `data-theme` attribute + CSS-variable palettes (instant switch; also
  styles the non-React rendered HTML). 7 themes. When adding a dark palette, also
  add it to the `on-dark` mixin in `_vars.scss` and apply it in `global.scss`.
- i18n is a hand-rolled dictionary in `lib/i18n.tsx` (no library). UI strings go
  through `useT()` / `t(key, params)`; add the key to **both** the `ja` and `en`
  dictionaries. Language follows localStorage → OS locale → Japanese.
- Icons are inlined Lucide (https://lucide.dev) SVGs in `components/icons.tsx`
  (24×24, `stroke="currentColor"`). To add one, copy its path data verbatim rather
  than adding the `lucide-react` package.
- The native window title tracks the open document (`lib/title.ts`: markdown
  front-matter `title` when present, else the file name; `mallow` when none). It is
  set from `Viewer` via `setWindowTitle` — note `document.title` does NOT change a
  Tauri window title, so this needs the `core:window:allow-set-title` capability.
- Shiki dual theme: light is inlined, dark emitted as `--shiki-dark` and swapped
  under `on-dark`. Code token colors stay github-light/dark regardless of palette.
- **`SourceView` is capped, and that cap is what makes it a safe fallback.**
  Above `HIGHLIGHT_MAX_BYTES` (256 KiB of UTF-8) or `HIGHLIGHT_MAX_LINES`
  (10,000) — both in `lib/source-cap` — Shiki is not called at all, because its
  cost is linear in the input and it emits roughly 14× the input in HTML, all on
  the main thread. Dropping the grammar to `text` is NOT a substitute: it still
  emits a span per line. **What is given up is the highlighting, never the
  content**, so a caller needs no size check of its own before rendering
  `SourceView` (decision-6). A notice (`highlightSkipped`) says the highlighting
  was skipped, so a monochrome document does not read as a rendering fault.
- `SourceView` line numbers: in the highlighted path Shiki emits
  `<span class="line">` and CSS uses `code { display: grid }` +
  `.line::before { counter }`. Above the caps there are no per-line elements, so
  the numbers are one more text node beside the text — which is why that path
  does not wrap (a wrapped line would slip out of step with the number column)
  and why its parse-error flag is one positioned band rather than a class on a
  line. **That band is placed from the line height measured on the rendered
  text, never computed from the declared `--src-line-height`** — WebKit lays
  each line box out at an integer height, so the declared 20.8px is used as 20px
  and a computed position drifts a line every 25.
- **The toolbar has to keep its own compositing layer, and the z-index numbers
  alone do not hold the dropdowns above `.doc__bar`.** The bar's
  `backdrop-filter` puts it on a layer of its own; open a toolbar menu while
  `.doc-scroll` overflows and then enlarge the window until it does not, and
  the rebuild that follows re-sorts the bar's layer above the already-open
  popup — which is why this reads as intermittent, since anything that moves
  the same overflow state does it too. **Which things do is inference, not
  measurement**: the four steps above are what was measured, and highlighting
  arriving, mermaid, and `HtmlView` converging on its height are named as
  candidates rather than as observed triggers. `.toolbar` therefore carries
  `position: relative; z-index: 10; will-change: transform`
  (`src/styles/app.scss`), and **the `will-change` is load-bearing rather than
  decoration** — dropping that line alone, with the other two in place, brings
  the failure back. **Do not raise `.doc__bar` instead**: it has to stay above
  the document it pins over. `.menu__popup`'s 50 now sorts only inside the
  toolbar's stacking context. Measured on macOS / WKWebView only, and **nothing
  automated can catch a regression here** — no check in the suite sees paint
  order.
- **The heading jump and the outline's scroll spy are one number crossing from
  TypeScript into CSS and back, and all three files have to hold.** `.doc__bar` is
  pinned over the top of the scroll container, so a heading must clear it to be
  visible at all. `MarkdownView` measures the rendered bar and publishes it as
  `--doc-bar-height` **on the same element `Outline` is given as its scroller** —
  measured, not taken from `$doc-bar-height`, whose 42px its own comment calls an
  approximation of the toggle row (the same rule as the `SourceView` band above).
  `markdown.scss` turns it into the headings' `scroll-margin-top`, which is what
  `scrollIntoView` and a document's own `#` links honour, and `Outline` reads that
  computed `scroll-margin-top` back off a heading rather than recomputing it — so
  there is one value, and the SCSS fallback covers the spy too. The comparison
  carries `LANDING_SLACK_PX`: the scroller's offset is an integer while heading
  positions are fractional, so an exact test highlights the entry above the one
  clicked about half the time. **A viewer that mounts `.markdown-body` without
  publishing the property takes the 62px fallback silently** (`MermaidView` today;
  the Config/Table/Xml bars publish nothing), which is harmless only for as long
  as nothing there has headings. **`HtmlView` is the other case, not that one**:
  its headings sit in the frame's own document, which `markdown.scss` cannot
  reach, so the value is declared as `scroll-margin-top` on `.html-frame` in
  `html.scss` and copied onto each heading as an inline style at load. It is
  still one value in CSS, and `Outline` still reads it back off the heading.
- **The rendered HTML frame's height is read at the height currently applied,
  and that is what makes the converged value a fixed point.** The frame's height
  *is* its document's viewport, so a height measured anywhere else is a height
  the document is not laid out at: apply it and `90vh` inside resolves against a
  viewport the document never gets, the content ends up taller than the box
  holding it, and **the frame becomes the second scroll region decision-3,
  decision-9 and TASK-8 all forbid** — `scrollIntoView` then scrolls inside the
  frame and the parent does not move. TASK-5.2 shipped a reference-height variant
  first, on the reasoning that it removed the feedback loop; it removed the
  convergence instead, and only the visual round caught it. decision-3 specifies
  this loop, divergence included; `MAX_MEASUREMENT_PASSES` and
  `MAX_FRAME_HEIGHT_PX` are what bound it, and the `ResizeObserver` is what
  drives it — applying a height changes the viewport, which the observer reports,
  which measures again.
  **Converging writes nothing**, which is not an optimisation: per CSSOM-View an
  instant scroll aborts a smooth one, so a measurement landing during an outline
  jump would stop it a few percent in, and the observers and polls fire during
  exactly those. **A shrink is invisible from a tall frame** — `scrollHeight` is
  floored by the frame's own height — so a cause that can shorten the document (a
  mutation, a width change) asks for a *restart*, which re-seeds the frame at the
  reader's viewport and carries the reader across on the heading anchor rather
  than on a `scrollTop` belonging to the height being recomputed. The polls do
  not restart, so a shrink they alone would catch is not caught; that trade is
  written beside them.
  **Every parent-side write into the frame belongs to the load pass, never to a
  handler** — the landing offset and `tabindex` both — because each is an
  attribute mutation the `MutationObserver` reports, and a mutation now asks for
  a restart: a write made while preparing a jump would re-seed the frame and
  throw the reader to the top as well as killing the jump.
- **A `srcdoc` document's base URL is the *parent's*, so `#section` inside the
  frame is not a same-document link — and `frame-src 'self'` lets it load.** The
  frame navigates to the app's own URL, the shell renders blank because its
  scripts are refused, and the reader has no way back inside the view. So does a
  relative or root-absolute path. `http(s)` links are the ones `frame-src` really
  does stop, which is why they were inert and these were not; **"the CSP holds the
  frame in place" is only true of destinations `frame-src` does not carry, and any
  argument leaning on it has to name the destination first.** Where the frame runs
  no parent-registered listener nothing can `preventDefault` this, so `HtmlView`
  neutralizes those links at load with `pointer-events: none` — the click never
  reaches the anchor while `:link` still matches, so the document keeps its own
  styling (decision-10). `lib/html-doc` holds both halves: `navigatesAppOrigin`
  is the predicate and `neutralizeAppOriginLinks` is the pass. **The pass is a
  named function rather than a loop inside `HtmlView` because the probe applies
  the same one** — `src/probe/link-checks.ts` measures decision-10's open cases
  by arming the fixture twice, once raw and once with this pass applied, and a
  copy of the mechanism there would measure the copy rather than what ships.
  **What that measured (TASK-23, all three WebViews): the `<a>` click and the
  keyboard path are both closed, and an `<area>` was not.** `pointer-events: none`
  on the area does not stop its click — measured, and **do not explain it by the
  area not owning the region**, since the click event does reach the area on
  WebView2 (below) — so an image map still navigated the frame — and on WebView2, where listeners do run and the pass is never
  applied, `HtmlView`'s handler matches `closest('a[href]')`, which an `<area>` is
  not. Two routes to the same failure, neither covered by decision-10's halves.
  **TASK-25 closed both with one pass placed before the branch, and that
  placement is the point rather than an implementation detail.**
  `neutralizeAppOriginAreas` runs inside the transform, so the `href` is gone
  before the frame ever loads and neither route has anything left to travel: no
  hyperlink for a region's click to activate, and no `area[href]` for a handler's
  selector to skip. **Not "no click"** — the click is still delivered (below);
  what is gone is the link it used to carry. **What goes is the
  activation, not the click, and that is measured** — on WebView2 the neutralized
  region still hit-tests and the counter recorded it as `area-link (not a link)`
  against no navigation, so do not write that the click falls through to the
  image. Re-measured on all three WebViews after the fix (2026-08-24,
  `_sandbox/handoff/task-25/task-25-{mac,win,linux}.md`): armed raw the region
  navigated the frame on each, armed with the pass the frame stayed on
  `about:srcdoc` with no `area[href]` left. It removes the `href`
  rather than suppressing hit-testing because **decision-10's reason for keeping
  one does not carry over** — an `<a>` keeps its `href` so `:link` still matches
  and the document keeps its styling, while an `<area>` has no box at all, so
  nothing about it is styled and nothing is lost. `tabindex="-1"` is still
  written: it is what closed the keyboard path where that was measured, and this
  replaces one mechanism, not both. **`neutralizeAppOriginLinks` therefore
  selects `a[href]` only**, and `HtmlView`'s handler still matches `a[href]`
  only — widening either would be a branch nothing reaches, or, on WebView2
  alone, would newly hand an image map's `http(s)` region to the OS browser,
  which is a capability and not this fix. The probe applies **both** passes in
  its neutralized arm for the same reason it applies the app's own function at
  all: applying one would arm a document the app never shows.
- **Everything the parent puts inside the frame is lost on every `srcdoc` swap,
  and the click handler is a capability rather than a given.** `contentDocument`
  is `about:blank` until the iframe **element**'s `load` (which does fire on all
  three WebViews), and each swap builds a fresh document, so `HtmlView` re-runs
  heading ids → parent-side wiring → scroll anchor → height on every load, in that
  order. Whether a listener the parent registers on that document is ever invoked
  is settled by one synchronous dispatch per document — it runs on WebView2 and on
  neither WebKit engine (decision-9) — and never by branching on a platform name.
  Late layout is **observed**, never listened for: a `load` listener on an image
  inside the frame fired on none of the three, while a `ResizeObserver` on the
  frame's `documentElement` and a `MutationObserver` on its document reported on
  all three; polling is the backstop. The scroll anchor is captured on every
  parent scroll rather than just before a reload, because a `srcdoc` swap replaces
  the document asynchronously and there is no moment the parent can rely on where
  the new markup is committed and the old document is still readable.
- **The subresource rewriting needed a base to resolve against, which is why
  `lib/path` carries `dirname` and `resolvePath`.** A `srcdoc` document's base
  URL is the parent's, so a reference written beside the document
  (`img/logo.png`) does not reach the opened folder on its own; the transform's
  `RefResolver` resolves it against the document's own directory and hands the
  result to `convertFileSrc`. The two arrived together and neither is useful
  alone — `dirname` supplies the point to resolve against, `resolvePath` folds
  `.` and `..` — so a change to one is a change to the pair. Node's `path` is
  absent in the WebView and neither function is worth a dependency, so both are
  string ops that read `/` and `\` as separators — in the directory being
  resolved against. The reference the document itself wrote is split on `/`
  alone, because that is what an HTML document writes. **`..` is applied by trimming
  the directory's own string rather than by rebuilding it from components**, so
  a drive letter or a UNC prefix survives; climbing past the root stops there,
  and climbing above the opened folder is deliberately not special-cased,
  because the asset-protocol grant is what decides whether the result can be
  read. A document-absolute `/x.png` is not rewritten at all, and that call sits
  in `lib/html-doc` rather than here — the question is what to do with a URL,
  not how to join a path. **A reference no `RefSite` tallies is invisible twice
  over** — not rewritten, and not counted either. `<link rel=stylesheet>` and
  `<script src>` are the counted exceptions: `REWRITTEN` does not reach them
  either, but both tally at `unrewritten`, so a stylesheet beside the document
  does get a notice-bar line. What falls through entirely is `url()` inside the
  document's own CSS, `<track src>`, `<input type=image src>` and inline SVG
  `<image>` / `<use>` — decision-3 requires that be stated rather than left to
  be discovered, which is why README names the CSS case to the reader.
- **Whether a reference arrives is decided by the CSP directive that fetches the
  attribute it sits on, not by its scheme — so `lib/html-doc`'s `refTally` takes
  a `RefSite`, and every count runs through it.** `img-src` carries
  `https: http: data:`, `media-src` is `'self' asset:` and nothing else, and
  `style-src` / `script-src` carry neither a host nor a scheme. So the same
  `https://…` arrives on `img src`, `img srcset`, `source srcset` and `video
  poster`, and is refused on `video src`, `audio src` and `<script src>`; and a
  `//host/x.css` or `data:text/css` on `<link rel=stylesheet>` is refused too,
  which a rule keyed on `http(s)` misses entirely. **`source src` has no answer of
  its own** — inside `<picture>` it is `img-src` and inside `<video>`/`<audio>` it
  is `media-src`, so the parent decides. `blockedRefs` counts what does not
  arrive and `unresolvedLocalRefs` what is not rewritten; a remote image is in
  neither, because it loads. **One number over both outcomes leaves the notice bar
  unable to be right about either.**
- **`counts.links` carries the two classes whose fate is settled and nothing
  else**, because the notice bar's number has to be one it can account for: an
  app-origin href, which reaches no destination — neutralized on an `<a>` where no
  parent listener runs (decision-10 — a bare fragment is one, so the document's
  own table of contents is in the count) and removed outright on an `<area>`
  (TASK-25) — and an `http(s)` one, refused by `frame-src` (decision-9).
  **`mailto:` / `tel:` stay excluded, and that exclusion is now a policy question
  rather than a gap**: TASK-23 measured that an external-protocol scheme is handed
  to no OS application on any of the three, so what keeps it out is whether to
  count a link that does nothing, and the policy is decision-10's to take.
  **`area[href]` is in the count as of TASK-25, and it is the same two classes
  rather than a third** — its app-origin half is settled ahead of the listener
  branch, so unlike the earlier reading it is not a navigating link inside a
  number that says links do nothing, and its `http(s)` half rides the `<a>`
  argument, since `frame-src` answers for the destination and not for the element
  that asked — **and that half is now measured rather than carried**: an
  `<area href="https://…">` clicked in a built app moved the frame on none of the
  three platforms (2026-08-24, `_sandbox/samples/rendered-imagemap.html`).
  **What names the CSP as the cause is the macOS leg alone**, where the same
  region did move the frame under `pnpm tauri dev`, which has no CSP at all; the
  other two are the outcome without that contrast. **The same
  silence is deliberate at `imgSrc`** for a
  protocol-relative reference, which the parent's base URL makes `tauri://host/x`
  on WebKit and `http://host/x` on WebView2 — one refused, one carried, measured
  as such on all three in TASK-23 — so a count would have to be wrong on a
  platform.
- **A video inside a rendered document draws but does not play, and that is not
  the rewriting failing.** TASK-5.1's second visual round (2026-08-19, macOS /
  WKWebView, built app) watched a `<video src>` with no poster and a nested
  `<source src>` each draw the file's first frame — so those references were
  rewritten and fetched, which is what closed that task's AC #6 — and then
  watched the controls do nothing when pressed. The same file plays when opened
  directly in mallow, where `MediaView` uses the same asset protocol with no
  frame around it. **Only macOS was measured**; WebView2 and WebKitGTK are
  unmeasured. The suspected mechanism is decision-9's family rather than a fault
  in `RefResolver` — WebKit implements its media controls in script and the
  frame runs none — but that is inference, so do not record it as established
  and do not "fix" the rewriting on the strength of it. README says the same to
  the reader, because a player that draws a frame and ignores its buttons reads
  as a bug rather than as something the sandbox declined to do.
- **The native window title has exactly one writer, `Viewer`, and a view that
  knows a better label reports it upward.** `HtmlView` passes the `<title>` the
  transform already read through `onDocumentTitle`; it never calls
  `setWindowTitle`, and nothing parses the document again to find it
  (`frontMatterTitle` in `lib/title` answers `null` for every non-markdown kind,
  so `documentTitle` alone would always yield the file name here). The label is
  dropped on a **path** change and deliberately not on the watcher's reload token:
  a re-read whose text is unchanged produces no new transform, so nothing would
  report the label back and the title would fall to the file name.
- **`TableView` is capped by four constants, and unlike `SourceView` it does
  withhold content.** `TABLE_MAX_ROWS` (5,000), `TABLE_MAX_COLUMNS` (100),
  `TABLE_MAX_CELLS` (20,000) and `TABLE_MAX_CELL_CHARS` (500) live in
  `lib/delimited`; four are needed because the first two multiply — 5,000 records
  of 100 fields satisfies both and is half a million DOM cells — and because
  capping how many cells exist says nothing about how much text one holds: an
  unterminated quote is one field running to the end of the file, so a 10 MiB
  document can satisfy the first three caps as a single wrapping cell
  (decision-7). `tableExtent` applies the first three together, so the row count
  falls as the table widens; the fourth clips a kept value and leaves an ellipsis
  on it. There is deliberately **no "show more"**:
  the source half of the toggle already reaches the whole document at any size,
  which is also what the notice above the table says. `parseDelimited` counts
  every record and field but builds only what can be rendered, so the reported
  row and column counts do not depend on the caps and a pathological file costs
  no allocation per unrendered field. `clippedCells` is the exception and counts
  what the parser kept, so it can name more clipped cells than are on screen
  (decision-7 says why neither alternative is better).
- **`XmlView` parses with the WebView's own `DOMParser` and is the only place
  that touches it.** Everything below takes `DomNodeLike`, the structural subset
  of a DOM node `lib/xml-tree` reads, which a real `Document` satisfies and a unit
  test writes as an object literal — that split is what keeps the transform and
  its caps testable under Node. The tree is bounded by `XML_MAX_NODES` (20,000),
  `XML_MAX_ATTRIBUTES` (64) and `XML_MAX_VALUE_CHARS` (500). **An attribute spends
  from the node budget *and* is capped per element**, because the two bound
  different things: the budget stops a million attributes spread over many
  elements, the per-element cap stops them all landing on one row (attributes
  render inline, so that row does not wrap). 64 is measured — no element in
  826,427 scanned carried more than 14 (decision-8). Nodes past the budget are
  counted, never built; the walk is
  iterative because nesting depth is the document's to choose. Whitespace-only
  text is dropped, CDATA is kept whatever it holds. The row shell (`cfg-*`) and
  the reveal constants in `lib/config-tree` are shared with the config tree on
  purpose.
- **A `.plist` picks its view from its text, and it is the only kind that does.**
  A property list is XML, binary or OpenStep, and `plutil -convert json` writes a
  fourth form under the same extension. Binary is answered by `read_file`'s magic
  check; between the two text forms `isJsonPlist` (in `lib/file`) sends a document
  whose first non-whitespace character is `{` or `[` to `ConfigView` and every
  other one to `XmlView`. **Only `.plist` is sniffed** — a `.xml` starting with
  `{` is a broken XML document and gets the error banner (decision-8). So
  `file.kind` alone no longer tells you which view is on screen.
- **A JSON syntax error's position comes from two sources, and only one of them
  decides what is valid.** `JSON.parse` is the gate: `parseJson` calls it, and a
  `.json` file is valid exactly when it says so, so comments and trailing commas
  stay errors. Where it throws, `jsonErrorPosition` answers *where* — the engine's
  own message first, and where the message names no position, a **strict jsonc
  scan** (`jsonc-parser` with `allowTrailingComma: false, disallowComments: true`)
  whose first reported offset becomes a line. **The scan cannot
  widen the format, because the only path that reaches it begins with `JSON.parse`
  having already thrown** — which is what makes "what counts as valid JSON is
  unchanged" hold by construction rather than by a table of measured agreement
  (measured anyway: 30 shapes, identical verdicts, and the identical position on
  the 4 that both locate). **The engine's position wins where the message names
  one**, because the banner shows that message and an arrow pointing somewhere
  else is a mismatch the reader can see; there is nothing to disagree with once
  the message says nothing about position. **The message patterns are anchored on
  what the engine writes, and that is load-bearing rather than tidiness**: V8's
  positionless shapes quote an excerpt of the document
  (`Unexpected token 'p', "{"a": position 3}" is not valid JSON`), so a bare
  `/position (\d+)/` read the document's own text — pointing at column 4 instead of
  the fault at column 7, *and* suppressing the scan that had it right. So a
  coordinate is recognized only as `at position N` / `at line N column M` ending
  the message, and the excerpt family is refused whole by the `is not valid JSON`
  it always ends with (that family never carries a coordinate, so nothing is
  lost). **The scan goes through `visit`, not the `parse` two functions below
  it** — `parse` assembles the recovered value, which for a malformed 10 MiB array
  faulting at its start is 130 MiB of heap and 406 ms to build something discarded
  on the next line; `visit` reports the same offset and allocates nothing.
  `parseJsoncText` keeps `parse` because it wants the value. **Both sources may decline and the
  banner then shows no position** — rarer than before this existed, so it is
  covered by a unit test rather than left to a real file to produce. **The
  wordings are per-engine and a test under Node sees V8's alone**, which is why
  `jsonErrorPosition` is exported: JavaScriptCore's `JSON Parse error: …` cannot
  be produced here. `parseJsonl` takes its column from the same helper and hands
  `JSON.parse` the **raw line rather than a trimmed copy**, so an offset needs no
  shifting by the indent; its old hard-coded `column: 1` was an inferred position
  and is gone (decision-12).
- **An XML parse failure may legitimately carry no line number.** The DOM reports
  a failure as a `<parsererror>` element and offers no API for its position; the
  position exists only inside the message text, so `xmlErrorInfo` reads it back
  out and is allowed to fail, and the banner then appears without a location and
  flags nothing. The error document is recognized by namespace, not by element
  name — a valid document may contain a `parsererror` element of its own. All
  three WebViews use libxml2 today and so share one wording; that is not a
  contract, and TASK-7's cross-WebView pass is where it gets checked. Do not add
  an XML parser dependency to obtain a position (decision-8). **This is not a
  different policy from JSON's but the same rule reaching a different answer** —
  report a position wherever one can be obtained without adding a dependency and
  without inferring it (decision-12). JSON has a second strict parser in the tree
  already; XML has none, so if one ever arrives for another reason, XML is obliged
  to start reporting a position too.
- Custom Rust commands and core events are NOT gated by capabilities; only
  plugin/core APIs are (see `src-tauri/capabilities/default.json`).

## Verifying changes

- Frontend: `pnpm lint` (Biome), `pnpm build` (tsc + vite) and `pnpm test`
  (Vitest). Unit tests live next to the code as `src/**/*.test.ts` and cover the
  pure-logic modules (`markdown` — incl. the untrusted-input security boundary —
  `config-parse`, `frontmatter`, `title`, `path`, `delimited`, `xml-tree`,
  `heading` (the coordinate conversion only — `findHeading` needs DOM globals),
  `chord` (accelerator matching, which takes the platform as an argument so it
  needs no `navigator`), and `custom-emoji`
  with the Tauri layer mocked). Run a Node environment, so no jsdom/GUI is needed. The
  markdown suite raises its timeout with one `vi.setConfig` at the top of the
  file — not a third argument per `it` (the formatter expands a three-argument
  call across lines) and not `vitest.config.ts` (a hung test in any other suite
  should still fail in 5s).
- Backend: `cargo fmt --check`, `cargo check` and `cargo test` inside
  `src-tauri/`. The `commands` module has unit tests (a small self-cleaning
  temp-dir helper, no `tempfile` dep).
- End-to-end: `pnpm tauri dev` (GUI) or `pnpm tauri build`.
- CI (`.github/workflows/check.yml`) runs exactly this list on pull requests and
  on pushes to `main` — `biome ci`, `pnpm build`, `pnpm test`, `cargo fmt
  --check`, `cargo check`, `cargo test` — so what is documented here and what is
  enforced cannot drift apart. Add a check here and in that workflow together.

## Releasing (macOS signing)

To ship a macOS build that launches without a Gatekeeper warning it must be
signed with a **Developer ID Application** certificate and **notarized** by
Apple (for distribution outside the App Store). Tauri does both automatically
when the right environment variables are present:

1. **Prerequisites** — Xcode Command Line Tools (`xcode-select --install`) and a
   "Developer ID Application" cert + private key in your login keychain (check
   with `security find-identity -v -p codesigning`). An "Apple Development" or
   "Apple Distribution" cert will *not* notarize. Notarization also needs an
   app-specific password (appleid.apple.com → Sign-In and Security).
2. **Configure** — copy `.env.signing.example` to `.env.signing` (git-ignored)
   and fill in `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
   `APPLE_TEAM_ID`. Credentials stay local; nothing account-specific is
   committed. The same file carries the two updater-signing variables as well
   (see "Signed self-update" below) — not because they are macOS credentials but
   because `macos-sign-build.sh` is the one script that exports this file, so a
   contributor bundling on Windows or Linux exports them by hand.
3. **Build** — `./scripts/macos-sign-build.sh` (wraps `pnpm tauri build`). Tauri
   signs with hardened runtime (`bundle.macOS.hardenedRuntime` defaults to
   `true`), notarizes, and staples the ticket. First notarization can take a few
   minutes. **Tauri notarizes the `.app` but not the `.dmg` that wraps it** (an
   un-notarized DMG is rejected by Gatekeeper on open), so the script notarizes +
   staples each produced `.dmg` afterwards.
4. **Verify** — the built `.app` / `.dmg` under
   `src-tauri/target/release/bundle/`:
   - `codesign -dv --verbose=4 <app>` → `Authority=Developer ID Application`,
     `flags=…(runtime)`.
   - `spctl -a -vvv -t install <app>` → `source=Notarized Developer ID`.
   - `spctl -a -t open --context context:primary-signature -vvv <dmg>` →
     `accepted / source=Notarized Developer ID` (this is what checks the DMG).
   - `xcrun stapler validate <app-or-dmg>` → `The validate action worked!`.

No custom entitlements file is needed for the default build; if a notarized
build ever fails to launch under hardened runtime, add one via
`bundle.macOS.entitlements`.

### Cross-platform release via GitHub Actions

`.github/workflows/release.yml` builds macOS (one universal `.dmg` covering
Apple Silicon and Intel), Windows (x86_64 only), and Linux on **both x86_64 and
arm64** (deb, rpm and AppImage for each), and attaches them to a **draft**
GitHub release (review, then publish by hand). It triggers on a pushed `v*` tag,
or manually from the Actions tab with a tag input. It uses
`tauri-apps/tauri-action`; the macOS `.dmg` is notarized + stapled in a
follow-up step (same gap the local script closes) and the asset is replaced via
`gh release upload --clobber`. Each bundle is accompanied by an updater
artifact and its `.sig`, plus one `latest.json` for the whole release — see
"Signed self-update" below, since how that file is produced is where this
workflow is easiest to break. Both Linux jobs run on `ubuntu-24.04` images, so
the Linux bundles need glibc 2.39 — the matrix comment in the workflow is the
source of truth for why that floor was taken over Ubuntu 22's 2.35. The
`ubuntu-24.04-arm` label only resolves on public repositories.

One-time setup — the macOS runner signs/notarizes only when these repo secrets
exist. `scripts/setup-ci-signing-secrets.sh path/to/DeveloperID.p12` registers
the six Apple ones from `.env.signing` + an exported `.p12` (no value is
printed). The two updater secrets below it are **not** registered by that
script and are set by hand: it takes a `.p12` as a required argument, so
rotating only the updater key would demand the whole certificate.

- `APPLE_CERTIFICATE` — base64 of a Developer ID Application `.p12` (Keychain
  Access → My Certificates → Export…).
- `APPLE_CERTIFICATE_PASSWORD` — that `.p12`'s export password.
- `APPLE_SIGNING_IDENTITY` — the certificate's common name, derived from the
  `.p12` (not copied from `.env.signing`: CI string-matches the imported cert's
  common name, so a SHA-1 hash — valid for local signing — would fail there).
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` — the same values as
  `.env.signing`.
- `TAURI_SIGNING_PRIVATE_KEY` — the minisign private key that signs updater
  artifacts (`gh secret set TAURI_SIGNING_PRIVATE_KEY < path/to/key`).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password. **Not optional**:
  tauri-cli substitutes an empty password when this is unset, so an unset value
  produces signatures no client accepts rather than an error.

Cutting a release: `pnpm release <patch|minor|major|X.Y.Z>`
(`scripts/release-version.mjs`). It bumps the version in **all four** places it
is declared — `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` — then commits and creates the
`vX.Y.Z` tag; add `--push` to push both, or push by hand as it prints. It
refuses to run off the default branch, on a dirty tree, or when the tag already
exists. `--dry-run` shows what it would do. Bumping all four together is what
matters: **Tauri names the bundles after `tauri.conf.json`, not after the tag**,
so a tag pushed without the bump ships assets carrying the old version's name.
The `create-release` job re-checks tag ↔ manifest agreement and fails the
workflow before anything is built. Windows/Linux bundles are not code-signed (a separate matter from the updater signature on their artifacts).
The draft's notes are generated from the pull requests merged since the previous
tag, grouped by label per `.github/release.yml` (label PRs `feature` / `bug` /
`documentation` to sort them; everything else falls under "Other Changes").
A release that changes how updates reach users needs a sentence those generated
notes cannot produce, added by hand: v0.7.0 is the first release carrying an
updater, so anyone on an earlier version has a binary that cannot ask for one and
has to download once by hand before the channel reaches them at all.

**An unsigned Windows bundle costs a sentence in README, and the three
SmartScreen events it touches are not one event.** A browser receiving a release
asset is the *download-time* warning; launching the received installer is the
*run-time* warning; an in-app update running the installer is the *update-path*
warning. **Only the first is measured** (Edge, v0.7.0, 2026-08-25):
`Publisher: Unknown`, `Cancel` and `Delete` as the only visible buttons, and
`Keep anyway` inside the dropdown on `Delete` — which is why README names that
dropdown rather than saying a warning appears and can be dismissed. A reader who
only sees `Cancel` and `Delete` concludes the file cannot be had, and one did.
The other two events are unmeasured, as are the `.msi`, browsers other than
Edge, and whether code signing removes any of them — SmartScreen judges on
reputation, so **do not write that signing fixes this**; `Publisher: Unknown` is
the display of an unsigned bundle, which is not the same as being the warning's
sufficient condition.

### Signed self-update (the update channel)

`bundle.createUpdaterArtifacts` is on and `plugins.updater.pubkey` in
`tauri.conf.json` holds the minisign **public** key, so a release build produces
an updater artifact (`mallow.app.tar.gz` on macOS) and signs it. The endpoint is
`https://github.com/serendipitynz/mallow/releases/latest/download/latest.json`,
and GitHub resolves `latest` against **published, non-prerelease** releases only
— publishing the draft is what starts a rollout, and nothing about the update
path can be checked while it is still a draft.

**The private key has no recovery path.** A client trusts only the public key
compiled into it, so losing *or rotating* the private key strands every
installed copy; recovery is a manual reinstall by each user. It is not the
Developer ID certificate and must not be handled like one.

**Where the key is kept — two places and only two.** The repository secrets,
which is what CI signs with, and a copy off this machine held by the maintainer,
which is the only backup. It is not in the repository, not in
`.env.signing.example` (whose two updater values are empty on purpose), and must
never be pasted into a transcript, an issue or a PR. Since there is nothing to
reissue it from, this is a backup problem rather than an incident-response one:
the recovery from a lost key is asking every user to reinstall by hand.

Committing the public key changes what a build *without* the private key does,
and the three failure modes do not fail alike:

- **No `TAURI_SIGNING_PRIVATE_KEY`** — the build stops.
- **Key set, password unset, outside CI** — tauri-cli blocks on an interactive
  prompt, which would hang the non-interactive `scripts/macos-sign-build.sh`.
- **A private key that does not match the committed public key** — one warning
  line and the build *succeeds*, shipping signatures every client rejects at
  runtime. This is why `.env.signing.example` leaves both values **empty**: a
  copied file then fails on the first mode instead of quietly on the third.

`tauri build --no-sign` keeps a contributor without the key from being locked out
of local bundling — it logs `Updater signing is skipped due to --no-sign flag`
and produces the `.app.tar.gz` with no `.sig`. It skips **code signing at the
same time**, so it is a contributor's escape hatch and not a release path.

**Committing the public key made `.env.signing` part of local bundling**, not
only of signed releases: a plain build with no private key in the environment
stops. `scripts/macos-sign-build.sh` is the only thing that exports that file, so
invoking `tauri build` directly needs it sourced by hand — `set -a; . ./.env.signing;
set +a`, then `unset` the `APPLE_*` values to skip notarization — and a contributor
bundling on Windows or Linux exports the two updater variables themselves. Missing
this reads as "no private key" rather than as an unexported file.

**decision-11 is the contract for `latest.json`**, and all three things it
settles fail without failing the build. The build matrix carries
`max-parallel: 1`, because every job read-modify-writes that one asset with no
lock — run in parallel, a lost update ships a release missing a platform while
the release page looks complete. `tagName` is passed alongside `releaseId` so
the download urls are pinned to their own tag; without it they resolve to
whatever is newest at download time, and the first later release without updater
bundles turns every older client's url into a 404. And a `finalize-updater-json`
job strips the bare `linux-x86_64` / `linux-aarch64` keys, which are the
fallback a Linux install with no entry of its own would follow — that fallback
is the AppImage, so a deb install would overwrite itself with AppImage bytes.
That job also fails when one of the expected platforms or any signature is
missing, so a lost update is a red job rather than a silently incomplete
release. **Both Linux architectures are in that expected set**, because the
arm64 job is a fourth writer and the bare key just deleted was its only
fallback. **So is rpm, as of v0.7.0** — decision-11 held it out until a real
release showed whether it appears, that release carried
`linux-x86_64-rpm` and `linux-aarch64-rpm`, and README now tells rpm users an
update reaches them, so an upstream change that stops signing `.rpm` has to turn
a release red rather than strand them. `tauri-action` is pinned to `action-v0.6.2` rather than floating on
`@v0` because the shape of `latest.json` comes from it; `action-v1.0.0` renames
inputs and Actions only *warns* about inputs it does not know, so a
half-migrated config would restore the lost update silently.

**The bundle-type marker is a binary patch that fails quietly.** tauri-bundler
rewrites a token in the main binary per bundle type before packaging, and that
token is the only reason a client resolves `os-arch-installer` rather than the
bare `os-arch` key. A failed patch is logged as a warning and the build
continues, and the resulting binary reports no bundle type at all — so **the
build log is the only place it shows**. macOS is the exception at both ends:
native bundles skip the patch by design, so the Developer ID signature is never
at risk, and an unpatched macOS binary still reports the app bundle type.

**`latest.json`'s `notes` is empty, and that is a decision rather than an
omission.** `releaseBody` is not passed to `tauri-action`, so the update dialog
shows no changelog — it is built to read without one. Filling it would route the
generated release notes, multi-line markdown, through a job output, which cannot
be checked before a real release round; and it leans on the reading that the
action creates or edits a release only when `tagName` is set and `releaseId` is
not, which is the same reading that keeps the hand-published draft's generated
notes intact. Revisit it as its own change with a release round to verify it.

## Known follow-ups

- Config-tree expansion state is not preserved across a live reload.
- Math (KaTeX) is intentionally not implemented.
