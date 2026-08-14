/**
 * Parse the supported config formats into a JS value, or a normalized error with
 * a 1-based line/column for the source-error view.
 */

import JSON5 from 'json5';
import { type ParseError, parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import { parse as parseToml, TomlError } from 'smol-toml';
import { parse as parseYaml, YAMLParseError } from 'yaml';

export type ConfigFormat = 'json' | 'jsonc' | 'json5' | 'jsonl' | 'yaml' | 'toml';

export interface ParseErrorInfo {
  message: string;
  line?: number;
  column?: number;
}

export type ParseOutcome = { ok: true; value: unknown } | { ok: false; error: ParseErrorInfo };

/** Pick a format from a file name's extension. */
export function configFormat(name: string): ConfigFormat {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  switch (ext) {
    case 'jsonc':
      return 'jsonc';
    case 'json5':
      return 'json5';
    case 'jsonl':
    case 'ndjson':
      return 'jsonl';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
      return 'toml';
    default:
      return 'json';
  }
}

/** Shiki grammar id for the source view of a given format. */
export function shikiLangFor(format: ConfigFormat): string {
  switch (format) {
    case 'yaml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'jsonc':
    case 'json5':
      return 'jsonc';
    default:
      return 'json';
  }
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function parseJson(text: string): ParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const message = (e as Error).message;
    const lc = message.match(/line (\d+) column (\d+)/);
    if (lc) {
      return { ok: false, error: { message, line: Number(lc[1]), column: Number(lc[2]) } };
    }
    const pos = message.match(/position (\d+)/);
    if (pos) {
      return { ok: false, error: { message, ...offsetToLineCol(text, Number(pos[1])) } };
    }
    return { ok: false, error: { message } };
  }
}

function parseJsoncText(text: string): ParseOutcome {
  const errors: ParseError[] = [];
  const value = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) {
    const first = errors[0];
    return {
      ok: false,
      error: { message: printParseErrorCode(first.error), ...offsetToLineCol(text, first.offset) },
    };
  }
  return { ok: true, value };
}

function parseJson5(text: string): ParseOutcome {
  try {
    return { ok: true, value: JSON5.parse(text) };
  } catch (e) {
    const err = e as Error & { lineNumber?: number; columnNumber?: number };
    return { ok: false, error: { message: err.message, line: err.lineNumber, column: err.columnNumber } };
  }
}

function parseJsonl(text: string): ParseOutcome {
  const lines = text.split(/\r?\n/);
  const records: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }
    try {
      records.push(JSON.parse(trimmed));
    } catch (e) {
      return { ok: false, error: { message: `Line ${i + 1}: ${(e as Error).message}`, line: i + 1, column: 1 } };
    }
  }
  return { ok: true, value: records };
}

function parseYamlText(text: string): ParseOutcome {
  try {
    return { ok: true, value: parseYaml(text) };
  } catch (e) {
    if (e instanceof YAMLParseError) {
      const pos = e.linePos?.[0];
      return { ok: false, error: { message: e.message, line: pos?.line, column: pos?.col } };
    }
    return { ok: false, error: { message: (e as Error).message } };
  }
}

function parseTomlText(text: string): ParseOutcome {
  try {
    return { ok: true, value: parseToml(text) };
  } catch (e) {
    if (e instanceof TomlError) {
      const pos = e.line !== undefined ? { line: e.line, column: e.column } : {};
      return { ok: false, error: { message: e.message, ...pos } };
    }
    return { ok: false, error: { message: (e as Error).message } };
  }
}

export function parseConfig(text: string, format: ConfigFormat): ParseOutcome {
  switch (format) {
    case 'jsonc':
      return parseJsoncText(text);
    case 'json5':
      return parseJson5(text);
    case 'jsonl':
      return parseJsonl(text);
    case 'yaml':
      return parseYamlText(text);
    case 'toml':
      return parseTomlText(text);
    default:
      return parseJson(text);
  }
}
