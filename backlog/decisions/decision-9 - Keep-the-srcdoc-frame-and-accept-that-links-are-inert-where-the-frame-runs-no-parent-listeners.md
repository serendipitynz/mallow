---
id: decision-9
title: >-
  Keep the srcdoc frame and accept that links are inert where the frame runs no
  parent listeners
date: '2026-08-18 01:16'
status: accepted
---
## Terms

- **parent-registered listener** — an event listener the app document's code adds
  with `addEventListener` to a node inside the frame's document, or to that
  document or its window.
- **link interception** — the parent stopping a click on a link inside the frame
  from navigating, and acting on it instead.
- **inert link** — a link that neither navigates the frame nor opens anything
  anywhere.
- **reach-in** — parent-side reading and writing of the frame's document that
  involves no event delivery: `contentDocument`, computed styles, node injection,
  `scrollIntoView`, `focus()`.
- **late layout** — a height change the frame's document undergoes after its
  first layout.
- **observed** vs **listened for** — learning about a change through an observer
  or a poll, versus through a listener inside the frame.

## Context

decision-3 chose isolated-frame rendering: HTML fed to an iframe through `srcdoc`
with `sandbox="allow-same-origin"` and deliberately no `allow-scripts`. It rested
on two behaviours that were specified but unobserved on this project's WebViews,
and said that if either failed the decision would reopen rather than be worked
around. TASK-7 measured them on WKWebView (macOS 26.6.1), WebView2 151.0.0.0
(Windows 11 25H2) and WebKitGTK reporting WebKit 60.5 (Ubuntu 24.04.4, aarch64).

**Both behaviours hold on all three, so decision-3 does not reopen and the
srcdoc-iframe approach stands.** The frame stays same-origin while no script in
it runs, and the document inherits the parent CSP. The full record, including how
each was measured and the positive controls each rests on, is TASK-7's comment.

What TASK-7 also found is that three *mechanisms* decision-3 specifies are not
what the WebViews actually do. This decision amends those three. It does not
supersede decision-3: the frame, the sandbox flags, the removal list, the URL
rewriting, the notice bar and the source-view fallback are all unchanged.

The finding that forces this is one measurement. On a real mouse click inside the
frame, six counters — a listener on `contentDocument` in the bubble phase, the
same in the capture phase, one on `contentWindow`, one on the element itself,
`mousedown` on `contentDocument`, and a custom event the parent dispatches
synchronously into that same document — are **all zero on both WebKit engines and
all non-zero on WebView2**. The custom event is what makes the reading general:
clicks are not being lost, **a document with scripting disabled runs no
parent-registered listener at all**. Reach-in is unaffected and works everywhere.

## Decision

**An `http(s)` link inside a rendered document is inert wherever the frame runs
no parent-registered listener, and that is accepted rather than worked around.**
That is the measured half. What a `#` link does there was not measured and is
left open for TASK-5.2 to observe — the Consequences say why the obvious answer
is not yet an answer.

Where listeners do run — WebView2 today — decision-3's interception is
implemented as written: fragment links are `preventDefault`-ed and scrolled by
the parent, `http(s)` links go to the OS browser, every other scheme is inert.
Where they do not, an `http(s)` link is inert; what a `#` link does there is
inferred rather than measured and is TASK-5.2's to settle (see the Consequences).
The behaviour is therefore platform-dependent, and that difference is itself part
of the contract: the notice bar says so (TASK-5.3) and the user-facing
documentation says so (TASK-19).

**This costs no containment.** An intercepted click was never what stopped the
frame going anywhere — `frame-src` is, and it does: with interception removed,
the frame did not navigate on either WebKit engine. What is lost is a feature.
The escape hatch is the one decision-3 already requires: open the file outside
mallow.

The two alternatives were weighed and declined.

- **Rewriting every `href` away at transform time**, so links are inert
  everywhere. It buys uniform behaviour and simpler documentation, at the cost of
  throwing away a feature that demonstrably works on one of the three platforms.
- **Dropping the `sandbox` attribute and relying on the inherited CSP alone.**
  Listeners would run, so interception would return everywhere. It costs the two
  protections only the sandbox provides: form submission becomes unrestricted
  (`form-action` is absent from the CSP, and it has no fallback), and a
  `target="_top"` link could navigate the app away. It also converts a
  deliberately two-layer containment argument into a one-layer one, which
  decision-3 refused on its own terms. Declined.

**Adding `allow-scripts` remains out of the question** and is not made more
attractive by this: with `allow-same-origin` in place, script in the frame is
script in the app origin, and `read_file` / `read_dir_tree` are plain `std::fs`
with no scope and no capability gating.

**Keyboard scrolling is not forwarded, because it does not need to be.**
decision-3 says wheel events chain to the parent but keyboard events do not, and
requires forwarding. With focus genuinely inside the frame — `tabindex="-1"` plus
`focus()`, which is what `Outline` does, confirmed by the frame's `activeElement`
becoming the target heading — PageDown moves the parent scroller on all three.
Forwarding would have been a `keydown` listener, so had it been needed it would
have been unimplementable on exactly the two platforms that need it most.

**Late layout is observed, never listened for.** decision-3 requires the height
to be re-measured after images and `<details>` change the layout. A `load`
listener on the image inside the frame is a parent-registered listener and did
not fire on any of the three. What did:

| mechanism | macOS | Windows | Linux |
|---|---|---|---|
| `load` on the iframe **element** (it lives in the app document) | fires | fires | fires |
| `load` on the `<img>` **inside** the frame | no | no | no |
| `ResizeObserver` on the frame's `documentElement` | reports | reports | reports |
| `MutationObserver` on the frame's document | reports | reports | reports |
| polling `scrollHeight` | sees it | sees it | sees it |

So TASK-5.2 re-measures from a `ResizeObserver` on the frame's `documentElement`,
with a `MutationObserver` for changes that move no box the observer watches, and
polling only as a backstop. The image listener's silence on WebView2 is
unexplained — clicks are delivered there — and nothing rests on it.

**`scrollIntoView` on an element inside the frame does scroll the parent**, on all
three, and parent-side rect conversion plus `scrollTop` also lands the target
exactly. decision-3 assumed the first does not work and specified the second.
TASK-8 therefore chooses between two working mechanisms and must still name the
one it implements, rather than leaving `Outline`'s current call to decide by
accident.

## Consequences

- **A link that looks clickable and does nothing is a worse failure than a link
  that looks inert.** Where interception is unavailable the notice bar has to say
  it, in the same place it reports inert scripts and blocked external references.
  Counting links is therefore part of TASK-5.1's transform, not an afterthought
  in TASK-5.3.
- **The platform difference is discoverable only at runtime, not from the file
  kind or the document.** Whatever surfaces it must be driven by a capability
  probe rather than by a platform name: the boundary is "does this frame run a
  listener the parent registered", and a future WebKit release may move it. The
  cheapest honest probe is the one TASK-7 used — dispatch an event into the
  frame's document from the parent and see whether the listener runs — which
  costs one synchronous dispatch per document.
- **Fragment links are expected to be inert there too, but that is inference, not
  measurement.** TASK-7 clicked external links, not `#` ones. The inference is
  that the parent cannot hear the click and a frame sized to its own content has
  no viewport for native fragment navigation to scroll — but "no viewport to
  scroll" is the arrangement TASK-5.2 builds, not something TASK-7 observed, and
  a frame at its natural size would behave differently. **TASK-5.2 has to observe
  what a real click on a `#` link does before writing it down as inert**, and
  TASK-19 must not describe it as measured until then.

  The outline is unaffected either way: it is driven from the parent and uses
  reach-in, so it works everywhere. A document's own table of contents may not
  work on WebKit while the outline sitting beside it does; TASK-19 has to say so
  rather than let it read as a bug.
- **"The parent can reach into the frame" and "the parent can hear from the
  frame" are different capabilities, and only the first is available
  everywhere.** Any later design that wants an event out of a rendered document —
  copy buttons, `<details>` state persistence, in-document search hit
  highlighting — meets this same wall and should be checked against it before it
  is specified.
- **Nothing here changes the untrusted-input boundary**, so TASK-19 writes the
  same security contract decision-3 describes, plus this platform difference as a
  behavioural note. The two layers still are not independent across the board:
  decision-3's table stands, and a relative `<script src>` is still stopped by the
  sandbox alone.
- **The WebKit engines report no `securitypolicyviolation` inside a srcdoc
  frame.** They report them in the app document, so the app's own CSP diagnostics
  are unaffected, but anything that tries to count or surface refusals inside a
  rendered document will see nothing on two of the three platforms. Refusals there
  have to be established by effect, as TASK-7 did with a `data:` stylesheet
  against a `data:` image.
