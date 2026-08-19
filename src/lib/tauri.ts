/** Thin typed wrappers around the Rust commands and Tauri plugin APIs. */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { type ReadResult, toReadError } from './read-error';
import type { EditorInfo, FileEntry } from './types';

/** Set the native window title (fire-and-forget; errors are logged). */
export function setWindowTitle(title: string): void {
  void getCurrentWindow()
    .setTitle(title)
    .catch((e) => console.error('setTitle failed', e));
}

/** List the immediate children of a directory (directories + supported files). */
export function readDirTree(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('read_dir_tree', { path });
}

/** Read a text file as UTF-8. Resolves a discriminated result rather than
 *  rejecting, so callers are forced through the failure branch — see
 *  `lib/read-error` for why the rejection could not be typed instead. */
export async function readFile(path: string): Promise<ReadResult> {
  try {
    return { ok: true, text: await invoke<string>('read_file', { path }) };
  } catch (e) {
    return { ok: false, error: toReadError(e, path) };
  }
}

/** Whether a path still exists (used to validate a restored session). */
export function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>('path_exists', { path });
}

/** Grant the WebView asset protocol recursive read access to an opened folder,
 *  so media files under it can be rendered via `convertFileSrc`. */
export function allowMediaDir(path: string): Promise<void> {
  return invoke('allow_media_dir', { path });
}

/** Prompt the user to pick a folder; returns its path or null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const result = await openDialog({ directory: true, multiple: false });
  return typeof result === 'string' ? result : null;
}

/** Editors detected as installed on this platform. */
export function detectEditors(): Promise<EditorInfo[]> {
  return invoke<EditorInfo[]>('detect_editors');
}

/** Open a file in the given editor. */
export function openInEditor(id: string, path: string): Promise<void> {
  return invoke('open_in_editor', { id, path });
}

/** Reveal a file in the OS file manager (Finder / Explorer). */
export function revealInOs(path: string): Promise<void> {
  return invoke('reveal_in_os', { path });
}

/** Hand the file to the OS handler registered for its type. A custom command
 *  rather than the opener plugin, whose path scope cannot be satisfied without a
 *  second runtime-scope mechanism (decision-3). */
export function openInDefaultApp(path: string): Promise<void> {
  return invoke('open_in_default_app', { path });
}
