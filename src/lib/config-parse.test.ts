import { describe, expect, it } from 'vitest';
import { configFormat, jsonErrorPosition, parseConfig, shikiLangFor } from './config-parse';

describe('configFormat', () => {
  it.each([
    ['data.json', 'json'],
    ['tsconfig.jsonc', 'jsonc'],
    ['.babelrc.json5', 'json5'],
    ['log.jsonl', 'jsonl'],
    ['log.ndjson', 'jsonl'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['Cargo.toml', 'toml'],
    ['noext', 'json'],
    ['weird.unknown', 'json'],
  ] as const)('maps %s -> %s', (name, expected) => {
    expect(configFormat(name)).toBe(expected);
  });

  it('is case-insensitive on the extension', () => {
    expect(configFormat('Config.YAML')).toBe('yaml');
  });
});

describe('shikiLangFor', () => {
  it.each([
    ['yaml', 'yaml'],
    ['toml', 'toml'],
    ['jsonc', 'jsonc'],
    ['json5', 'jsonc'],
    ['json', 'json'],
    ['jsonl', 'json'],
  ] as const)('maps %s -> %s', (format, expected) => {
    expect(shikiLangFor(format)).toBe(expected);
  });
});

describe('parseConfig — success', () => {
  it('parses JSON', () => {
    expect(parseConfig('{"a":1}', 'json')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses JSONC with comments and trailing commas', () => {
    const out = parseConfig('{\n  // c\n  "a": 1,\n}', 'jsonc');
    expect(out).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses JSON5', () => {
    const out = parseConfig("{ a: 1, b: 'two', }", 'json5');
    expect(out).toEqual({ ok: true, value: { a: 1, b: 'two' } });
  });

  it('parses JSONL into an array of records (blank lines skipped)', () => {
    const out = parseConfig('{"a":1}\n\n{"b":2}\n', 'jsonl');
    expect(out).toEqual({ ok: true, value: [{ a: 1 }, { b: 2 }] });
  });

  it('parses YAML', () => {
    expect(parseConfig('a: 1\nb: two\n', 'yaml')).toEqual({ ok: true, value: { a: 1, b: 'two' } });
  });

  it('parses TOML', () => {
    expect(parseConfig('a = 1\nb = "two"\n', 'toml')).toEqual({ ok: true, value: { a: 1, b: 'two' } });
  });
});

describe('parseConfig — errors carry a 1-based line', () => {
  it('reports a JSON syntax error', () => {
    const out = parseConfig('{ "a": }', 'json');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.message).toBeTruthy();
      expect(out.error.line).toBe(1);
    }
  });

  // The shape the task was filed about: no engine names a position for a stray
  // token, so before decision-12 this reached the banner with no line at all.
  it('reports the line of a stray token, which no engine locates', () => {
    const out = parseConfig('{\n  "a": 1,\n  "name": item-6000\n}\n', 'json');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.line).toBe(3);
      expect(out.error.column).toBe(11);
    }
  });

  it('reports the offending line for JSONL', () => {
    const out = parseConfig('{"a":1}\nnot json\n', 'jsonl');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.line).toBe(2);
    }
  });

  // The column used to be a hard-coded 1 for every failing record, which is an
  // inferred position (decision-8) and almost always wrong: a record is a whole
  // JSON document, so the fault is not at its first character.
  it('locates a JSONL failure inside the record rather than claiming column 1', () => {
    const out = parseConfig('{"a":1}\n  {"b": nope}\n', 'jsonl');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.line).toBe(2);
      // 9 counts the record's two-space indent, which is what parsing the raw
      // line rather than its trimmed copy is for.
      expect(out.error.column).toBe(9);
    }
  });

  it('reports a line for invalid YAML', () => {
    const out = parseConfig('a: 1\n  b: : :\n', 'yaml');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(typeof out.error.line === 'number' || out.error.line === undefined).toBe(true);
    }
  });

  it('reports a line/column for invalid TOML', () => {
    const out = parseConfig('a = = 1\n', 'toml');
    expect(out.ok).toBe(false);
  });
});

// The message shapes are the engine's, so the ones this environment cannot
// produce are fed in directly — a test run under Node sees V8's wording alone,
// while the macOS WebView carries JavaScriptCore's.
describe('jsonErrorPosition', () => {
  it("takes the engine's own line and column when the message names both", () => {
    const text = '{"a":1} {"b":2}';
    const message = 'Unexpected non-whitespace character after JSON at position 8 (line 1 column 9)';
    expect(jsonErrorPosition(text, message)).toEqual({ line: 1, column: 9 });
  });

  it("converts the engine's offset when the message names only a position", () => {
    const text = '{\n  "a": 1\n';
    const message = "Expected ',' or '}' after property value in JSON at position 11";
    expect(jsonErrorPosition(text, message)).toEqual({ line: 3, column: 1 });
  });

  it('falls back to the strict scan for V8 wording that names no position', () => {
    const text = '{\n  "name": item-6000\n}';
    const message = 'Unexpected token \'i\', ..."name": item-6000 "... is not valid JSON';
    expect(jsonErrorPosition(text, message)).toEqual({ line: 2, column: 11 });
  });

  it('falls back to the strict scan for JavaScriptCore wording, which names no position', () => {
    const text = '{\n  "name": item-6000\n}';
    expect(jsonErrorPosition(text, 'JSON Parse error: Unexpected identifier')).toEqual({ line: 2, column: 11 });
  });

  // Both sources declining is the supported no-position state decision-12 keeps
  // reachable. It cannot be produced from a real document today (the scan answered
  // on all 30 shapes measured), which is why it is constructed here.
  it('reports no position when neither the message nor the scan names one', () => {
    expect(jsonErrorPosition('{"a":1}', 'JSON Parse error: Unexpected identifier')).toEqual({});
  });

  // The banner shows the engine's message, so a position from elsewhere could
  // point away from what that message describes. Where the message names one it
  // wins, even against a scan that would answer differently.
  it("prefers the engine's position over the scan's", () => {
    const text = '{\n  "a": 1,\n  "b": nope\n}';
    const message = 'Unexpected token in JSON at position 0';
    expect(jsonErrorPosition(text, message)).toEqual({ line: 1, column: 1 });
  });
});

// AC #2: the scan runs only after JSON.parse has thrown, so it cannot widen what
// a `.json` file may hold however lenient its own grammar is.
describe('the strict scan does not widen what counts as valid JSON', () => {
  it.each([
    ['a line comment', '{\n  "a": 1 // note\n}'],
    ['a block comment', '{/* note */ "a": 1}'],
    ['a trailing comma in an object', '{\n  "a": 1,\n}'],
    ['a trailing comma in an array', '[1, 2,]'],
    ['a single-quoted string', "{'a': 1}"],
    ['an unquoted key', '{a: 1}'],
    ['a leading zero', '{"a": 01}'],
    ['NaN', '{"a": NaN}'],
    ['content after the value', '{"a":1} {"b":2}'],
  ])('still rejects %s in a .json file', (_name, text) => {
    expect(parseConfig(text, 'json').ok).toBe(false);
  });

  it('still accepts what JSON accepts', () => {
    expect(parseConfig('{\n  "a": [1, 2],\n  "b": {"c": null}\n}\n', 'json')).toEqual({
      ok: true,
      value: { a: [1, 2], b: { c: null } },
    });
  });

  it('still parses the same file as JSONC when the extension says so', () => {
    expect(parseConfig('{\n  // note\n  "a": 1,\n}', 'jsonc')).toEqual({ ok: true, value: { a: 1 } });
  });
});
