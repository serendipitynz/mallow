import { describe, expect, it } from 'vitest';
import type { TFn } from './i18n';
import { type ReadError, readErrorMessage, toReadError } from './read-error';

const PATH = '/docs/notes.md';

/** Renders the key and its params, so a test can tell which message was chosen
 *  without pinning the wording of either dictionary. */
const t: TFn = (key, params) => (params ? `${key}(${JSON.stringify(params)})` : key);

describe('toReadError', () => {
  it('decodes each variant the backend serializes', () => {
    expect(toReadError({ kind: 'invalidUtf8', path: PATH }, PATH)).toEqual({ kind: 'invalidUtf8', path: PATH });
    expect(toReadError({ kind: 'binary', path: PATH, format: 'bplist' }, PATH)).toEqual({
      kind: 'binary',
      path: PATH,
      format: 'bplist',
    });
    expect(toReadError({ kind: 'tooLarge', path: PATH, message: 'File too large' }, PATH)).toEqual({
      kind: 'tooLarge',
      path: PATH,
      message: 'File too large',
    });
    expect(toReadError({ kind: 'io', path: PATH, message: `${PATH}: No such file` }, PATH)).toEqual({
      kind: 'io',
      path: PATH,
      message: `${PATH}: No such file`,
    });
  });

  it('folds anything that is not a well-formed variant into io', () => {
    // A plain string is what a command that still returns Result<_, String> rejects with.
    expect(toReadError('boom', PATH)).toEqual({ kind: 'io', path: PATH, message: 'boom' });
    expect(toReadError(new Error('ipc down'), PATH)).toEqual({ kind: 'io', path: PATH, message: 'Error: ipc down' });
    expect(toReadError(null, PATH)).toEqual({ kind: 'io', path: PATH, message: 'null' });
    // A variant added in Rust and not mirrored here shows its fields, not [object Object].
    expect(toReadError({ kind: 'unheardOf' }, PATH)).toEqual({
      kind: 'io',
      path: PATH,
      message: '{"kind":"unheardOf"}',
    });
    // A known tag with its payload missing is not decodable either.
    expect(toReadError({ kind: 'binary', path: PATH }, PATH).kind).toBe('io');
    expect(toReadError({ kind: 'tooLarge', path: PATH }, PATH).kind).toBe('io');
    // A cycle cannot be stringified; the fallback must not throw.
    const cyclic: Record<string, unknown> = { kind: 'unheardOf' };
    cyclic.self = cyclic;
    expect(toReadError(cyclic, PATH).kind).toBe('io');
  });

  it('falls back to the requested path when the value carries none', () => {
    expect(toReadError({ kind: 'invalidUtf8' }, PATH)).toEqual({ kind: 'invalidUtf8', path: PATH });
  });
});

describe('readErrorMessage', () => {
  it('translates the two causes the backend leaves unworded', () => {
    expect(readErrorMessage({ kind: 'invalidUtf8', path: PATH }, t)).toBe('readErrorInvalidUtf8');
    expect(readErrorMessage({ kind: 'binary', path: PATH, format: 'bplist' }, t)).toBe(
      'readErrorBinary({"format":"bplist"})',
    );
  });

  it('passes the backend message through unchanged for the pre-existing causes', () => {
    const tooLarge: ReadError = {
      kind: 'tooLarge',
      path: PATH,
      message: 'File too large: 11534337 bytes (max 10485760)',
    };
    const io: ReadError = { kind: 'io', path: PATH, message: `${PATH}: No such file or directory (os error 2)` };
    expect(readErrorMessage(tooLarge, t)).toBe(tooLarge.message);
    expect(readErrorMessage(io, t)).toBe(io.message);
  });
});
