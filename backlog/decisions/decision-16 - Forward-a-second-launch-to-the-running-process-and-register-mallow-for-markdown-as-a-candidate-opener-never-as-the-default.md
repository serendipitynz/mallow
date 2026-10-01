---
id: decision-16
title: >-
  Forward a second launch to the running process, and register mallow for
  markdown as a candidate opener, never as the default
date: '2026-10-01 08:09'
status: accepted
---
## Context

TASK-38: mallow could only be given a location from inside itself — the folder
picker, Open Recent, or a restored session. A file or folder handed to it by the
OS did nothing.

**There are three routes, and they are structurally different**, so they are
named apart throughout:

| route | how the path arrives | where it exists |
|---|---|---|
| a command-line argument | the process's argv | every platform for a CLI invocation; the route a Windows or Linux file association takes |
| `RunEvent::Opened { urls }` | an event on the running app | **macOS only** — tauri-2.11.3 compiles the variant on `cfg(any(macos, ios, android))` (`src/app.rs:257-266`); a Finder double-click, Open With and `open -a` arrive here, not in argv |
| a drop onto a window | the webview's drag-drop event | every platform, independent of any OS registration (`dragDropEnabled` is tauri's default) |

Two questions had to be settled before any of it could be built, and both were
the user's to answer (2026-10-01).

**1. What happens when mallow is already running.** On Windows and Linux a file
association starts a second process. `recent.rs`, `session.rs` and `settings.rs`
each hold a lock that is the whole reason Rust owns their state — several writers
read-modify-writing one value lose entries — and a second process is outside all
three. **This was already reachable before TASK-38**: launching mallow twice from
the Start menu or a launcher gives two processes today. Measured from the code
rather than on a machine, both then call their first window `w1`
(`WindowInitRegistry` is per process), so their rows in the restored session and
in `.window-state.json` collide by label, the process that exits last overwrites
the other's at exit, and `settings:change` reaches no window of the other process.

**2. Whether mallow claims a file type.** `bundle.fileAssociations` registers the
app with the OS, which changes the reader's machine rather than this app, and
read from the bundler at the pinned tauri-cli (2.11.4) the three platforms do not
register alike:

- **Windows**: the NSIS script (`FileAssociation.nsh`, `APP_ASSOCIATE`) and the
  MSI template (`main.wxs`, `<ProgId><Extension>`) both write the extension's
  default ProgID, and NSIS writes it again on every update. **There is no
  candidate-only mode in tauri**; `rank` and `role` are macOS-only. Whether a
  default the reader chose explicitly (`UserChoice`) still wins is unmeasured.
- **macOS**: `rank: "Alternate"` (`LSHandlerRank`) lists the app under Open With
  and never makes it the default.
- **Linux**: `MimeType=` in the `.desktop` file. Whether a desktop environment then
  makes mallow the default for a type nothing else claimed is unmeasured.

## Decision

**1. A second launch is forwarded to the running process, which then opens what
it was handed; the second process exits without opening a window.** The mechanism
is `tauri-plugin-single-instance` (the user approved the dependency): a Unix socket
on macOS, the DBus session bus on Linux, a hidden window's `WM_COPYDATA` on
Windows. It is pinned to `~2.4.5`, because 2.5 requires `tauri ^2.12` and mallow is
on 2.11.3 — taking 2.5 would move tauri, which every pinned citation in AGENTS
rests on. It is registered **first**, so the relaunched process ends inside its
setup before the session plugin's setup writes settings.json and the window-state
file; and it exits through `cleanup_before_exit` and `process::exit`, which run no
plugin's exit hook. A relaunch carrying no path brings the most recently focused
window forward. **An unattended build registers none of this**, since forwarding a
measurement run's document to a reader's running mallow would export nothing.

Forwarding was chosen over the two alternatives: accepting a second process would
have written the collisions above into the contract as known behaviour, and
registering nothing and parsing no argv would have left Windows and Linux with the
drop as the only route — and left the two-launch collision exactly where it is.

**2. mallow registers itself for markdown and mermaid as a candidate opener, and
never as the default.** Concretely:

- macOS: `md`, `markdown`, `mmd`, `mermaid` with `rank: "Alternate"` and
  `role: "Viewer"` (`src-tauri/tauri.macos.conf.json`).
- Linux: `md` and `markdown` as `text/markdown` (`src-tauri/tauri.linux.conf.json`).
  Mermaid has no freedesktop MIME type to declare, so it is not registered there.
  The `.desktop` file comes from `src-tauri/linux/mallow.desktop`, which is
  tauri's own template with `%F` added to `Exec`: the stock template has no field
  code, and without one a launcher is not required to pass the file at all.
- **Windows: nothing is registered**, because the only registration tauri can
  write takes the default. A reader who wants mallow there chooses it under
  "Open with → Choose another app", which hands the path as an argument — the
  first route. A candidate-only registration (`OpenWithProgids`) would need an
  installer script of mallow's own for NSIS and another for MSI, and was declined.

Other kinds are not registered: claiming JSON, images, PDFs or HTML from whatever
already opens them is not something a viewer should do by being installed.

**3. Where a handed location opens** (decided with the two above; the user raised
no objection):

- The first two routes follow Open Recent's new-window branch: **a window already
  showing the folder is brought forward and the location opens there; otherwise
  the most recently focused window showing no folder is used; otherwise a new
  window is created.** The focused window's folder is never replaced, because
  nothing in those routes points at a window.
- A drop names its window, so it **replaces that window's location**, as the
  picker does. Of several dropped items the first is opened and the reader is told
  how many were dropped.
- A file opens **its own folder with the file selected** — a window carries one
  folder (decision-4).
- A location handed at launch opens **in addition to the restored session**, so
  the result does not depend on whether mallow was already running. Arrivals are
  held until the restored windows exist, since routing earlier would race the
  restore for a window label.
- **Every handed location goes through `openLocation`** — as a created window's
  initial location, or as an item a live window takes from its queue — so it gets
  the `allow_media_dir` grant and the watch.
- A path that does not exist, a file whose extension maps to no kind, and a URL
  that is not `file:` are **reported in a notice** rather than opened. A folder is
  a valid location on every route, so a folder where a file might have been
  expected is opened, not reported.

## Consequences

- The two-launch collision is closed on all three platforms as a side effect,
  **except where the forwarding channel is missing**: on Linux without a DBus
  session bus the plugin finds no running instance to talk to and the second
  process launches as before. That is the old behaviour, not a new failure.
- `tauri-plugin-single-instance` cannot move to 2.5 without tauri moving to 2.12;
  the pin in `Cargo.toml` says so. A tauri upgrade lifts it.
- On Windows the drop and "Choose another app" are the only ways in from the OS;
  README says so, so the absence of a registration does not read as a defect.
- What reaches the frontend as an argument is every non-flag argv entry, resolved
  against the launching process's working directory and folded lexically rather
  than canonicalized, so that "already showing this folder" stays the exact string
  comparison `session.rs` and `recentFolders` use.
- **Each route was measured only where noted in TASK-38**; a route measured on one
  platform is not evidence for another.

## Addendum (2026-10-02, after the v0.9.0 release)

**"Never as the default" holds for what mallow writes, not for what every desktop
does with it.** Measured on Ubuntu 24.04.4 LTS (GNOME) with the v0.9.0 deb, on a
machine where no default had been chosen for `.md`: installing mallow **made it
the default**. The Linux bullet in Context left exactly this unmeasured. The
mechanism is inferred rather than measured: with no default recorded, GIO prefers
an application declaring the exact type over one declaring a parent type, the
stock text editor declares `text/plain`, and mallow was the only one declaring
`text/markdown`.

The registration is kept (the user's choice, 2026-10-02). Dropping `MimeType=`
would also take mallow out of the file manager's Open With list, which the same
round measured working, and **the freedesktop `.desktop` format has no
candidate-only rank** — `InitialPreference=` is KDE's alone — so on Linux the
choice is between registering and possibly becoming the default where nothing
was chosen, and not registering at all. README says this to the reader instead.

**The other two platforms' "unchanged" results do not cover the case Linux
failed in.** On Windows and macOS the default was left as it was, but the reader
had already chosen an app for `.md` there. On Windows that changes nothing, since
nothing is registered to compete with the choice. **On macOS a Mac where nothing else claims the type is
unmeasured**: `Alternate` ranks below an `Owner` or `Default` claim, which is not
the same as never being chosen when no such claim exists.
