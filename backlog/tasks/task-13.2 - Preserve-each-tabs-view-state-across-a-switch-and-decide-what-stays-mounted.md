---
id: TASK-13.2
title: 'Preserve each tab''s view state across a switch, and decide what stays mounted'
status: To Do
assignee: []
created_date: '2026-08-05 21:47'
labels:
  - feature
dependencies:
  - TASK-13.1
parent_task_id: TASK-13
priority: high
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What a tab has to remember while it is not the active one, and how much of it stays in the DOM. Split from TASK-13.1 because it is the half that decides whether tabs feel like tabs: a strip that loses your place on every switch is worse than no strip.

## Correctness first, retention second

Per decision-4, preserving tab view state must not depend on an inactive tab's DOM staying mounted. Capture on deactivate, restore on activate, through the anchor machinery `src/lib/scroll.ts` already has for live reload - `captureScrollAnchor` prefers the topmost heading still in view and falls back to a scroll ratio, which is exactly the robustness a re-rendered document needs.

Doing it the other way round - keeping every tab mounted and letting the engine preserve `scrollTop` behind whatever hiding mechanism is chosen - would make the feature's correctness depend on unverified per-WebView behaviour (`display: none` removes the layout box, and what happens to `scrollTop` across WKWebView, WebView2 and WebKitGTK has not been measured in this project). With the anchor route, retention becomes a re-render-cost optimisation that can be tuned or reverted without touching correctness - with the single behavioural exception in "Retained media keeps playing" below.

**Capture strictly precedes hiding, and this is an invariant rather than an ordering preference.** `captureScrollAnchor` reads `getBoundingClientRect()` (`src/lib/scroll.ts:12-17`), so against a **hidden** container every rect is zero and it returns a confident-looking "first heading, offset 0" - a wrong anchor, not a missing one. (An unmounted container is the safe case: the ref is null and `:11` returns null. Hiding is what silently corrupts.) The existing call site already depends on the same ordering and says so (`src/components/MarkdownView.tsx:53-54`, "Capture against the still-mounted previous content before swapping it").

## Where the state lives, and the plumbing it needs

The record is owned by the tab store (one entry per tab path, discarded when that tab closes and cleared wholesale when the folder change of decision-4's decision 7 empties the tab set - so reopening a file starts at the top rather than resuming a position from before it was closed) and handed down; the view components report changes back up. `MarkdownView` currently takes only `source` and keeps `mode` in local state (`src/components/MarkdownView.tsx`), and it is the only component that holds the two things being preserved - `scrollRef` and `result.headings`, without which no anchor can be captured. So the capture call has to stay inside it while the *storage* moves out.

**The record has to be able to say "no mode stored yet", and the default stays with the view.** `MarkdownView`'s default is the constant `'preview'` (`src/components/MarkdownView.tsx:40`), but `ConfigView`'s depends on the parse result - `useState(outcome.ok ? 'tree' : 'source')` (`src/components/ConfigView.tsx:18`) - and the tab store cannot know whether a document parsed. Fixing a default in the store would open a broken JSON file in tree mode and lose the view's own answer, so the store carries "unset" and the view decides.

The restore direction needs a route too, not just the capture direction: `MarkdownView` applies an anchor through a private `pendingRestore` ref, so re-mounting a tab that was unmounted means seeding that ref from the record instead of leaving it null. Both directions cross the same boundary, and only one of them is obvious from the existing code.

What is preserved, per file kind:

- **markdown** - the preview/source selection and the scroll anchor, **in both modes** (see the source-mode gap below).
- **mermaid** - scroll position only; `MermaidView` has no mode.
- **json / yaml / toml** - `ConfigView`'s tree/source selection and the scroll position. The config tree's *expansion* state is explicitly not included; it is already a known follow-up in AGENTS.md for live reload, and widening it here would mean solving that first.
- **text / ini / diff / sql / html** - scroll position only. TASK-1 and TASK-2 route these straight to `SourceView`, which has no mode of its own, so there is no selection to record alongside the position. The asynchronous-fill caveat below applies to them for the same reason it applies to `ConfigView`'s source mode. **html gains a mode once the rendered view lands** (decision-3 makes it the default and this view the other half of a toggle), at which point it moves to the markdown/config shape rather than staying here.
- **`ViewerBody`'s `default:` arm** - scroll position only, and **not exercisable, which neither TASK-1 nor TASK-2 changed**: every kind in `FileKind` is either routed by name, early-returned as media, or a directory the tree never selects (`TreeItem`'s `activate` toggles a directory rather than selecting it). An earlier draft of this task expected TASK-1 and TASK-2 to make the arm reachable; both instead routed their kinds by name, so the arm stays unreachable. Give it the same handling as the kinds above and say in the criteria that it cannot be exercised.
- **media** - no view state. `MediaView` has no mode, and a PDF rendered in an `<iframe>` exposes no scroll position to read (AGENTS.md already records that the frame gives no reliable signal at all). Playback is a separate matter - see below.

**Three kinds do not get the anchor machinery for free, despite the paragraph above** - and neither does markdown's own source mode. It is wired into `MarkdownView`'s *preview* branch only:

- `ConfigView`, `MermaidView`, the shared text / ini / diff / sql / html arm and the `default:` arm each render a bare `.doc-scroll` with **no ref on it**. `captureScrollAnchor` needs the container element, so adding those refs is prerequisite work, not a detail.
- None of them has headings, so every capture takes the ratio branch (`src/lib/scroll.ts:19-20`), which divides by `scrollHeight`. **The next-frame second restore is needed by the asynchronously-filled ones specifically**, and it is worth being exact about which those are, because two of the four views above are synchronous: `ConfigView` in source mode goes through `SourceView`, which fills its DOM once Shiki resolves (`src/components/ConfigView.tsx`, `src/components/SourceView.tsx`) — **except above the caps in `src/lib/source-cap.ts`, where it skips Shiki and renders the text on first paint (decision-6), so the same view is asynchronous or not depending on the file's size** — and `MermaidView` fills after `renderMermaid`. The five kinds TASK-1 and TASK-2 added go through the same `SourceView`, so they are asynchronous or not on the same size condition. `ConfigTree` and the `<pre className="raw-view">` of the `default:` arm render synchronously and need only the ref. So restore twice where the height is not final when the effect first runs - the same thing `MarkdownView` already does for mermaid (`:101`) - and do not attribute it to kinds that do not need it.
- **`MarkdownView` in source mode is in the same position, which is easy to miss because the kind "already works".** The effect that applies `pendingRestore` returns early unless the mode is `preview` (`src/components/MarkdownView.tsx:72`), so a tab left in source mode has no restore path at all, and its body is the same asynchronously-filled `SourceView`. Lift the restore out of that gate rather than leaving the per-kind table above claiming something the code does not do.

## Heading ids are unique per document, not per app

**Two mounted markdown tabs can carry the same heading id, and every heading lookup in the app is document-wide.** `renderMarkdown` resets its slugger per render (`src/lib/markdown.ts:290`, slugified at `:266`), so slugs are unique *within* one document and nothing more - two `README.md` files both emit `id="install"`. The four lookups that matter all call `document.getElementById`, which returns the first match in DOM order: `src/lib/scroll.ts:14` (capture), `:27` (restore), `src/components/Outline.tsx:29` (scroll spy) and `:57` (jump on click). `MarkdownView`'s click handler is a fifth, by omission - it returns early for `#` links (`src/components/MarkdownView.tsx:80-84`) and lets native fragment navigation resolve them, which is document-wide too.

So retaining more than one markdown tab breaks all four, and none of them fails loudly: capture is pushed off the heading branch onto the ratio fallback, restore moves the scroller by the wrong delta, the Outline's scroll spy highlights whatever the other document's copy of that slug happens to be doing, and an Outline click `scrollIntoView`s a hidden element and looks dead.

**Resolve every heading lookup against the active tab's own scroll container**, which is the seam TASK-8 exists to create: it parameterises exactly these two modules with an injected lookup root, defaulting to today's behaviour. If TASK-8 has landed, pass the tab's container instead of the default; if it has not, introduce that parameter here for the modules this task needs and let TASK-8 find it already in place. The fragment-link path needs the same treatment - resolve inside the container rather than early-returning to the native handler.

**Name the mechanism, because the obvious spelling throws.** A slug can start with a digit - a heading "1. Introduction" becomes `1-introduction` - and `container.querySelector('#1-introduction')` is a `SyntaxError`, not a miss. Use an attribute selector with the value escaped (`root.querySelector('[id="…"]')`, or `CSS.escape(slug)`). Prefixing slugs per tab is the rejected alternative: it would also have to rewrite the `href`s the Outline emits, and it changes the ids a document's own in-page links point at.

This is not an optional polish item. Without it, "retention is a cost decision, not a correctness one" is false, and the retention constant K could not be raised above zero for markdown at all.

## Retained media keeps playing

A retained tab is not purely a cost. `MediaView` renders `<video src controls>` (`src/components/MediaView.tsx`), and a hidden video that the user had started goes on playing and sounding from a tab they cannot see. **Pause on deactivate** - a rule, not a tuning choice, and the one place where the retention policy would otherwise change behaviour rather than just cost. The converse is worth stating too: an unmounted media tab loses its playback position, which is accepted rather than solved (the alternative is a per-tab `currentTime` record for a viewer whose job is documents).

The outline toggle stays app-wide, not per-tab: `MarkdownView` keeps it in `localStorage` under `doc-outline:open` today, and per-tab outline state is a preference nobody asked for.

## How much stays mounted

Keep the active tab plus the most recently active K others mounted; unmount the rest and let activation re-render them from the record. At launch that means **only the restored active tab is mounted** - a restored tab nobody has activated yet is not "recently active", so the retained set is not seeded from the first K in strip order. TASK-13.4 leans on this when it argues its cap is about reads and strip width rather than render cost. State the K that ships and the reason. This keeps a most-recently-active order over the tab set - which is **not** what `Ctrl+Tab` cycles (TASK-13.1 uses strip order deliberately, for visibility); do not wire one to the other.

**State how a retained inactive tab is hidden**, because three other things depend on the answer and it cannot stay "whatever mechanism is chosen": whether restore has to wait for layout (below), whether a PDF `<iframe>` reloads when it comes back, and whether a `<video>` keeps decoding. `display: none`, the `hidden` attribute, `visibility: hidden` with an offscreen position and `content-visibility` are not interchangeable here. One more input to that choice: `Viewer` renders `<main className="viewer">`, and HTML allows several `<main>` elements only while all but one carry `hidden` - so a CSS-only `display: none` leaves the document with multiple visible-to-the-parser `<main>`s, which the `hidden` attribute does not.

**Restore runs only after the container is visible and laid out - the mirror of the capture invariant above.** Against a container still hidden, `scrollHeight` and `clientHeight` are zero, so the ratio branch writes `scrollTop = 0` and the slug branch reads zero rects: the same confident-looking wrong value the capture rule exists to prevent, in the other direction. The next-frame second restore the async-filled kinds need is not this - that one covers content arriving late, this one covers the container being displayed at all.

**Measure before choosing K**, and report the numbers in the task:

- What a re-render actually costs on activation for an unmounted tab - `renderMarkdown` plus Shiki highlighting is asynchronous, and mermaid renders after that and changes height, which is why `MarkdownView` already restores the anchor a second time on the next frame.
- What a retained markdown tab costs in memory - rendered HTML, mermaid SVGs, and Shiki output for a source-mode tab, all live in the DOM.
- What a theme switch costs with tabs retained. `src/lib/mermaid.ts:69` collects `.mermaid-rendered[data-mermaid-source]` across the whole document and re-renders every match, so switching palette re-renders the diagrams in every retained tab, not just the visible one. That is correct behaviour - a tab must not come back with stale colours - but it scales with K and belongs in the measurement rather than being found by a user with a palette picker.

Tabs share what a window does not: one Shiki WASM highlighter and one mermaid instance per WebView (`src/lib/shiki.ts` is a singleton), which TASK-12.7 records as a per-window cost. That is why a retained tab is cheap enough to consider at all.

## A tab whose file changed while it was inactive

`src/App.tsx:139-167` watches the folder and bumps `reloadToken` only when the changed path matches the *selected* file, then re-reads it. With several tabs open that leaves a stale document behind: change a file on disk, switch to its tab, and it shows what was read before the change.

Unmounted tabs get this for free - they re-read on activation. Mounted inactive ones do not, so the reload signal becomes per tab: a changed path invalidates the tab holding it - at most one, since TASK-13.1's rule 1 never allows two tabs of one file - whether or not it is the active one. Keep the 150 ms debounce and the single `fs:change` subscription; only the fan-out changes.

**Deletion is the same event and needs a stated outcome.** The watcher reports a removed path exactly as it reports a modified one, so the tab stays open and the re-read fails. Show the read error in that tab - `Viewer` already renders one, from the typed `ReadError` decision-5 defines - rather than closing the tab out from under the user. Closing it silently would be indistinguishable from the app losing their place; TASK-13.4 drops such a tab only at restore time, where there is nothing on screen to lose.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Switching away from a tab and back restores its scroll position, through lib/scroll's anchor capture rather than by relying on the engine to keep scrollTop
- [ ] #2 Capture always runs against the still-visible container, before hiding or unmounting, and a comment records that a hidden container yields a wrong anchor rather than none
- [ ] #3 A tab that was unmounted has its stored anchor seeded into the restore path on re-mount, not only captured on the way out
- [ ] #4 The per-tab record is owned by the tab store and handed to the view components, which report changes back up; MarkdownView no longer owns the surviving mode
- [ ] #5 A markdown tab restores its preview/source selection, and its scroll position after leaving in either mode - so the restore no longer sits behind MarkdownView's preview-only gate, and the source mode gets the next-frame second restore its async fill needs
- [ ] #6 A json/yaml/toml tab restores its tree/source selection and its scroll position
- [ ] #7 A mermaid tab and the plain source fallback restore their scroll position
- [ ] #8 ConfigView, MermaidView and the source fallback have refs on their .doc-scroll containers; the next-frame second restore is applied to the asynchronously-filled views only - ConfigView's source mode, MermaidView and markdown's source mode - and not to the synchronous ConfigTree or raw-view fallback
- [ ] #9 A media tab preserves no view state, and a playing video pauses when its tab is deactivated
- [ ] #10 The config tree's expansion state is explicitly excluded and the existing known follow-up is referenced rather than silently widened
- [ ] #11 The outline toggle stays app-wide in localStorage, not per tab
- [ ] #12 Heading lookups resolve against the active tab's own container, not document-wide, so two mounted tabs sharing a heading slug do not break capture, restore or the Outline - through TASK-8's injected lookup root if it has landed, or the same parameter introduced here if not
- [ ] #13 Fragment links inside a document resolve within their own tab's container rather than being handed to native fragment navigation
- [ ] #14 The hiding mechanism for retained inactive tabs is stated, and restore runs only after the container is visible and laid out - the mirror of the capture rule in #2
- [ ] #15 The number of inactive tabs kept mounted is a stated constant with its reason, and the activation re-render cost, the retained-tab memory cost and the theme-switch mermaid re-render cost were measured and reported
- [ ] #16 A file that changes on disk while its tab is inactive shows fresh content when that tab is activated, whether the tab was mounted or not
- [ ] #17 A file deleted while its tab is open leaves the tab in place showing the read error, rather than closing it
- [ ] #18 The fs:change subscription stays single with its 150 ms debounce; only the fan-out to tabs is new
- [ ] #19 A tab's view-state record is discarded when the tab closes and cleared when a folder change empties the tab set
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build and pnpm test pass
- [ ] #2 Scroll deep into one document, switch tabs, switch back, and land in the same place - with the tab both inside and outside the retained set
- [ ] #3 Edit an inactive tab's file on disk and confirm the update is visible on activation
- [ ] #4 Start a video, switch to another tab, and confirm it is silent
- [ ] #5 Open two files with an identical heading (two README.md, both with the same section title), retain both, and confirm each tab's scroll restore and Outline act on its own copy
<!-- DOD:END -->
