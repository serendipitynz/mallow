---
id: decision-6
title: 'Cap the source view by bytes and lines and drop highlighting, not content'
date: '2026-08-16 01:01'
status: accepted
---
## Context

`read_file` caps a file at 10 MiB (decision-5), but that bounds bytes, not work.
The source view handed the whole text to Shiki with no limit of its own, and
Shiki's cost is linear in the input while its output is an order of magnitude
larger than the input. Measured here with the bundled Shiki 4.3.0 over generated
JSON, under Node's native regex engine:

| Source | Lines | Highlight | Emitted HTML |
|---|---|---|---|
| 256 KiB | 3,169 | 0.30 s | 3.7 MB (14.2×) |
| 512 KiB | 6,308 | 0.61 s | 7.4 MB (14.1×) |
| 1 MiB | 12,526 | 1.17 s | 14.7 MB (14.0×) |
| 5 MiB | 61,583 | 5.89 s | 72 MB (13.8×) |

The app is worse off than those numbers: it runs the WASM regex engine, and the
emitted HTML is then parsed by `innerHTML`. Both costs land on the main thread,
so a file well inside the 10 MiB read cap freezes the window.

This is fixed once here rather than per task because three later tasks name the
source view as the place they fall back to — TASK-3 above its table caps,
TASK-5.1 above its render-complexity threshold, TASK-1 by routing `.log` and
`.txt` there, the kinds most likely to be huge. Those fallbacks are only true if
the source view is itself bounded.

## Decision

### Two caps, either one of which skips highlighting

`src/lib/source-cap.ts` owns them:

| Constant | Value | What it bounds |
|---|---|---|
| `HIGHLIGHT_MAX_BYTES` | 256 KiB | tokenizer work, and the size of the emitted HTML |
| `HIGHLIGHT_MAX_LINES` | 10,000 | DOM nodes: Shiki emits one `<span class="line">` per line |

Both are needed because neither implies the other. A single-line minified bundle
is heavy for the tokenizer at a modest line count; a log of short lines is light
per byte but pays a DOM node per line. Bytes are counted as UTF-8, the same unit
as the 10 MiB read cap, so the two thresholds compare directly.

The values were taken from the table above: at 256 KiB the worst case is 0.30 s
and 3.7 MB of HTML under Node, which leaves room for the WASM engine being
several times slower before the window stops feeling responsive. 512 KiB was the
alternative and was rejected — it doubles the worst case to something that would
read as a hang, in exchange for colour on files where opening promptly matters
more than colour.

### Over the cap, the content is never withheld — only the highlighting

Over the cap the source view renders the **plain source path**: the text as a
single text node in a `<pre>`, with line numbers supplied as a second `<pre>`
holding nothing but the running numbers. Two DOM nodes for the whole document,
whatever its size.

This deliberately diverges from `lib/config-tree`, which reveals a branch's
children incrementally (`BRANCH_INITIAL` / `BRANCH_STEP`) instead of truncating.
The precedent does not transfer: hiding a branch's children still leaves a
readable, navigable document, whereas text cut off at line 10,000 cannot be read
past it, and the reason config-tree needs a reveal control at all — that the
hidden part is expensive to render — does not hold for plain text, which is
free. There is nothing to reveal incrementally, so there is no control.

Highlighting the first N lines with a "highlight more" control was the
config-tree-shaped alternative. Rejected: it pays the same total cost for anyone
who keeps pressing, and it puts a visible seam mid-document where the colour
stops, which reads as a rendering fault rather than a limit.

### The skip is stated in the UI, in one message

One i18n key, `highlightSkipped`, in both dictionaries. Without it a large file
opening in monochrome reads as a bug in the viewer. Which cap tripped is carried
in code as `HighlightSkipReason` (`'bytes' | 'lines'`) but is not worded
separately for the user — the answer to "why is this not coloured" is the same
either way.

### Line numbers survive the plain source path

TASK-9 AC #2 allowed dropping them if stated. They are kept instead, because the
larger the file the more the reader needs a position, and because the numbers
cost one extra text node when rendered as a running column rather than an
element per line. The consequence is that the plain source path does not wrap:
wrapped lines would slip out of step with the number column. It scrolls
horizontally, the same as the highlighted path.

Keeping a numbered gutter also keeps `errorLine` — the config parse-error line
the view scrolls to and flags. Every line has the same height in this path, so
the flag is one absolutely positioned band at `(errorLine - 1) × line-height`
rather than a class on a line element.

## Consequences

- The threshold is owned by `src/lib/source-cap.ts`, which imports nothing, so it
  is unit-tested under Node like `lib/config-tree`. `SourceView` is the single
  render path that consumes it. TASK-9 AC #5 asks for "one module" so later
  fallbacks can target the threshold and the skipped-highlighting render path:
  the split is the same one config-tree/ConfigTree already makes, and it is what
  keeps the logic testable without a DOM.
- TASK-1, TASK-3 and TASK-5.1 may now state the source view as their fallback
  without qualification. A kind routed there is bounded regardless of size.
- Above the cap the view has no syntax colour, no per-line hover target and no
  wrapping. A file that needs those must be opened in an editor (the Open With
  control already offers that).
- The caps bound the source view only. Every other view that expands a document
  into DOM — the config tree, and the table and HTML renderers still to be built
  — needs its own ceiling; this decision does not give them one.
