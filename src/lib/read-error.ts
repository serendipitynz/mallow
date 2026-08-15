/**
 * The failure half of `readFile`'s contract, mirroring the `ReadError` enum in
 * `commands.rs`.
 *
 * `read_file` rejects, and TypeScript's `Promise` has no type parameter for a
 * rejection value — so a rejecting wrapper cannot express the failure shape as a
 * static contract at all. The wrapper therefore decodes the rejection here and
 * resolves a `ReadResult` instead, which makes `tsc` force every caller through
 * the failure branch rather than trusting them to remember a type guard.
 *
 * Kept free of Tauri APIs so it stays unit-testable under a Node environment.
 */
import type { TFn } from './i18n';

export type ReadError =
  | { kind: 'invalidUtf8'; path: string }
  | { kind: 'binary'; path: string; format: string }
  | { kind: 'tooLarge'; path: string; message: string }
  | { kind: 'io'; path: string; message: string };

export type ReadResult = { ok: true; text: string } | { ok: false; error: ReadError };

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Narrow whatever `invoke` rejected with to a `ReadError`.
 *
 * Anything that is not a well-formed serialized variant is folded into `io`
 * carrying its stringification: a malformed value means the IPC layer failed
 * rather than the read, and the user is better served by the text than by a
 * branch that silently claims the file is undecodable. `path` is the argument
 * the call was made with, used when the value does not carry its own.
 */
export function toReadError(value: unknown, path: string): ReadError {
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    const p = str(v.path) ?? path;
    const message = str(v.message);
    const format = str(v.format);
    switch (v.kind) {
      case 'invalidUtf8':
        return { kind: 'invalidUtf8', path: p };
      case 'binary':
        if (format !== null) {
          return { kind: 'binary', path: p, format };
        }
        break;
      case 'tooLarge':
        if (message !== null) {
          return { kind: 'tooLarge', path: p, message };
        }
        break;
      case 'io':
        if (message !== null) {
          return { kind: 'io', path: p, message };
        }
        break;
    }
  }
  return { kind: 'io', path, message: String(value) };
}

/**
 * What to show the user. `tooLarge` and `io` keep the message the backend
 * produced, unchanged; the two new causes are written in the user's language
 * instead, since they have to say what the file is and why it cannot be shown.
 */
export function readErrorMessage(error: ReadError, t: TFn): string {
  switch (error.kind) {
    case 'invalidUtf8':
      return t('readErrorInvalidUtf8');
    case 'binary':
      return t('readErrorBinary', { format: error.format });
    case 'tooLarge':
    case 'io':
      return error.message;
  }
}
