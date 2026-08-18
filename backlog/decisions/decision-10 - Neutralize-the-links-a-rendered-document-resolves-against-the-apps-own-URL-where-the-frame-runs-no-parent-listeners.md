---
id: decision-10
title: >-
  Neutralize the links a rendered document resolves against the app's own URL,
  where the frame runs no parent listeners
date: '2026-08-18 22:22'
status: accepted
---
## Terms

- **app-origin link** — an `<a href>` whose value carries no scheme and is not
  protocol-relative: a bare fragment, a relative path, a root-absolute path, an
  empty value. Named for where it resolves, which is the point below.
- **parent-registered listener** — as decision-9 defines it: a listener the app
  document's code adds to a node inside the frame's document, or to that
  document or its window.
- **neutralized link** — a link the reader can see and read, styled as the
  document styles it, that activates nothing when clicked.

## Context

decision-9 accepted that an `http(s)` link inside a rendered document is inert
wherever the frame runs no parent-registered listener, and left one question
open: **what a real click on a `#` link does there was inferred, not measured.**
It said so explicitly, required TASK-5.2 to observe it before anything was
written down, and gave the reason the obvious answer was not yet an answer — the
click still activates on every platform, so the UA may perform the navigation
whether or not a listener hears it.

**TASK-5.2 observed it, in a built app on macOS (WKWebView), and the inference
was wrong.** A `#` link does not sit inert. The frame navigates: the console
reports `Blocked script execution in 'tauri://localhost#existing-id' because the
document's frame is sandboxed and the 'allow-scripts' permission is not set`, and
the rendered view is replaced by a blank page. A relative path does the same
(`tauri://localhost/rendered.html`). An `http(s)` link was inert, as decision-9
recorded.

The mechanism is the base URL. **A `srcdoc` document's base URL is the parent's
document URL**, so `#section` inside the frame is not a same-document link at
all: it resolves to the app's own URL plus a fragment, which is a different
document, and loading it is a navigation. The same holds for every href with no
scheme. `frame-src` does not stop it — **the destination is `'self'`** — which is
why `http(s)` links, whose destination `frame-src` does not carry, were inert
while these were not. decision-9's sentence "`frame-src` is what stops the frame
going anywhere" is therefore true of external destinations and false of the app's
own.

What the reader gets is worse than an inert link and worse than a broken one: the
app shell loads inside a sandboxed frame with its scripts refused, so the view
goes blank, and the frame offers no way back — recovery is ⌘← or selecting
another file in the tree.

## Decision

**Where the frame runs no parent-registered listener, the parent neutralizes
every app-origin link in the document at load, by setting `pointer-events: none`
on the anchor.** Where listeners do run, decision-9's interception is unchanged
and nothing is neutralized.

`pointer-events` rather than removing the `href`: the click never reaches the
anchor, so nothing activates, while `:link` still matches and the document keeps
the styling its author gave it. A link that looks like a link and does nothing is
what decision-9 already accepted for `http(s)`; this puts app-origin links in the
same state rather than inventing a second one.

`http(s)` links are left alone. They are already inert, by the CSP, and that is
decision-9's accepted outcome — neutralizing them as well would add nothing and
would make the code claim a cause it does not have.

**This is provisional** (2026-08-19, user: "一旦 A で"). It is the option that
removes the destructive behaviour without touching the transform or the CSP, and
it can be replaced by either alternative below without re-deciding anything else.

The two alternatives were weighed and declined for now.

- **`<base href="about:srcdoc">` in the transform.** It changes what the base URL
  *is*, so a fragment becomes a genuine same-document link and relative paths stop
  resolving anywhere — the behaviour decision-9 assumed all along, obtained at its
  root rather than papered over, and uniform across platforms without a runtime
  probe. Declined for now because it is unmeasured on all three WebViews, `about:`
  URLs are not hierarchical so relative resolution is engine-dependent, and
  TASK-5.1 removed `<base>` from documents deliberately; putting one back is a
  change to that transform and wants its own measurement round.
- **Removing the `href`.** Certain, and it costs the document its link styling —
  `:link` stops matching, so a document's own visual distinction between prose and
  links disappears. Rejected on that alone: the rendered view exists to show the
  document as its author styled it.

**Nothing here changes the containment argument.** No link was ever what kept the
frame in place, and neutralizing one adds no protection: a navigation to the app
shell inside a sandboxed frame is not an escape, since `allow-scripts` is absent
and nothing in it runs. What is fixed is a usability failure, not a hole.

## Consequences

- **TASK-5.3's notice bar has an answer now, and it is not "links are inert".**
  Where listeners do not run it has to say that the document's own links — its
  table of contents included — do nothing, which is a stronger statement than
  decision-9's `http(s)` clause and covers more links. TASK-19 says the same to
  the reader.
- **A document's own table of contents does not work on WebKit; the outline
  beside it does.** decision-9 already required TASK-19 to say so rather than let
  it read as a bug. That is now measured rather than expected.
- **"`frame-src` stops the frame going anywhere" is only true of destinations
  `frame-src` does not carry.** Any later reasoning that leans on the CSP to hold
  the frame in place has to name the destination first. Tightening `frame-src` to
  drop `'self'` would settle it at the CSP layer instead, but whether the `srcdoc`
  load itself survives that is unmeasured on all three engines, so it is not
  offered here as a third option.
- **The probe in `src/probe/` should gain this case.** TASK-7 clicked external
  links only, which is exactly why this reached a user rather than a fixture. A
  `#` link and a relative link, clicked for real, belong beside the checks that
  are already there.
