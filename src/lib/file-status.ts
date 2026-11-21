/** What the status bar says about the open file (TASK-69), and the window's one
 *  record of it: `Viewer` writes it as the file is opened, read and watched, and
 *  the footer reads it. */

import type { FileInfo } from './types';

export interface FileStatus {
  path: string;
  /** `null` until the metadata read answers, or where it failed. */
  info: FileInfo | null;
  /** The text the view was given, or `null` where none was read: a media file,
   *  a failed read, or a read still in flight. Counts are shown only for this. */
  text: string | null;
}

const UNITS = ['KiB', 'MiB', 'GiB', 'TiB'] as const;

/** Bytes below 1 KiB, else the 1024-based unit that keeps the value below 1024
 *  once it is rounded to one decimal — so 1,048,575 bytes is `1.0 MiB`, never
 *  `1,024.0 KiB`. */
export function formatSize(bytes: number, lang: string): string {
  if (bytes < 1024) {
    return `${new Intl.NumberFormat(lang).format(bytes)} B`;
  }
  const decimal = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let value = bytes / 1024;
  let unit = 0;
  while (unit < UNITS.length - 1 && Math.round(value * 10) / 10 >= 1024) {
    value /= 1024;
    unit += 1;
  }
  return `${decimal.format(value)} ${UNITS[unit]}`;
}

/** In the UI language and the local time zone, to the minute. */
export function formatTime(millis: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(millis);
}

let status: FileStatus | null = null;
const listeners = new Set<() => void>();

function publish(next: FileStatus | null): void {
  status = next;
  listeners.forEach((cb) => {
    cb();
  });
}

export function readFileStatus(): FileStatus | null {
  return status;
}

/** Shaped for `useSyncExternalStore`, whose snapshot is `readFileStatus`. */
export function onFileStatusChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** A file is now open, or none is. What was known about the previous one goes,
 *  so its size is never shown under the new file's name. Opening the file
 *  already shown keeps what is known, which is what a watched reload does. */
export function showFile(path: string | null): void {
  if (path === null) {
    if (status !== null) {
      publish(null);
    }
    return;
  }
  if (status?.path !== path) {
    publish({ path, info: null, text: null });
  }
}

/** Ignored unless `path` is the file shown: a read that answers after the reader
 *  moved on describes a file no longer open. */
export function setFileInfo(path: string, info: FileInfo | null): void {
  if (status?.path === path && status.info !== info) {
    publish({ ...status, info });
  }
}

/** As `setFileInfo`, for the text. */
export function setFileText(path: string, text: string | null): void {
  if (status?.path === path && status.text !== text) {
    publish({ ...status, text });
  }
}
