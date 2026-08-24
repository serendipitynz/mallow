/**
 * Parse the supported config formats into a JS value, or a normalized error with
 * a 1-based line/column for the source-error view.
 */

import JSON5 from 'json5';
import { type ParseError, parse as parseJsonc, printParseErrorCode, visit } from 'jsonc-parser';
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
 * V8's positionless message shapes quote an excerpt of the document
 * (`Unexpected token 'p', "{"a": position 3}" is not valid JSON`), so a document
 * holding the words a coordinate is written with can put them where a pattern
 * would read them. This family never carries a coordinate, so refusing it whole
 * loses nothing and is what keeps the excerpt out of the patterns below.
 */
const EXCERPT_MESSAGE = /is not valid JSON\s*$/;

/**
 * `… in JSON at position 32 (line 3 column 21)`, and the older `… at position 32`
 * with no parenthesized pair. Anchored on the preposition and on the end of the
 * message, both of which the excerpt family satisfies neither of.
 */
const V8_POSITION = /\bat position (\d+)(?: \(line (\d+) column (\d+)\))?\s*$/;

/** `JSON.parse: unexpected character at line 1 column 8 of the JSON data`. */
const GECKO_POSITION = /\bat line (\d+) column (\d+)\b/;

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
  const reported = messagePosition(text, message);
  if (reported) {
    return reported;
  }
  // The engine's message is preferred above because the banner shows that message,
  // and a position from elsewhere could point away from what the message describes.
  // Nothing to disagree with once the message says nothing about position.
  const offset = strictJsonErrorOffset(text);
  return offset === undefined ? {} : offsetToLineCol(text, offset);
}

function messagePosition(text: string, message: string): { line: number; column: number } | undefined {
  if (EXCERPT_MESSAGE.test(message)) {
    return undefined;
  }
  const v8 = message.match(V8_POSITION);
  if (v8) {
    if (v8[2] === undefined) {
      return offsetToLineCol(text, Number(v8[1]));
    }
    return { line: Number(v8[2]), column: Number(v8[3]) };
  }
  const gecko = message.match(GECKO_POSITION);
  return gecko ? { line: Number(gecko[1]), column: Number(gecko[2]) } : undefined;
}

/**
 * The offset of the first error a strict (no comments, no trailing commas) jsonc
 * scan finds. Allowed to answer nothing.
 *
 * `visit` rather than `parse`, although `parse` is what `parseJsoncText` below
 * uses: `parse` builds the recovered value, and a malformed 10 MiB array whose
 * fault is at its start costs 130 MiB of heap to assemble a value discarded on the
 * next line. `visit` reports the same first offset (measured over the same shapes
 * the strictness was measured on) and allocates nothing. Neither the value nor the
 * error code is wanted here — showing jsonc's verdict for a `.json` file would
 * attribute it to something that did not decide it.
 */
function strictJsonErrorOffset(text: string): number | undefined {
  let first: number | undefined;
  visit(
    text,
    {
      onError: (_code, offset) => {
        first ??= offset;
      },
    },
    { allowTrailingComma: false, disallowComments: true },
  );
  return first;
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
