# The probe — how to run it

A measuring instrument, not part of mallow. It builds only when `MALLOW_PROBE=1`
is set, and the ordinary build does not contain a byte of it.

It was built for TASK-7 and grew a second section for TASK-5.1, whose transform
has to be exercised on a real engine (see **The transform section** below). The
two are kept apart on screen and in the report, because their `#N` are different
tasks' acceptance criteria.

TASK-7's part answers whether the two behaviours decision-3 rests on actually
hold on this project's three WebViews:

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

So the only run mode that measures anything is a build. TASK-7's description
used to offer `devCsp` as an alternative and no longer does: a run that took it
would have reported every CSP check as failing and every sandbox-only check as
passing — the both-layers-conflated result the task exists to avoid.

The probe refuses to let that happen quietly: it provokes one violation in the
app document before anything else, and if none is reported it says on screen and
in the report that the run is invalid.

## Build and run

A `--debug` build is enough. It is not a dev build — `tauri build` enables
`custom-protocol`, so Tauri serves the assets and the CSP is applied exactly as
in a release build — and it compiles faster and keeps devtools available.

macOS / Linux (bash, zsh):

```sh
MALLOW_PROBE=1 pnpm tauri build --debug --no-bundle
```

Windows (PowerShell). It has no `VAR=value command` prefix form, so the variable
is set as its own statement — which means it stays set for the rest of the
session and the next ordinary build in that window would silently be a probe
build. Remove it when you are done:

```powershell
$env:MALLOW_PROBE = "1"
pnpm tauri build --debug --no-bundle
Remove-Item Env:MALLOW_PROBE
```

Windows (cmd.exe) has the same stickiness, and `set` leaves no way to unset
other than an empty assignment:

```bat
set MALLOW_PROBE=1
pnpm tauri build --debug --no-bundle
set MALLOW_PROBE=
```

The binary lands in `src-tauri/target/debug/mallow` (`mallow.exe` on Windows).
Run it directly; the probe replaces the whole window.

If `pnpm <script>` aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` —
a stale project-local store, not a repository problem — run the halves by hand
instead. On PowerShell the `--config` argument needs doubled inner quotes,
because PowerShell strips one layer before the CLI sees it:

```sh
MALLOW_PROBE=1 ./node_modules/.bin/tsc
MALLOW_PROBE=1 ./node_modules/.bin/vite build
node node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle \
  --config '{"build":{"beforeBuildCommand":""}}'
```

```powershell
$env:MALLOW_PROBE = "1"
./node_modules/.bin/tsc
./node_modules/.bin/vite build
node node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle `
  --config '{""build"":{""beforeBuildCommand"":""""}}'
Remove-Item Env:MALLOW_PROBE
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
4. Press **Arm the click test**, then click the link and the button inside that
   frame with the mouse. A synthetic click is not what link interception has to
   survive; the counters say which attachment points, if any, heard a real one.
5. Press **Arm the late-layout test**, wait for the image to load, then open the
   `<details>` inside that frame. This is how TASK-5.2 learns which mechanism can
   tell it the frame got taller.
6. Fill in the **Recorded by hand** fields. Four of them cannot be measured from
   script:
   - **wheel scrolling** (AC #12) — put the pointer inside the tall document's box
     and turn the wheel. Does the `scrollTop` readout beside its heading change?
     That number is the whole criterion.
   - **keyboard scrolling** (AC #12) — press **Focus a heading inside the tall
     frame** first: that is what puts focus inside the frame, and clicking a
     heading does not. Then press PageDown / ArrowDown and watch the same readout.
   - **canvas colour and contrast** (AC #11) — for the unstyled document and for
     the `color-scheme` one: is the paper white or the app's dark surface, and is
     the text readable?
   - **WebView version** (AC #9) — prefilled from the user agent, which is only
     right on Windows. `Edg/…` is the WebView2 runtime version. macOS and Linux
     both report a frozen `AppleWebKit/605.1.15`: on macOS record the OS version
     instead, and on Linux get the real one from the package manager
     (`pkg-config --modversion webkit2gtk-4.1`, or `apt list --installed | grep webkit2gtk`).
7. Press **Run the transform checks** in the TASK-5.1 section. It needs no
   interaction and takes no time; its verdicts go into their own table.
8. Copy the report out of the box at the bottom and send it back. One report per
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
- **a click driven from the parent reaches a listener the parent registered**,
  and separately **something the frame is asked to activate actually activates**.
  Two controls, because most of the blocked-item checks pass by absence and the
  two failures are not the same failure. The first clicks a control element and
  asks whether any listener heard it; the second clicks a `<summary>` and reads
  `details.open` back, which is UA behaviour with no script involved. Where either
  fails, the checks resting on that one report `inconclusive` rather than passing.

  They can disagree, and where they do the report says so rather than collapsing
  them: a click that no listener hears may still have arrived and activated. Read
  the two values on the run in front of you; neither is a property of a platform
  that can be assumed from a previous run.

Blocked remote subresources are likewise judged by whether a
`securitypolicyviolation` was reported, not by whether they loaded. They point at
`probe.invalid`, a TLD that can never resolve — so "it did not load" would be
true with no CSP at all, and only the violation event distinguishes the two. The
one remote reference that must **load** is an image, and it does need the
network; its CSP verdict and its load verdict are reported separately so an
offline machine cannot be mistaken for a CSP failure.

## The transform section (TASK-5.1)

`lib/html-doc`'s pure halves — the URL rules, the `srcset` split, the counting —
are unit-tested under Node. Two things about the transform are properties of the
*engine* and cannot be established there, which is what this section measures:

- how the engine normalises markup a regex gets wrong — uppercase tags, a newline
  inside a tag, unquoted attribute values, `srcset` paths containing commas —
  before the transform ever sees the document;
- whether removing `<base>` and nested frames from a live document actually
  leaves them out of both the serialized string **and** the document the engine
  rebuilds from it.

It also renders one transformed document into a frame with the app's sandbox
flags and reads back `compatMode` and a computed colour, which is the check that
the doctype survived and that a document's own `<style>` applies inside the
frame.

Unlike TASK-7's checks, none of these depend on the CSP, so they mean the same
thing in any run mode. Everything else in this file still applies: the run that
is worth recording is a built one.
