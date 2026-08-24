---
id: TASK-18
title: Report a position for JSON syntax errors that JSON.parse does not locate
status: In Review
assignee: []
created_date: '2026-08-16 02:53'
updated_date: '2026-08-24 10:55'
labels:
  - bug
milestone: m-2
dependencies: []
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A malformed .json file usually reaches the viewer with no line number at all: the error banner shows the message without a location, the source view flags nothing, and it does not scroll to the fault. In a large file that leaves the user to find it by eye.

The cause is that parseJson in src/lib/config-parse.ts mines JSON.parse's exception message for "line N column M" or "position N". Neither appears in the message shape a stray token produces - V8 says `Unexpected token 'i', ..."name": item-6000 "... is not valid JSON`, and JavaScriptCore (the macOS WebView) reports `JSON Parse error: Unexpected identifier` with even less. Some other shapes do carry a position, so the behaviour is inconsistent rather than absent, which is worse to explain than either extreme.

Found while verifying TASK-9 on a 665 KB broken JSON: nothing was flagged, and the fixture had to be rewritten as YAML to exercise the flagged-line path at all. This predates v0.4.0 and is unchanged by v0.5.0, which is why it was not pulled into m-0.

The other config formats already report a position and are the model: jsonc goes through jsonc-parser's offsets, yaml through YAMLParseError.linePos, toml through TomlError.line. Only the JSON.parse path is message-scraping. Reusing the jsonc parser for plain .json is the obvious candidate - it is already a dependency and already produces an offset that offsetToLineCol turns into a line - but it accepts comments and trailing commas, so it would have to keep rejecting what JSON rejects rather than quietly widening the format. Decide that before implementing; do not add a JSON parser dependency without asking.

Related: TASK-4 has the same problem one engine over - DOMParser's parsererror document has no standard error position and its text differs across WebViews. Whatever this task promises about "where the error is" should be the promise TASK-4 makes too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A .json file whose error JSON.parse does not locate still reports a line, and the source view flags and scrolls to it
- [x] #2 What counts as valid JSON is unchanged: comments and trailing commas are still errors in a .json file
- [x] #3 The chosen approach adds no new production dependency, or asks first
- [x] #4 Unit tests cover both message shapes - the one JSON.parse locates and the one it does not
- [x] #5 The promise made here about error positions is consistent with what TASK-4 promises for XML, or the difference is stated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
decision-12 settles the contract. The gate on validity stays `JSON.parse`; what is
added is a **position source** — a strict jsonc scan (`jsonc-parser` with
`allowTrailingComma: false, disallowComments: true`) reached only from the catch,
whose value and error code are discarded and whose first offset becomes a line.

**AC #2 holds by construction, not by measurement.** The only path to the scan
begins with `JSON.parse` having thrown, so no document the scan would accept can
be accepted, however lenient jsonc-parser's grammar is or becomes. The agreement
was measured anyway, because the *quality* of the position depends on it: across 30
shapes (comments, both trailing commas, single quotes, unquoted keys, `01`, `+1`,
`.5`, `1.`, `0x10`, `NaN`, `Infinity`, `undefined`, content after the value,
trailing garbage, an unclosed brace, a raw tab and a raw newline in a string, `\x`,
a line continuation, empty, whitespace-only, duplicate keys, `item-6000`) the two
agree on every verdict (30/30), and on the 4 where both name a position they name
the same one.

**The engine's position wins where the message has one.** The banner shows the
engine's message, so a position from elsewhere could point away from what that
message describes; where the message says nothing about position there is nothing
to disagree with. This also means no case that reported a position before changes.

**Replacing `JSON.parse` with the jsonc parser — the candidate this task's own
text named — was rejected.** It moves the gate (AC #2 would then rest on the table
above), turns the message into a terse code (`InvalidSymbol`) in place of prose
naming the offending token, and the recovery-oriented parser returns a value
alongside its errors, so "did this parse" stops being one answer.

**AC #5 is answered by one rule, not by matching XML's promise.** decision-12:
report a position wherever one can be obtained without adding a dependency and
without inferring it. JSON has a second strict parser in the tree already (for
`.jsonc`), XML has none and decision-8 declined to add one — same rule, different
answer. decision-8's text is unedited; an amendment records the narrowed scope of
its claim, and says XML would be obliged to report a position if a parser ever
arrived for another reason.

**One thing fell out of the rule rather than being decided**: `parseJsonl` reported
`column: 1` for every failing record, which is an inferred position printed under
the reader's cursor. It now comes from the same helper, and `JSON.parse` is handed
the raw line rather than a trimmed copy so the offset needs no shifting by the
indent. Absent where no source answers.

**Which leg holds which AC.** #1's "reports a line" is unit-tested (and the
fixtures measure line 6002 in a 425 KiB file); its "flags and scrolls" half is the
`errorLine` path `ConfigView` → `SourceView` already runs for every other config
format — unchanged code, now reachable for `.json` — and is confirmed by eye, not by
the suite (`_sandbox/handoff/task-18/visual-check.md`, 6 fixtures, both the
highlighted and the highlight-skipped source paths). #2 is 9 rejection cases plus
the same content accepted as `.jsonc`. #3 is `git diff` on `package.json` and
`pnpm-lock.yaml` being empty. #4 feeds the engine wordings in directly, including
JavaScriptCore's, which a Node run cannot produce — which is why
`jsonErrorPosition` is exported, following `xmlErrorInfo`'s precedent. #5 is
decision-12, decision-8's amendment, doc-1 and AGENTS (both languages).

**README changed in the honest direction, not the flattering one.** Its config
bullet promised the offending line unconditionally, which was false for `.json`
and is still not guaranteed for YAML; it now reads as the XML bullet already did
("where the parser reports one"). The improvement this task ships is that the
qualifier is nearly always met, not that the promise got louder.

## Review round 1 (Codex CLI, 2026-08-24) — both [P2] findings confirmed and fixed

Neither was refutable; both were measured before fixing.

**[P2] the message patterns read the document, not the engine.** V8's positionless
shapes quote an excerpt of the file, so `{"a": position 3}` produced
`Unexpected token 'p', "{"a": position 3}" is not valid JSON` — no coordinate — and
the bare `/position (\d+)/` matched the *document's* text. The banner pointed at
column 4 instead of the fault at column 7, **and** the scan that had the right
answer was skipped. So the defect was not merely a wrong number: it suppressed the
right one, which is the worst of the three possible outcomes. The patterns are now
anchored on what the engine writes (`at position N` / `at line N column M`, ending
the message) and the excerpt family is refused whole by the `is not valid JSON` it
always ends with — that family never carries a coordinate, so nothing is lost. Two
regression tests, one per pattern. Note this half predates the task: the patterns
were already there. What the task changed is that a false match now suppresses a
correct answer instead of merely replacing an absent one.

**[P2] the scan built a value it discarded.** `parse` assembles the recovered value.
Measured on a malformed 10 MiB array faulting at its start: `parse` 406 ms /
130 MiB of heap, `visit` 259 ms / 0 MiB, same offset. First offsets agree across
all 34 shapes checked (the 30 strictness shapes plus 4 from the fixtures). The scan
goes through `visit` now; `parseJsoncText` keeps `parse` because it wants the value,
and the reason the two differ is written where they sit.

**What the suite does not hold**: nothing observable from the return value
distinguishes a building scan from a non-building one, so the `visit` choice rests
on the doc comment and the measurement. What is pinned is the offset on a large
document whose fault is at its start — the shape that made the cost visible.

decision-12, AGENTS (both languages) and doc-1 were updated in the same round.
doc-1 carries the reusable half: a pattern matching the words a coordinate is
written *with* is a property of the engine; one matching the words it is written
*as* is a property of the document.
<!-- SECTION:NOTES:END -->
