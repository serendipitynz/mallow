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
    // Reached only for a `.plist` that holds JSON (`isJsonPlist` routes it here);
    // an XML one never gets this far. Spelled out rather than left to the default
    // below, because which of the two a `.plist` is is decided elsewhere.
    case 'plist':
      return 'json';
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

/**
 * The position of a JSON syntax error, for a document `JSON.parse` has already
 * rejected: the engine's own message where that names one, a strict jsonc scan
 * where it does not, and empty when neither answers — a supported state
 * (decision-12).
 *
 * `JSON.parse` stays the only thing that decides whether a `.json` file is valid.
 * This is reached only from a catch, so it cannot widen the format however lenient
 * the scan below it were to become.
 *
 * Exported for the sake of the wordings this environment cannot produce: the
 * message shapes come from whichever engine the WebView carries, and a test run
 * under Node sees V8's alone.
 */
export function jsonErrorPosition(text: string, message: string): { line?: number; column?: number } {
  const lc = message.match(/line (\d+) column (\d+)/);
  if (lc) {
    return { line: Number(lc[1]), column: Number(lc[2]) };
  }
  const pos = message.match(/position (\d+)/);
  if (pos) {
    return offsetToLineCol(text, Number(pos[1]));
  }
  // The engine's message is preferred above because the banner shows that message,
  // and a position from elsewhere could point away from what the message describes.
  // Nothing to disagree with once the message says nothing about position.
  const offset = strictJsonErrorOffset(text);
  return offset === undefined ? {} : offsetToLineCol(text, offset);
}

/**
 * The offset of the first error a strict (no comments, no trailing commas) jsonc
 * scan finds. The parsed value and the error code are both discarded: showing
 * jsonc's verdict for a `.json` file would attribute it to something that did not
 * decide it. Allowed to answer nothing.
 */
function strictJsonErrorOffset(text: string): number | undefined {
  const errors: ParseError[] = [];
  parseJsonc(text, errors, { allowTrailingComma: false, disallowComments: true });
  return errors.length > 0 ? errors[0].offset : undefined;
}

function parseJson(text: string): ParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const message = (e as Error).message;
    return { ok: false, error: { message, ...jsonErrorPosition(text, message) } };
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
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    try {
      // Parsed with its indentation rather than trimmed, so a reported offset is
      // already relative to the line and needs no shifting. Whitespace around a
      // value is legal JSON, so the record itself is unaffected.
      records.push(JSON.parse(line));
    } catch (e) {
      const message = (e as Error).message;
      // Only the column: a record is one line, so the line is the loop's, and
      // claiming column 1 without measuring it is the inferred position
      // decision-8 forbids and decision-12 removed from here.
      const { column } = jsonErrorPosition(line, message);
      return { ok: false, error: { message: `Line ${i + 1}: ${message}`, line: i + 1, column } };
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
