---
id: TASK-18
title: Report a position for JSON syntax errors that JSON.parse does not locate
status: To Do
assignee: []
created_date: '2026-08-16 02:53'
labels:
  - bug
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
- [ ] #1 A .json file whose error JSON.parse does not locate still reports a line, and the source view flags and scrolls to it
- [ ] #2 What counts as valid JSON is unchanged: comments and trailing commas are still errors in a .json file
- [ ] #3 The chosen approach adds no new production dependency, or asks first
- [ ] #4 Unit tests cover both message shapes - the one JSON.parse locates and the one it does not
- [ ] #5 The promise made here about error positions is consistent with what TASK-4 promises for XML, or the difference is stated
<!-- AC:END -->
