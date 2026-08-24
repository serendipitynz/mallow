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

`pointer-events: none` **and** `tabindex="-1"`, rather than removing the `href`:
the click never reaches the anchor and the keyboard cannot reach it either, while
`:link` still matches and the document keeps the styling its author gave it.
Both are needed and neither is redundant — `pointer-events` suppresses
hit-testing and nothing else, so without the second a reader who tabs to the link
and presses Enter gets the navigation this decision exists to remove. It applies
to `<area href>` as well as `<a href>`: an `<area href="page.html">` resolves
against the parent's base URL exactly as an `<a>` does, and areas are tabbable,
so the keyboard half is closed the same way. **The click half is not measured for
it** — an `<area>` has no box of its own, the hit region belongs to the `<img
usemap>`, and whether a UA consults the area's `pointer-events` for that region
is engine-dependent. It is listed below as a probe case rather than claimed
here. A link that looks like a link and does nothing is
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
  `#` link and a relative link, clicked for real — and a link reached by keyboard
  and activated with Enter, since that path is neutralized by a different
  mechanism than the click — belong beside the checks that are already there.
- **Whether `pointer-events: none` neutralizes an image-map area's click is
  unmeasured.** The keyboard path is closed for it either way. If it turns out
  not to apply, a mapped region clicked on WebKit navigates the frame and blanks
  the view — the failure this decision removes for `<a>`. Image maps are rare in
  what this view opens, which is why it is a probe case and not a blocker.
- **A `<meta http-equiv="refresh">` resolves against the same base URL and is not
  neutralized here, because it does not need to be**: TASK-5.1's visual round
  watched `rendered-inert.html` and the frame stayed where it was. That is one
  engine's answer, so the probe should carry it rather than this decision
  asserting it for all three.

## Amendment — the `<area href>` case, closed (TASK-25, 2026-08-24)

**The body above is left as it was written.** It claimed the click half applied
to an `<area href>` only as far as listing it below as a probe case, and the
consequence it recorded — "if it turns out not to apply, a mapped region clicked
on WebKit navigates the frame and blanks the view" — is what happened.

**Measured (TASK-23 round 3, one built probe run per engine, all three
WebViews).** With this decision's pass applied, `tabindex="-1"` held and
`pointer-events: none` did not: the click reached the area and the frame
navigated to the area's own destination. On WebView2 it reached the same end by
the other route — the pass is never applied there, and the parent's handler
matches `a[href]`, which an `<area>` is not, so nothing called
`preventDefault`. **Neither half of this decision covered both routes.**

**Amended decision: an app-origin `<area href>` has its `href` removed in the
transform, ahead of the branch on parent-registered listeners.** It stops being a
hyperlink, so a click on the region has nothing to activate and neither route has
anything left to travel. `tabindex="-1"` is still written, so the mechanism this
decision measured as working is not withdrawn.

- **The `<a>` case is unchanged**, and so is the reason it is: removing an
  anchor's `href` costs the document its link styling, which is what the third
  option above was rejected on. **That reason does not carry over.** An `<area>`
  has no box of its own, so nothing about it is styled and there is nothing to
  lose — which is what makes this the same decision applied to a different
  element rather than a reversal of it.
- **Placed before the branch rather than in both halves of it.** Two mechanisms
  would each answer for one engine family, and the probe — which arms the app's
  own pass, not a copy — could then only ever measure the branch the engine it
  runs on happens to take. One pass ahead of the branch is measurable on every
  engine, and it also closes the keyboard path on WebView2, where nothing had
  closed it.
- **`neutralizeAppOriginLinks` selects `a[href]` only from here on**, and the
  parent's click handler still matches `a[href]` only. Widening the pass would
  leave a branch nothing reaches; widening the handler would, on WebView2 alone,
  newly hand a mapped `http(s)` region to the OS browser — a capability, not this
  fix.
- **`counts.links` now counts `area[href]` on the same two classes as `<a>`.**
  Its app-origin half is settled here; its `http(s)` half rides decision-9's
  argument, since `frame-src` answers for the destination and not for the element
  that asked. TASK-19's reader-facing text gains the one thing a reader could
  otherwise read as a fault: an image map does nothing on *every* platform, not
  only where the others do nothing.
- **A "neutralized link" (defined above) is not what an `<area>` becomes.** That
  term is for a link that stays visible, styled and readable while activating
  nothing. An area with no `href` is not a link at all, and calling it
  neutralized would make the term cover two different states.
- **Still provisional in the same way the body is.** If `<base
  href="about:srcdoc">` is ever measured and adopted, it settles the app-origin
  class at its root for `<a>` and `<area>` together, and this amendment goes with
  the pass it amends.

### Re-measured after the amendment (2026-08-24, all three WebViews)

Built probe runs, one per engine, reports at
`_sandbox/handoff/task-25/task-25-{mac,win,linux}.md` (all three report
`Run validity: both positive controls passed`).

- **Armed raw**, the mapped region navigated the frame to the area's own
  destination on WKWebView, WebView2 and WebKitGTK alike — the positive control
  this amendment needed, since a region that does nothing when neutralized is
  only evidence if it did something when it was not.
- **Armed with the pass**, the frame stayed on `about:srcdoc` on all three, with
  no `area[href]` left on the fixture.
- **The click is not what goes — the activation is.** On WebView2 the
  neutralized region still hit-tested: the probe counted it as
  `area-link (not a link)`, twice, against no navigation. So an `<area>` with no
  `href` is not a region that stops receiving clicks; it is a region whose click
  has no hyperlink to activate. The earlier wording ("the click falls through to
  the image beneath") was the obvious reading and is wrong. **So is the body's own
  explanation above** — that the hit region belongs to the `<img usemap>` and the
  area's `pointer-events` is never consulted for it. Read it as the reading of the
  day rather than as a mechanism this decision asserts: what is measured is that
  `pointer-events: none` does not stop the click, and that the click reaches the
  area on the one engine where a listener can say so.
- **decision-9's `frame-src` argument, which this amendment leans on for the
  `http(s)` half of `counts.links`, was measured for an `<area>` too**: clicked
  in a built app, an `<area href="https://…">` moved the frame on none of the
  three platforms. **The causal half rests on one leg** — on macOS the same region
  did move the frame under `pnpm tauri dev`, which has no CSP at all, and that
  contrast is what names the CSP; Windows and Linux contribute the outcome, not
  the attribution. A run of the same fixture in the app rather than the probe, so
  it is the rendered view a reader gets.
