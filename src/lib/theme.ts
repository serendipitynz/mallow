/**
 * The colour choice on `<html>`: a family and a light / dark mode, chosen
 * separately (snz-design doc-7 §4) and persisted to localStorage under one key
 * each. The rule that reads them and the scheme they draw is `lib/color-choice`;
 * this module holds the DOM, the storage and the subscriptions.
 *
 * What is written to `<html>` is the scheme drawn — `data-color-family` and a
 * `data-color-mode` that is light or dark, never auto — so nothing downstream
 * re-derives it from the OS (snz-design doc-16 §6.2). The bootstrap in
 * index.html puts the same two attributes there before first paint.
 */

import {
  type ColorChoice,
  drawnMode,
  FAMILY_KEY,
  LEGACY_KEY,
  MODE_KEY,
  type ReadChoice,
  type Resolved,
  readChoice,
  type StoredColor,
} from './color-choice';

export type { Resolved } from './color-choice';

const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<(theme: Resolved) => void>();
const choiceListeners = new Set<() => void>();

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode / disabled storage: read as nothing stored.
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / disabled storage: still apply for this session.
  }
}

// What is stored, mirrored so that a choice this session could not persist
// still reads back the way a reload would read a persisted one.
const stored: StoredColor = {
  legacy: readStored(LEGACY_KEY),
  family: readStored(FAMILY_KEY),
  mode: readStored(MODE_KEY),
};

let read: ReadChoice = readChoice(stored);

/** Shaped for `useSyncExternalStore`: the same object until the choice changes. */
export function getColorChoice(): ReadChoice {
  return read;
}

/** The side drawn once auto is resolved against the OS and the family's sides. */
export function resolveTheme(): Resolved {
  return drawnMode(read.choice, media.matches);
}

function applyColorAttributes(): void {
  const root = document.documentElement;
  root.dataset.colorFamily = read.choice.family;
  root.dataset.colorMode = resolveTheme();
}

let lastResolved: Resolved = resolveTheme();

function notify(): void {
  applyColorAttributes();
  const resolved = resolveTheme();
  if (resolved === lastResolved) {
    return;
  }
  lastResolved = resolved;
  listeners.forEach((cb) => {
    cb(resolved);
  });
}

/** Subscribe to the drawn light/dark side. Returns an unsubscribe function. A
 *  family change that keeps the side (Solarized Light to Standard Light) is not
 *  reported: those who redraw on this redraw only for a change of side
 *  (snz-design doc-7 §8.3). */
export function onThemeChange(callback: (theme: Resolved) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Subscribe to the reader's choice, which `onThemeChange` cannot stand in for:
 *  a family change can leave the side alone, and the controls have to follow
 *  it. Shaped for `useSyncExternalStore`, whose snapshot is `getColorChoice`. */
export function onColorChoiceChange(callback: () => void): () => void {
  choiceListeners.add(callback);
  return () => choiceListeners.delete(callback);
}

/** Reflect a change to one or both axes on `<html>` and notify subscribers,
 *  without persisting it.
 *
 *  What a window does when **another** window is the one that made the choice
 *  (`lib/settings-sync`): every window shares one WebView data store, so the
 *  originating window's write is already this window's stored value, and writing
 *  it again would be the receiving half re-doing the sending half's work. */
export function applyColorChoice(change: Partial<ColorChoice>): void {
  if (change.family !== undefined) {
    stored.family = change.family;
  }
  if (change.mode !== undefined) {
    stored.mode = change.mode;
  }
  read = readChoice(stored);
  notify();
  choiceListeners.forEach((cb) => {
    cb();
  });
}

/** Persist the reader's choice of one axis and apply it, answering what was
 *  written — which is what the caller tells the other windows, so that this
 *  module keeps no dependency on the Tauri layer.
 *
 *  **Only the chosen axis is written.** An axis with no key of its own is read
 *  from the pre-split value, which is what it was drawn from, so the axis not
 *  chosen stays what it was (snz-design doc-7 §4.2). The exception is a stored
 *  choice this version does not know: that is drawn as the initial choice, and
 *  left alone the unknown axis would keep the chosen one from taking effect, so
 *  both are written as drawn. */
export function chooseColor(change: Partial<ColorChoice>): Partial<ColorChoice> {
  const written: Partial<ColorChoice> = read.unrecognized ? { ...read.choice, ...change } : change;
  if (written.family !== undefined) {
    writeStored(FAMILY_KEY, written.family);
  }
  if (written.mode !== undefined) {
    writeStored(MODE_KEY, written.mode);
  }
  applyColorChoice(written);
  return written;
}

media.addEventListener('change', notify);
