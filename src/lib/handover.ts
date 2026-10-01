/** What a window does with a location the OS handed to mallow (TASK-38,
 *  decision-16). Rust classifies the path — the frontend cannot ask the
 *  filesystem whether it is a folder — and this decides what that answer
 *  becomes here: a location for `openLocation`, or a sentence for the notice.
 *
 *  No Tauri import, so the decision is testable under Node; the invoke wrappers
 *  are in `lib/tauri`. */
import type { InitialLocation } from './types';

/** Mirrors `handover::Handed` in Rust. */
export type Handed =
  | { kind: 'open'; folder: string; file: string | null }
  | { kind: 'missing'; path: string }
  | { kind: 'unsupported'; path: string }
  | { kind: 'notAFile'; url: string };

export type HandedAction =
  | { open: InitialLocation }
  | { notice: { key: 'handoverMissing' | 'handoverUnsupported' | 'handoverNotAFile'; path: string } };

export function handedAction(item: Handed): HandedAction {
  switch (item.kind) {
    case 'open':
      return { open: { folder: item.folder, file: item.file } };
    case 'missing':
      return { notice: { key: 'handoverMissing', path: item.path } };
    case 'unsupported':
      return { notice: { key: 'handoverUnsupported', path: item.path } };
    case 'notAFile':
      return { notice: { key: 'handoverNotAFile', path: item.url } };
  }
}

/** The one dropped path a window opens, and how many were left unopened.
 *
 *  **One, not one window each**: a window carries one folder and one document
 *  until tabs exist (decision-4), and a drop names the window it lands on — so
 *  the other items would each have to open somewhere the reader did not point. */
export function droppedToOpen(paths: readonly string[]): { path: string; skipped: number } | null {
  const [path] = paths;
  return path === undefined ? null : { path, skipped: paths.length - 1 };
}
