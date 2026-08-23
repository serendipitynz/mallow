---
id: TASK-22
title: Stop the pinned document bar painting over the toolbar's dropdown menus
status: In Review
assignee: []
created_date: '2026-08-18 11:57'
updated_date: '2026-08-23 03:17'
labels:
  - bug
milestone: m-2
dependencies: []
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The theme picker's dropdown is sometimes drawn under the pinned document bar (.doc__bar), so the top of the menu is covered by the bar's frosted band and by whatever buttons sit in it. Reproduced on macOS with a markdown document open and with an HTML one, and it is intermittent - the same menu on the same document renders correctly on another opening.

By the numbers it should not happen: .menu__popup carries z-index 50 (src/styles/app.scss) and .doc__bar carries 5 (src/styles/markdown.scss), and .menu is position: relative with no z-index, so it opens no stacking context of its own and the two compete directly. The likely cause is .doc__bar's backdrop-filter: blur(10px), which makes the bar its own compositing layer and, on WebKit, can paint that layer above later-painted content regardless of the declared order - the ghost of the bar's content visible through the menu's top edge is consistent with that reading. That is a hypothesis, not a measurement.

Predates the HTML rendered view: .doc__bar is shared by the markdown, config, table, xml and html views, and TASK-5.1 added no stacking declaration. Found during TASK-5.1's visual round, 2026-08-18.

The obvious fix is to give the toolbar a stacking context above the bar rather than to raise the bar's z-index, since the bar has to stay above the document it pins over. Whatever is done, the intermittency is what makes this hard to close: a fix confirmed once is not confirmed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The failure is reproduced before anything is changed, and what makes it intermittent is written down rather than left as 'sometimes'
- [x] #2 A toolbar dropdown opens above the pinned document bar in every view that has one: markdown, config, table, xml and html
- [x] #3 The fix is stated with its mechanism in the SCSS at the declaration that carries it, so the next person does not re-derive why the z-index numbers alone were not enough
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**It is not intermittent. It is conditional, and the condition is a window
resize made while a menu is open.** Measured on macOS / WKWebView, `tauri dev`,
2026-08-23:

1. make the window small
2. open a document large enough that `.doc-scroll` overflows
3. open a toolbar dropdown
4. **leaving it open**, enlarge the window until the document no longer
   overflows

The bar's band then covers the top of the menu. The trigger is that transition,
not the menu: `backdrop-filter` keeps `.doc__bar` on its own compositing layer,
and losing the scroller rebuilds the layers around it while the popup — content
with no layer of its own, sitting in an ancestor stacking context — is already
in the DOM and is not sorted against the layer that comes back.

**Why it looked random in ordinary use is a reading, not a measurement**: a
document settling after load moves the same overflow state with nobody touching
the window — highlighting arriving, mermaid rendering, and in `HtmlView` the
frame converging on its height. That fits this being found during TASK-5.1's
visual round on an HTML document.

**Fix**: `position: relative; z-index: 10; will-change: transform` on `.toolbar`
(`src/styles/app.scss`), with the mechanism stated at the declaration. The bar's
own z-index is untouched — it has to stay above the document it pins over.

**`will-change` is load-bearing, and that was measured rather than assumed.**
Removing that one line with the position and z-index still in place brings the
failure back, so the declared order alone never was the fix: the toolbar needs
its own layer at mount, so the ordering is settled between two layers and no
promotion has to survive the rebuild. Do not drop it as an unneeded
optimisation.

**Verified in all five views** with the four steps above, before (fails) and
after (holds): markdown, config, table, xml, html. The settings modal still
opens above the toolbar and its menus — it is z-index 100 in the root, above
the toolbar's 10.

**A fixture only works here if window size can produce both the overflowing and
the non-overflowing state.** `sales.csv` is too small to scroll even at the
minimum window; `CHECKLIST.md` is too large to stop scrolling. Documents whose
text reflows (markdown, a table with one oversized cell) shrink when widened;
fixed-row-height trees (xml, config) need the whole window enlarged. The five
used were `small.md`, `json.plist`, `unterminated.csv`, `pom.xml`, `index.html`.

**`.conf` / `.ini` / `.cfg` / `.properties` are not the config view.** They are
the `ini` kind, which `Viewer` sends to `SourceView`, and that has no
`.doc__bar` to be covered by. AC #2's "config" means `ConfigView`, which is
reached by `json` / `yaml` / `toml` and by a JSON `.plist`.
<!-- SECTION:NOTES:END -->
