---
id: decision-19
title: >-
  Let a deck choose its slide theme from mallow's, a bundled kinari, and a slide
  theme folder, with a default-theme preference for decks that name none
date: '2026-11-13 00:13'
status: accepted
---
## Context

decision-18 §5 gave mallow **one slide theme and no other**: the theme `lib/deck`
generates per slide size, registered under the name `default` and installed as
Marpit's `themeSet.default`, coloured from the preview's own `--color-*`
properties. A deck naming any other theme is drawn with it, and the notice above
the slides names the theme it asked for. That decision called drawing Marp's
built-in themes "a new decision rather than an amendment"; this is a different
request again — **the owner wants decks drawn in a look of their own**, taken
from their earlier Keynote decks (`_sandbox/slide-sample`, not tracked), and
wants that look in both colour modes rather than fixed to light.

**kinari** below is the Marp theme `@theme kinari`: kinari is the undyed,
off-white of unbleached paper, which is its light side; its dark side is paper
dyed in sumi ink. A draft exists at `_sandbox/marp-theme/kinari.css` (not
tracked), with a sample deck and a render script beside it. The owner settled
three things for it on 2026-11-13: the colours follow the reader's light / dark
mode, the type is the system's sans-serif rather than the fonts the Keynote decks
embedded, and the ground stays paper-like on both sides. **The owner also chose,
the same day, to publish kinari as a Marp theme in its own right** — for Marp
CLI and the VS Code extension, not only for mallow — which is what §7 rests on.

### What was measured, and where

In Node and headless Chrome only (2026-11-13), not in a built app and not on
any of the three WebViews:

- The draft passes `walkDeckCss` with nothing removed: no at-rule, no refused
  `asset:` URL, nothing unparsed, and its `data:image/svg+xml` paper texture
  kept. `data:` is outside the walk's reach by construction (`classifyRef` leaves
  a scheme other than `http(s)` untouched) and inside the CSP (`img-src` carries
  `data:`).
- Rendered by Marpit on mallow's own markdown-it (`createMarkdownIt`), with the
  page's `color-scheme` set to light and then dark, every `light-dark()` pair in
  the draft followed the inherited scheme, `invert` included. mallow already sets
  that property on `<html>` from the drawn mode (`snz-tokens.css`,
  `[data-color-mode]`), so a theme reaches the mode with nothing added.
- `light-dark()` takes colours only, so the paper texture cannot be a pair. One
  image of mid-grey grain at low opacity serves both sides: grey darkens the
  cream ground and lightens the charcoal one. A first attempt with
  `background-blend-mode: soft-light` was near-invisible on the light side and
  blotchy on the dark one, and an SVG filter region left at its default (10%
  larger than the tile) put a seam every tile.

Not measured: whether `light-dark()` is supported by the WKWebView, WebView2 and
WebKitGTK mallow runs on. It needs Safari 17.5 or Chromium 123; mallow states no
macOS floor and the WebKitGTK version depends on the distribution.

Marp's own tools take a deck's `size` from a theme's `@size <name> <width>
<height>` comments (marp-core). Marpit alone does not read them, and mallow's
`size` support today is a second generated copy of mallow's slide theme.

## Decision

### 1. The themes a deck can name

mallow holds three kinds of theme, and a deck's `theme` directive picks one by
name:

- **mallow's slide theme**, under the name `default`, as decision-18 §5 built
  it. A deck naming `default` keeps getting it, as before.
- **kinari**, bundled with the app as mallow's copy of a kinari release (§7),
  under the name `kinari`.
- **folder themes** (§3). A folder theme is a theme registered from one `.css`
  file in the slide theme folder.

Presenting draws with the same theme as the Slides view.

### 2. The default-theme preference

The default-theme preference is the theme a deck is drawn with when its `theme`
directive is absent or names a theme mallow does not hold. It is stored as
`defaultSlideTheme` (a theme name) and propagated to every window as the other
store-backed preferences are (`saveSetting`). Marpit's `themeSet.default` is
pointed at it.

- **Absent, it is mallow's slide theme**, so a reader who sets nothing sees what
  decision-18 shipped.
- **A preference naming a theme that is no longer held** — a folder theme whose
  file was removed, or a folder no longer chosen — draws with mallow's slide
  theme, and Settings shows the stored name as missing rather than rewriting it,
  the rule colour modes follow when a family cannot draw one.
- A deck naming an unknown theme is still reported (decision-18 §3), and the
  notice says which theme it was drawn with instead.

### 3. The slide theme folder

The slide theme folder is one folder the reader chooses in Settings, stored as
`slideThemeDir` and handled as the custom emoji folder is: chosen with the
folder dialog, propagated to every window, and granted to the asset protocol
with `allow_media_dir` so a theme's relative `url()`s can load.

- **What is a theme**: every `.css` file directly inside the folder (not in its
  subfolders) whose text carries a `@theme <name>` comment. A file without one is
  skipped.
- **Names**: `default` and `kinari` are reserved; a file claiming either is not
  registered. Two files claiming one name register neither, so which theme a
  name means never depends on the order a directory listing returns.
- **When it is read**: when the folder is chosen, when a window starts, and each
  time a deck's Slides view is entered, so an edited theme shows on the next
  visit without restarting. There is no file watch.
- **Settings lists what the folder gave**: each registered name with its file,
  and each skipped file with the reason.

### 4. A folder theme is untrusted CSS, walked as a deck's CSS is

A folder theme's CSS goes through the same walk as a deck's own CSS
(decision-18 §6) before it is registered: only `@media`, `@supports` and
`@container` survive among its at-rules, every `url()` is resolved against the
**theme file's own directory** under decision-17, and an `asset:` URL the theme
wrote is removed with its declaration. So a folder theme cannot register a font
with `@font-face` or pull another sheet with `@import`; it names installed fonts
by family. What the walk removed is reported **in Settings beside that theme**,
not in the notice above a deck's slides, because the reader of a deck cannot act
on a theme file and the theme's author is the one reading Settings.

Marpit scopes a theme's selectors to the slides as it does a deck's, and the
slide host keeps `contain: paint`, so a folder theme reaches no further than a
deck's CSS does. mallow's slide theme and kinari are the app's own CSS and are
not walked.

### 5. What a theme is given of the colour mode

**The one thing mallow promises a theme is the inherited `color-scheme`**,
`light` or `dark` per the drawn mode. A theme that wants both sides writes its
colours as `light-dark()` pairs, as kinari does; a theme that does not is drawn
as written in both modes. mallow's `--color-*` properties are not part of what a
theme is given — mallow's slide theme reads them because it is mallow's — so a
folder theme that reads them works by accident and may break with any palette
change.

Code blocks keep following the drawn mode whatever the theme, because Shiki's
dark tokens are swapped by the app's `on-dark` rule rather than by the theme.

### 6. Slide size under a theme other than mallow's

mallow's slide theme keeps its two generated sizes (decision-18 §4). Under kinari
or a folder theme, a deck's `size` takes **the theme's `@size` entry of that
name**, as Marp's own tools do, and a theme with no entry for it draws at its own
`section` size with the size reported. mallow reads `@size` itself, since Marpit
does not. kinari carries `16:9` (1280×720) and `4:3` (960×720).

### 7. kinari lives in its own repository, and mallow bundles a release of it

**The kinari repository** is a repository of its own in the serendipitynz
organization that holds kinari's source, its README, its licence and its
releases; its name is chosen when it is created. It is where kinari is changed,
and the only place. A theme published for Marp's own tools needs things mallow
does not — instructions for Marp CLI and the VS Code extension, colours for the
highlight.js classes those tools put on code, screenshots, versioned releases —
and in mallow's tree they would sit in mallow's history and its release notes.

**Mallow's copy of kinari** is one released version of kinari copied into
mallow's tree: its first line names the release it came from, it is never edited
by hand, and it is replaced from a newer release in a commit of its own — the
rule `src/styles/snz-tokens.css` already follows for snz-design. A change mallow
needs in kinari is made in the kinari repository and arrives with the next
release. Until a first release exists, a reader can use the draft by putting it
in the slide theme folder (§3), under any name other than `kinari`.

What mallow takes from a kinari release, and checks when it updates its copy:

- colours as `light-dark()` pairs, so the theme follows the drawn mode through
  `color-scheme` alone (§5);
- **an `@supports not (color: light-dark(#000, #fff))` block giving its light
  side**, because a custom property holding an unsupported `light-dark()` makes
  every `var()` reading it invalid at computed-value time — the slide would lose
  its ground and its ink, not fall back to one side;
- `@size` entries for `16:9` (1280×720) and `4:3` (960×720) (§6);
- nothing the deck CSS walk would remove — no `@font-face`, no `@import`, no
  at-rule outside `@media`, `@supports` and `@container` — so that the same file
  also works when a reader puts it in the slide theme folder. mallow's copy is
  the app's own CSS and is not walked (§4).

What kinari looks like — the paper ground, the system sans-serif, the layout of
the owner's Keynote decks, `lead` and `invert` — is the kinari repository's to
settle and is not restated here.

## Consequences

- decision-18 §5's "one slide theme of its own and no other" is replaced by §1
  and §2 here. The rest of §5 stands for mallow's slide theme: its colours follow
  the family and mode through the preview's properties, it implements `lead` and
  `invert`, and `backgroundColor`, `color` and `![bg]` override it.
- decision-18 §3's theme entry narrows to a name mallow does not hold, and its
  wording names the theme drawn instead (`deckFeature.theme` in both
  dictionaries).
- The untrusted-CSS boundary gains a second source but no new reach: a folder
  theme is walked and contained exactly as a deck's CSS is. AGENTS.md's
  untrusted-Markdown boundary and README's Security say so in one sentence each.
- No dependency is added and the CSP is unchanged. kinari is not a package
  dependency: mallow's copy is a file in the tree, and no lockfile or build step
  reaches the kinari repository.
- AGENTS.md says mallow names no external project as its origin, with snz-design
  as the one exception. The kinari repository becomes the second, in the same
  sentence, so mallow's copy can say which release it is and where it came from.
- `THIRD-PARTY-NOTICES.md` is generated from bundled packages, and mallow's copy
  of kinari is bundled without being one. Whether it needs a line there is
  settled when the kinari repository's licence is chosen, and if it does, the
  line is added by hand beside the generator rather than by teaching the
  generator about files.
- Whether `light-dark()` holds on the three WebViews is measured against a
  built app when mallow first bundles a kinari release; the `@supports` block is
  what a failure there looks like, not a new decision.
- A single-sided folder theme shows dark code tokens on its own light code
  ground in dark mode (§5). That is the theme's to handle by styling `pre`
  itself; mallow does not try to infer a theme's sides.
