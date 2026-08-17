# TASK-7 probe — how to run it

A measuring instrument for TASK-7, not part of mallow. It builds only when
`MALLOW_PROBE=1` is set, and the ordinary build does not contain a byte of it.

It answers whether the two behaviours decision-3 rests on actually hold on this
project's three WebViews:

1. an iframe carrying a `srcdoc` document with `sandbox="allow-same-origin"` and
   deliberately **no** `allow-scripts` stays same-origin with the parent, so the
   parent can read and drive `contentDocument`, while no script inside the
   document runs;
2. that `srcdoc` document inherits the parent's CSP.

## It must be run against a built app. `devCsp` will not save you.

**There is no CSP under `pnpm tauri dev` on desktop, and setting `devCsp` does
not add one.** `app.security.devCsp` is only ever consulted by `AppManager::csp`,
which is reached from `get_asset` — the path Tauri takes when *Tauri* serves the
frontend. The desktop dev webview loads the Vite `devUrl` directly
(`PROXY_DEV_SERVER` is `cfg!(all(dev, mobile))`), so `get_asset` never runs for
the main document and no CSP header is ever produced. `index.html` carries no
CSP `<meta>` either.

So the only run mode that measures anything is a build. TASK-7's own description
offers `devCsp` as an alternative; it is wrong on desktop, and a run that took it
would report every CSP check as failing and every sandbox-only check as passing —
the both-layers-conflated result the task exists to avoid.

The probe refuses to let that happen quietly: it provokes one violation in the
app document before anything else, and if none is reported it says on screen and
in the report that the run is invalid.

## Build and run

A `--debug` build is enough. It is not a dev build — `tauri build` enables
`custom-protocol`, so Tauri serves the assets and the CSP is applied exactly as
in a release build — and it compiles faster and keeps devtools available.

```sh
MALLOW_PROBE=1 pnpm tauri build --debug --no-bundle
```

The binary lands in `src-tauri/target/debug/mallow` (`mallow.exe` on Windows).
Run it directly; the probe replaces the whole window.

If `pnpm <script>` aborts in your shell with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, run the two halves by hand:

```sh
MALLOW_PROBE=1 ./node_modules/.bin/tsc
MALLOW_PROBE=1 ./node_modules/.bin/vite build
node node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle \
  --config '{"build":{"beforeBuildCommand":""}}'
```

Afterwards, rebuild the frontend without `MALLOW_PROBE` so `dist/` holds the app
again.

## In the app

1. Leave the palette on a dark one — AC #11 is about what a document looks like
   under a dark palette, and the light palettes cannot show it.
2. Press **Run all checks**. It takes about fifteen seconds; the last check
   deliberately tries to navigate the app away, so let it finish.
3. Press **Pick a local image** and choose any image on disk — `src-tauri/icons/32x32.png`
   in this checkout will do. This is the `asset:` half of AC #16; it needs a file
   outside the bundle, so it cannot be automated away.
4. Fill in the **Recorded by hand** fields. Four of them cannot be measured from
   script:
   - **wheel scrolling** (AC #12) — put the pointer over the tall document and
     scroll. Does the page behind it move?
   - **keyboard scrolling** (AC #12) — click a heading inside the tall document
     so focus lands there, then press PageDown / ArrowDown. Does the page move?
   - **canvas colour and contrast** (AC #11) — for the unstyled document and for
     the `color-scheme` one: is the paper white or the app's dark surface, and is
     the text readable?
   - **WebView version** (AC #9) — prefilled from the user agent, which is only
     right on Windows. `Edg/…` is the WebView2 runtime version. macOS and Linux
     both report a frozen `AppleWebKit/605.1.15`: on macOS record the OS version
     instead, and on Linux get the real one from the package manager
     (`pkg-config --modversion webkit2gtk-4.1`, or `apt list --installed | grep webkit2gtk`).
5. Copy the report out of the box at the bottom and send it back. One report per
   platform.

## What "the run was valid" means

Two positive controls have to pass, and the report says so in its first line:

- **the app-origin script runs in the parent** (AC #14). The sandbox is probed
  with `/probe-marker.js`, an external script at the app origin that
  `script-src 'self'` permits. An inline script could not do this job: with a
  broken sandbox and an intact CSP it would still be refused, and the check would
  pass while the layer under test was broken. But if that file were simply
  missing, its absence in the frame would look exactly like containment — so it
  is loaded into the parent first.
- **a CSP is in force** (AC #15). Read off a real violation rather than from
  `tauri.conf.json`, because what ships is not what is configured: the sha256 of
  `index.html`'s inline bootstrap script is added to `script-src` at build time.

Blocked remote subresources are likewise judged by whether a
`securitypolicyviolation` was reported, not by whether they loaded. They point at
`probe.invalid`, a TLD that can never resolve — so "it did not load" would be
true with no CSP at all, and only the violation event distinguishes the two. The
one remote reference that must **load** is an image, and it does need the
network; its CSP verdict and its load verdict are reported separately so an
offline machine cannot be mistaken for a CSP failure.
