/** Thin typed wrappers around the Rust commands and Tauri plugin APIs. */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { message as messageDialog, open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { type ReadResult, toReadError } from './read-error';
import type { EditorInfo, FileEntry, InitialLocation, WindowInit } from './types';

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

/** Record `folder` at the front of the recent-folder list.
 *
 *  Rust owns the list so that a recording is one step: read, splice and write
 *  from here would be three, and two windows recording at once would lose an
 *  entry (see `src-tauri/src/recent.rs`). Nothing reads it back through here —
 *  the Open Recent submenu is built in Rust. */
export function recordRecent(folder: string): Promise<void> {
  return invoke('record_recent', { path: folder });
}

/** Close this window.
 *
 *  Needs `core:window:allow-close` in the capability: the core window default set
 *  carries the readers (`allow-title`, `allow-is-focused`, …) and none of the
 *  mutators, which is why `allow-set-title` is listed there too. */
export function closeWindow(): Promise<void> {
  return getCurrentWindow().close();
}

/** Tell Rust whether this window's active view is a markdown preview, so the
 *  `Print…` and `Export as PDF…` menu items can show it.
 *
 *  **The menu is app-wide while the condition is per window**, so what is sent is
 *  this window's answer and Rust decides which window's answer the menu shows.
 *  It is the same flag the two chords read (`lib/markdown-preview`), reported
 *  rather than re-derived. */
export function reportMarkdownPreview(active: boolean): Promise<void> {
  return invoke<void>('report_markdown_preview', { active });
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

/** Open the platform's print UI for this window. The whole `<body>` is what the
 *  engine paginates, which is why the command is named for the window (see
 *  decision-13 and `src-tauri/src/print.rs`). Resolving says nothing about a UI
 *  having appeared — macOS returns success where its own guard declines. */
export function printWindow(): Promise<void> {
  return invoke('print_window');
}

/** Ask the reader where the PDF should go; returns null if they cancelled.
 *
 *  decision-14 puts this ahead of the write rather than choosing a location: a
 *  file appearing somewhere the reader did not name is worse than one keystroke
 *  more. */
export async function pickPdfDestination(defaultPath?: string): Promise<string | null> {
  const chosen = await saveDialog({ defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  return chosen ?? null;
}

/** Write this window's PDF to `path` through the platform's print pipeline, with
 *  no print UI (decision-14 and `src-tauri/src/pdf.rs`). Named for the window for
 *  the reason `printWindow` is: the engine paginates the whole `<body>`, and
 *  `@media print` changes what is painted rather than what is paginated.
 *
 *  Unlike `printWindow`, resolving does mean the platform reported the file
 *  written — which is what makes it worth telling the reader when it rejects. */
export function writeWindowPdf(path: string): Promise<void> {
  return invoke('write_window_pdf', { path });
}

/** Put a failure in front of the reader. Used where the app cannot leave one in a
 *  view — an export writes a file the reader named, so silence would read as
 *  success. */
export async function showErrorDialog(title: string, text: string): Promise<void> {
  await messageDialog(text, { title, kind: 'error' });
}

/** Create a window, opening `location` at mount when one is given, and answer the
 *  label it was given. Absent means an empty window — New Window does not
 *  duplicate this window's folder.
 *
 *  The command also takes a label, which only the restore path supplies and which
 *  it supplies from Rust, so nothing here needs to name one. */
export function openWindow(location?: InitialLocation): Promise<string> {
  return invoke<string>('open_window', { location: location ?? null, label: null });
}

/** Say which folder this window now shows and which file is selected in it, so
 *  the restored session can bring this window back showing the same thing.
 *
 *  **Called whenever the displayed content changes, which is a predicate and not
 *  a list of call sites** — the folder picker, a restored or handed-over initial
 *  location and TASK-12.5's Open Recent replace are all of them today. `App`
 *  satisfies it with an effect on what is displayed rather than a call beside
 *  each of them, so the next way a folder can change is covered before it exists.
 *
 *  It does not stand in for `recordRecent`: the two record different facts. */
export function reportWindowContent(folder: string | null, file: string | null): Promise<void> {
  return invoke<void>('report_window_content', { folder, file });
}

/** Take what this window was told at creation. Answers it once and null
 *  afterwards — and null for a window `open_window` did not create, which is why
 *  a reloaded window comes back empty (see `src-tauri/src/window.rs`).
 *
 *  Null and `{ location: null }` are different answers — an already-taken entry
 *  against a window created with nowhere to open — and `lib/window-init` holds
 *  what each one opens, which since TASK-12.7 is nothing in both cases. */
export function takeWindowInit(): Promise<WindowInit | null> {
  return invoke<WindowInit | null>('take_window_init');
}
