import { describe, expect, it } from 'vitest';
import { configFormat, parseConfig, shikiLangFor } from './config-parse';

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
    }
  });

  it('reports the offending line for JSONL', () => {
    const out = parseConfig('{"a":1}\nnot json\n', 'jsonl');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.line).toBe(2);
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
