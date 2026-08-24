---
id: decision-12
title: >-
  Locate a JSON syntax error with a strict jsonc scan while JSON.parse stays the
  sole gate on validity
date: '2026-08-24 10:30'
status: accepted
---
## Context

Every config format mallow parses reports where a syntax error is, except the one
most people open. `.jsonc` goes through jsonc-parser's offsets, `.yaml` through
`YAMLParseError.linePos`, `.toml` through `TomlError.line`, `.json5` through
json5's `lineNumber`. Plain `.json` alone mines `JSON.parse`'s exception message
for `line N column M` or `position N`, and those substrings are absent from the
message shape a stray token produces — V8 says
`Unexpected token 'i', ..."name": item-6000 "... is not valid JSON`, and
JavaScriptCore (the macOS WebView) says `JSON Parse error: Unexpected identifier`
with even less. Other shapes do carry a position, so the reader gets a line
sometimes: **the behaviour is inconsistent rather than absent**, which is worse to
explain than either extreme, and on a 665 KB broken file (found while verifying
TASK-9) it leaves the fault to be found by eye.

decision-8 settled the neighbouring question for XML and settled it the other way:
a parse failure with no position is a supported outcome, because the DOM exposes
no position API, the position exists only inside engine-chosen wording, and buying
one with an XML parser dependency was rejected. TASK-18's AC #5 asks whether JSON
should make the same promise. It should not, and the reason is not a preference
about JSON: **the two formats differ in what is already in the tree**, and this
decision states the rule that produces both answers.

The trap in the obvious fix is that "reuse the jsonc parser for `.json`" does not
say what authority the jsonc parser is being given. Two readings:

- it decides what is valid JSON, or
- it says only where an already-rejected document failed.

Under the first, comments and trailing commas have to be re-forbidden by
configuration, and AC #2 ("what counts as valid JSON is unchanged") then rests on
a table of measured agreement — every future divergence in jsonc-parser's scanner
is a silent widening of the format. Under the second there is no such exposure at
all. The distinction is the whole decision, so the referent table names the two
halves before this text uses them: the **gate on validity** (the one
implementation that decides accept/reject) and the **position source** (what
answers "where", for a document the gate already rejected).

## Decision

### `JSON.parse` stays the gate on validity; the jsonc scan is only a position source

`parseJson` in `src/lib/config-parse.ts` keeps calling `JSON.parse` and keeps
returning its value on success and its message on failure. What is added runs
**only inside the catch**, and only when the message carries no position: a
**strict jsonc scan** — `jsonc-parser` with `allowTrailingComma: false` and
`disallowComments: true` — whose first reported offset becomes a line and column
through the `offsetToLineCol` the other formats already use.

The scan goes through `visit`, not the `parse` that `parseJsoncText` calls a few
lines below it, and the difference is not stylistic: `parse` assembles the
recovered value, so a malformed 10 MiB array whose fault is at its start costs
130 MiB of heap and 406 ms to build something discarded on the next line, where
`visit` reports the same offset in 259 ms and allocates nothing (measured; the
first offsets agree across the same 34 shapes the strictness was measured on).
`parseJsoncText` keeps `parse` because it wants the value.

**This is what makes AC #2 hold by construction rather than by measurement.** The
scan cannot widen what counts as valid JSON, because the only path that reaches it
begins with `JSON.parse` having already thrown; a document jsonc-parser would
accept and JSON rejects is still rejected, and a document jsonc-parser would
reject and JSON accepts never reaches the scan. Comments and trailing commas in a
`.json` file stay errors for the same reason they are errors today — nothing about
the gate moved.

The agreement was measured anyway, because the *quality* of the reported position
depends on it: across 30 shapes (comments, both trailing commas, single quotes,
unquoted keys, `01`, `+1`, `.5`, `1.`, `0x10`, `NaN`, `Infinity`, `undefined`,
trailing content after the value, trailing garbage, an unclosed brace, a raw tab
and a raw newline inside a string, `\x` escapes, a line continuation, empty input,
whitespace-only input, duplicate keys, the task's own `item-6000`) the strict scan
accepts and rejects exactly what `JSON.parse` does — 30 of 30. Where both report a
position they agree exactly (4 of 4). So the scan is not merely safe here; it lands
on the same character the engine would have named had it named one.

### Where the engine gives a position, the engine's position is used

The banner shows the engine's message, so the position beside it comes from the
same authority whenever that authority provides both: the message patterns are
tried first, and the strict jsonc scan fills in only where neither matched.

**Those patterns have to be anchored on what the engine writes, because V8 puts
the document inside the message.** Its positionless shapes quote an excerpt —
`Unexpected token 'p', "{"a": position 3}" is not valid JSON` — so a document
holding the words a coordinate is written with lands them where an unanchored
`/position (\d+)/` reads them. That input is real: the pattern matched the
document's own text, the banner pointed at column 4 instead of the fault at
column 7, and the scan that had the right answer was never consulted — a wrong
number is worse than none, and this one also suppressed the right one. Two
anchors close it, and both are properties of the wording rather than guesses
about content: the coordinate is written `at position N` / `at line N column M`
and ends the message, and the excerpt family is refused whole by the
`is not valid JSON` it always ends with, which loses nothing because that family
never carries a coordinate. Preferring the scan unconditionally was rejected for one reason — a
message describing one place next to an arrow pointing at another is a mismatch the
reader can see, and there is no coherence to break only when the message says
nothing about position. It also means **no case that reports a position today
changes**, so the new path is reachable exactly where nothing was reported before.

The message patterns are kept rather than replaced, and not only for ordering: the
strict scan is allowed to report nothing (it did not in 30 of 30, but nothing in
jsonc-parser's contract promises an error for every input `JSON.parse` refuses),
and the message patterns are what answers then. Where neither answers, the banner
appears with the engine's message and no location — the same supported state
decision-8 defined for XML, now the fallback rather than the norm.

Replacing `JSON.parse` with the jsonc parser outright was the candidate TASK-18's
own text named, and it was rejected on two counts beyond the gate question: the
message becomes a terse code (`InvalidSymbol`) in place of prose that names the
offending token, and the recovery-oriented parser returns a *value* alongside its
errors, so "did this document parse" stops being a single answer. Its one real
advantage — identical wording on every engine — buys cross-WebView consistency in
a string that stays engine-specific anyway wherever the engine does report a
position.

### One rule spans JSON and XML, and it is not decision-8's

**Report a position wherever one can be obtained without adding a dependency and
without inferring it; where none can be, show the message alone.** That is the
promise, and it produces both existing answers:

| Kind | Position sources in the tree | Result |
|---|---|---|
| `.json` | the engine's message, then the strict jsonc scan (`jsonc-parser` is already a dependency, for `.jsonc`) | a position in practice always |
| `.jsonc` / `.json5` / `.yaml` / `.toml` | the parser's own offset or line | a position always |
| `.jsonl` | the engine's message or the strict jsonc scan, per record | the record's line always; a column where a source answers |
| XML | the `<parsererror>` message text only, in wording no engine promises | a position where the engine gives one, and legitimately none otherwise |

decision-8's sentence ("report a parse position only where the engine gives one")
stays true of XML and is now read as this rule's XML consequence rather than as
the project's general policy. **decision-8's text is not edited** — it is accepted,
and what changed is the scope of its claim, so the reference is added as a comment
on it rather than by rewriting a decision that was correct about its own subject.

The asymmetry is a fact about dependencies, not about formats: JSON has a second
strict parser in the tree because `.jsonc` needed one, and XML has none because
decision-8 declined to add one and that reasoning is unchanged. **If an XML parser
ever arrives for another reason, this rule requires XML to start reporting a
position too** — which is exactly why the rule is written about obtainability
rather than about engines.

### An inferred position is removed where one was already being shown

`parseJsonl` reports `column: 1` for every failing record. A `.jsonl` record is a
whole JSON document on one line, so the fault is almost never at its first
character: that column is an **inferred position** in decision-8's sense, printed
into the banner as `line 12, column 1` where nothing measured the 1. Under the rule
above it cannot stay, and this is not a second decision — it is the first one
applied to a line in the same file. The column now comes from the same position
source `.json` uses, applied to the record's own text, and is absent when that
source gives nothing. The line, which was always right, is unchanged.

`JSON.parse` is now handed the raw line rather than its trimmed copy, so a reported
offset is already relative to the line and needs no shifting by the indent. The
values parsed are identical — leading and trailing whitespace is legal JSON — and
the blank-record check still reads the trimmed copy.

## Consequences

- **A `.json` syntax error reports a line in practice always**, and the source
  view flags and scrolls to it on every shape that previously produced nothing.
  The inconsistency TASK-18 was filed about is closed by making the located case
  the norm, not by declaring the unlocated one acceptable.
- **The no-position banner stays reachable and stays tested.** It is now the
  outcome of two sources both declining rather than of one absent source, which
  makes it rarer and therefore easier to leave broken; a unit test covers it
  directly instead of relying on a real file to produce it.
- **The strict scan costs nothing on a valid document.** It runs only after
  `JSON.parse` has thrown, so the common path is untouched, and the failure path
  pays one extra scan of a document that is already in memory and already under
  `read_file`'s 10 MiB cap.
- **The two message patterns can rot silently, exactly as decision-8's can, and
  the failure is now milder.** An engine that reword its message drops those cases
  to the strict scan, which reports a position of its own — so a rewording moves
  where the number comes from instead of removing it. This is the one place where
  having two sources buys something beyond coverage.
- **`printParseErrorCode` is not used for `.json`.** The scan's error code is
  discarded and its value is never built; only the offset is read. A future change that
  starts showing jsonc's wording for a `.json` file would be moving the gate by
  the back door, because the reader would then be reading a verdict from something
  that did not decide the verdict.
- **The banner's wording for `.jsonl` changes**: a failing record that used to read
  `line 12, column 1` now reads `line 12, column 9` or `line 12`. Nothing that
  flags or scrolls changes, since the source view uses the line alone.
- **Adding a strict parser for another format would oblige the same treatment.**
  The rule is about what is obtainable, so it is the arrival of a position source,
  not a decision about the format, that changes what a kind promises.
- **The message patterns are now the part that can be wrong rather than merely
  absent.** Before the anchors they could read a coordinate out of the document
  V8 quotes back; anchoring is what makes "the engine's position wins" safe to
  state, and it is why the ordering did not have to change to fix it. Two
  regression tests hold each half.
- **Nothing observable distinguishes a building scan from a non-building one**, so
  the `visit` choice is held by the reason written beside
  `strictJsonErrorOffset` and by the measurement above — not by a test. What the
  suite pins is the offset on a large document whose fault is at its start, which
  is the shape that made the cost visible.
