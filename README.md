# mallow

> 日本語: [README.ja.md](README.ja.md)

A lightweight Markdown / config-file viewer. Open a folder, pick a file from the
tree, and view Markdown with GitHub-equivalent rendering or config files
(JSON / YAML / TOML family) as a collapsible hierarchical tree. HTML documents
are rendered too, in a sandboxed frame that runs none of their script. Images,
PDFs, and videos are shown as well, rendered by the OS-native WebView.

## Features

- **Two-column UI**: file tree on the left (folder hierarchy, lazy-loaded), viewer on the right.
- **Markdown rendering**
  - GitHub-flavored Markdown (tables, `:emoji:`, task lists `- [ ]` / `- [x]`,
    GFM alerts `> [!NOTE]`, …)
  - Code-block syntax highlighting (Shiki / github-light · github-dark) with copy
  - mermaid diagrams (copy as PNG / SVG)
  - Table of contents (outline with scroll-spy)
  - Preview / source toggle (source view has line numbers)
- **Custom emoji**: point Settings at a folder of images and each file name
  becomes a `:shortcode:` — Slack-style `:my-team:` renders as the picture
  instead of staying literal text. See [Custom emoji](#custom-emoji).
- **Config files** (json / jsonc / json5 / jsonl / ndjson / yaml / yml / toml)
  - Collapsible tree (expand/collapse all, tree/source toggle)
  - On a syntax error, switches to the source view and highlights the offending line
- **CSV / TSV** (csv / tsv)
  - Shown as a table (table/source toggle); the first record is the header row
  - A large file has only part of it put in the table, with a line above saying
    what was left out — the source toggle still shows the whole document, so
    nothing the file holds is out of reach once it opens
- **XML** (xml / xsd / xsl, and `.plist`)
  - Collapsible tree (expand/collapse all, tree/source toggle)
  - On a syntax error, switches to the source view and highlights the offending
    line where the parser reports one
  - A `.plist` is examined to tell its XML and JSON forms apart, so a plist
    converted with `plutil -convert json` opens as a config tree instead
- **Plain-text files** (txt / text / log, ini / conf / cfg / properties /
  editorconfig, diff / patch, sql): shown as source with line numbers, and with
  syntax highlighting where a grammar applies — plain text has none, and every
  source view drops the highlighting (never the text) once a file passes a size
  threshold, saying so above the document. These sit apart from **Config files**
  above because the split is about which files get a structured view, not about
  which files are configuration.
- **HTML** (html / htm)
  - Rendered by default, with a rendered/source toggle. The document is shown
    with the CSS it carries inline applied, inside a sandboxed frame that runs
    none of its script — so tabs, disclosure widgets and canvas-drawn charts
    stay inert, and a line above the document says what was left out
  - Media the document references from an `<img>`, `<video>`, `<audio>` or
    `<source>` element loads from beside the document, a video poster included.
    Stylesheets and scripts do not, whether they are remote or next to the
    document, and neither does remote video. Remote images do load, as they
    already do in Markdown. Some local references fail quietly — `url()` in the
    document's own CSS above all: it neither loads nor appears in the line above
    the document, where a stylesheet beside the document does get counted
  - Links inside the document do nothing on some platforms — the document's own
    table of contents included. mallow detects that per document rather than
    reading it off the OS name, and says so above the document when it applies;
    the outline beside the document works everywhere
  - A video shows its first frame, or its poster if it has one, but pressing its
    controls starts nothing. That was seen on macOS (WKWebView); the Windows and
    Linux WebViews have not been measured. Opening the video file itself in
    mallow plays it
  - A document with more elements or text than the frame builds, or one that
    renders taller than the frame is allowed to grow, falls back to the source
    view with a line saying so
  - **Open in default app** (in the footer, and offered in the notice) hands the
    file to whatever your OS opens `.html` with — the whole document, scripts
    and all
- **Standalone mermaid files** (.mmd / .mermaid)
- **Images, PDFs, and videos** (png / jpg / jpeg / gif / webp / svg, pdf,
  webm / mp4 / mov — plus heic/heif on macOS): rendered by the OS-native WebView
  via the Tauri asset protocol, so support depends on what the platform's WebView
  can decode (e.g. PDF is unavailable on some Linux WebKitGTK builds).
- **Live reload**: edits to the open file are detected and re-rendered automatically
  (scroll position preserved); the tree follows changes too.
- **Open in editor**: detects and launches VS Code / Zed / CotEditor / mi (macOS),
  Notepad++ / Sakura (Windows), etc. Can also reveal the file in the OS file manager.
- **Themes**: light / dark / auto + Solarized Light/Dark · Dracula · Nord.
- **Persisted settings / session restore**: theme, explorer width and side, the
  custom emoji folder, the last opened folder/file, and window geometry are saved
  and restored on the next launch.

## Tech stack

- [Tauri v2](https://v2.tauri.app/) (Rust backend + OS-native WebView)
- Vite + React + TypeScript
- SCSS (no Tailwind)
- markdown-it + @shikijs/markdown-it + mermaid + markdown-it-emoji / -github-alerts / -anchor
- Config parsing: yaml / smol-toml / jsonc-parser / json5

## Custom emoji

Settings → **Custom emoji** → *Choose folder…* points mallow at a folder of your
own emoji. Every image in it (png / jpg / gif / webp / svg) becomes a shortcode
named after the file: `images/my-team.png` renders `:my-team:` as that picture.
Built-in shortcodes keep working; a name defined in your folder wins.

A `emoji.json` manifest is optional — it adds shortcodes that map to a Unicode
character rather than a file, and lets an entry name a specific image file:

```json
{
  "image_dir": "images",
  "images": [{ "name": "my-team", "file": "my-team.png" }],
  "unicode": [{ "name": "flag-nz", "char": "🇳🇿" }]
}
```

`image_dir` defaults to `images`, and falls back to the folder itself when that
subfolder does not exist. The files on disk are what count: an entry whose
`file` is missing still resolves if some image shares its name, and images not
listed in the manifest are picked up anyway. Only names made of letters,
digits, `_`, `+` and `-` are accepted.

## Security

mallow is meant to open **untrusted** documents safely, so rendering has a clear
boundary. Markdown and HTML are contained by different mechanisms, because a
Markdown document never becomes live DOM and an HTML one does:

- **No raw HTML.** markdown-it runs with `html: false`, so a literal `<script>`
  or `<img onerror=…>` in a document is shown as text, never executed. URL schemes
  markdown-it deems dangerous (`javascript:`, `vbscript:`, `file:`, non-image
  `data:`) are dropped from links. Only `http(s)` links open (in the OS browser);
  in-page `#anchors` scroll, and any other scheme is inert.
- **mermaid** runs with `securityLevel: 'strict'` — sanitized SVG, no click
  bindings or embedded script in diagrams.
- **Content Security Policy** (in `tauri.conf.json`) is the second layer: scripts
  are limited to the bundled app code (`'self'` plus `'wasm-unsafe-eval'` for the
  Shiki highlighter). `'unsafe-inline'` is not allowed in `script-src`, so injected
  inline scripts and event handlers cannot run even if they reached the DOM.
- **Local media** (images / PDFs / videos) is served over the Tauri asset
  protocol, whose scope starts empty and is widened only to folders the user
  opens. The CSP allows `asset:` URLs for `img`/`media`/`frame` sources, but a
  document cannot inject one: `html: false` and markdown-it's link validation
  block the `asset:` scheme, so media only loads for files chosen in the tree.
- **Rendered HTML** is the one file kind whose content really does become DOM,
  so it is contained by the frame around it rather than by escaping. The
  document is loaded into an iframe with `sandbox="allow-same-origin"` and
  **no** `allow-scripts`: nothing in it executes, no form submits, no popup
  opens, and it cannot navigate the app away — while mallow itself can still
  read the document to build the outline and measure its height. The CSP above
  applies to it as well, since a `srcdoc` document inherits it. Those are two
  layers, but not equally broad ones: a relative `<script src="./x.js">` is
  stopped by the sandbox alone, because the frame resolves it against mallow's
  own URL. There is **no element allowlist and no HTML sanitizer** — nested
  `<iframe>` / `<frame>` and `<base>` are removed for rendering and network
  reasons, not as sanitization. What remains reachable from a document is the
  network exposure Markdown already has: remote images load, and so does
  `url(https://…)` in the document's own CSS.

## Development

```sh
pnpm install
pnpm tauri dev      # run in dev (hot reload)
pnpm tauri build    # release build (produces .app / .dmg, etc.)
pnpm build          # frontend type-check + bundle only
pnpm test           # frontend unit tests (Vitest)
cargo test          # Rust unit tests (run inside src-tauri/)

# Regenerate the app icons from the master image
pnpm tauri icon src-tauri/icons/app-icon.png
```

## Layout

```
src/                Frontend (React + TS)
  components/        Explorer / Viewer / MarkdownView / ConfigView / SourceView / ...
  lib/              markdown, shiki, mermaid, config-parse, frontmatter, watch, settings, theme ...
  hooks/useFileTree  Centralized file-tree state (lazy load, refresh, expansion)
  styles/           SCSS (_vars / global / app / markdown / config / source / table / xml)
src-tauri/          Rust backend
  src/commands.rs   read_dir_tree / read_file / path_exists / allow_media_dir (std::fs)
  src/watch.rs      Recursive file watching via notify (emits the fs:change event)
  src/editors.rs    Editor detection / launch / reveal in OS / open in the default app
  icons/app-icon.png  Icon master (input for regeneration)
```

## Acknowledgements

- Inspired by [Shiba](https://github.com/rhysd/Shiba), a Markdown previewer by rhysd.
- UI icons from [Lucide](https://lucide.dev) (ISC).

## License

mallow is licensed under the [MIT License](LICENSE). The licenses of the bundled
third-party components are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
