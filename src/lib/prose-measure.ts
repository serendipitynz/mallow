/** How long a line of prose may run in a markdown article (decision-15 §3).
 *  The values name a measure rather than carry one: the widths live in
 *  `markdown.scss`, keyed on the article's `data-prose-measure`, so this module
 *  says which and the stylesheet says how wide.
 *
 *  localStorage rather than settings.json because the article is laid out at
 *  mount: a synchronous read lays it out once at the chosen measure, where the
 *  store's asynchronous one would lay it out at the default and then again. */

export type ProseMeasure = 'standard' | 'wide' | 'full';

export const PROSE_MEASURES: readonly ProseMeasure[] = ['standard', 'wide', 'full'];

const DEFAULT_MEASURE: ProseMeasure = 'standard';

const PROSE_MEASURE_KEY = 'proseMeasure';

const listeners = new Set<() => void>();

/** Cached for the reason `lib/outline-pref` caches: `useSyncExternalStore`
 *  calls the getter on every render, and an unreachable localStorage would
 *  otherwise throw per render and answer the default rather than what was just
 *  applied. */
let current: ProseMeasure | null = null;

/** A stored value read back, landing on the default for anything this build
 *  does not know — a value written by a later version is not an error. */
export function parseProseMeasure(raw: string | null): ProseMeasure {
  return PROSE_MEASURES.find((measure) => measure === raw) ?? DEFAULT_MEASURE;
}

export function readProseMeasure(): ProseMeasure {
  if (current === null) {
    try {
      current = parseProseMeasure(localStorage.getItem(PROSE_MEASURE_KEY));
    } catch {
      current = DEFAULT_MEASURE;
    }
  }
  return current;
}

/** Shaped for `useSyncExternalStore`, whose snapshot is `readProseMeasure`. */
export function onProseMeasureChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Apply the measure to this window without persisting it — what a window does
 *  when another window is the one that chose it (`lib/settings-sync`). */
export function applyProseMeasure(measure: ProseMeasure): void {
  current = measure;
  listeners.forEach((cb) => {
    cb();
  });
}

/** Persist the measure and apply it. Telling the other windows is the caller's,
 *  so that this module keeps no dependency on the Tauri layer. */
export function writeProseMeasure(measure: ProseMeasure): void {
  try {
    localStorage.setItem(PROSE_MEASURE_KEY, measure);
  } catch {
    // Non-fatal: this window still lays out at the chosen measure.
  }
  applyProseMeasure(measure);
}
