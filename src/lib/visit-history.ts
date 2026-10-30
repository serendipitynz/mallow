/** A window's visit history and its file view state (TASK-44).
 *
 *  - **visit history** — the ordered files this window has shown, with a cursor
 *    on the one on screen. Back and forward move the cursor; showing a file any
 *    other way drops everything after the cursor and appends the file.
 *  - **file view state** — the view mode and the scroll anchor a file was left
 *    in, restored when it is shown again, by history or by the tree alike.
 *
 *  Both belong to the window's folder and are emptied together when it changes
 *  (decision-4's rule 7 is the same rule for the tab set). Pure, so the rules are
 *  tested without a DOM; `App` holds the value and the views report into it. */
import type { ScrollAnchor } from './scroll';

/** How many entries the visit history keeps; the oldest goes first.
 *
 *  Chromium's per-tab session history stops at 50 entries
 *  (`kMaxSessionHistoryEntries`), which is the bound readers already live with
 *  in a browser. Nothing here is expensive — an entry is a path — so the bound
 *  exists so that a window left open on a large tree for days does not grow
 *  without end, not to save memory. */
export const MAX_VISITS = 50;

/** How many files keep a remembered view state; the one left longest ago goes
 *  first, **but never one the visit history still holds**.
 *
 *  Twice {@link MAX_VISITS} so that rule can always be met: the history holds at
 *  most 50 distinct paths, so among 101 remembered files at least 51 are
 *  evictable, and every file Back can reach comes back where it was left. A
 *  record is a mode and an anchor, so the bound is about unbounded growth again. */
export const MAX_REMEMBERED_VIEWS = 2 * MAX_VISITS;

/** Every value a view switch offers, across the views that have one. Each view
 *  reads back only its own values through {@link rememberedMode}. */
export type ViewMode = 'preview' | 'rendered' | 'tree' | 'table' | 'source';

export interface FileViewState {
  /** `null` for a view with no switch. The default stays with the view: one
   *  whose default depends on the parse (`ConfigView`) cannot have it fixed
   *  here. */
  mode: ViewMode | null;
  anchor: ScrollAnchor;
}

export interface Visits {
  /** Bumped on every folder change. A view reports with the epoch it was shown
   *  under, so a view leaving *because* the folder changed cannot write its
   *  state into the new folder's memory — which it otherwise would whenever the
   *  new folder contains the old one. */
  readonly epoch: number;
  readonly entries: readonly string[];
  /** Index of the entry on screen, -1 while the history is empty. */
  readonly cursor: number;
  /** In the order the files were last left, oldest first. */
  readonly views: ReadonlyMap<string, FileViewState>;
}

export const NO_VISITS: Visits = { epoch: 0, entries: [], cursor: -1, views: new Map() };

export type Direction = 'back' | 'forward';

const STEP: Record<Direction, number> = { back: -1, forward: 1 };

/** The folder changed: nothing from the previous one carries over. */
export function startFolder(visits: Visits): Visits {
  return { epoch: visits.epoch + 1, entries: [], cursor: -1, views: new Map() };
}

/** `path` was shown by some route other than back / forward. Showing the file
 *  already on screen is not a visit. */
export function visit(visits: Visits, path: string): Visits {
  if (visits.entries[visits.cursor] === path) {
    return visits;
  }
  const kept = [...visits.entries.slice(0, visits.cursor + 1), path];
  const entries = kept.slice(Math.max(0, kept.length - MAX_VISITS));
  return { ...visits, entries, cursor: entries.length - 1 };
}

export function canGo(visits: Visits, direction: Direction): boolean {
  const next = visits.cursor + STEP[direction];
  return visits.cursor >= 0 && next >= 0 && next < visits.entries.length;
}

/** Drop the entry at `index`, keeping the cursor on the file it was on. Two
 *  neighbours the removal brings together can be the same file, and one of them
 *  goes too — otherwise the next press would "move" to the file already on
 *  screen and look like it did nothing. */
function without(visits: Visits, index: number): Visits {
  const entries = [...visits.entries];
  let cursor = visits.cursor;
  const remove = (at: number) => {
    entries.splice(at, 1);
    if (at < cursor) {
      cursor -= 1;
    }
  };
  remove(index);
  const left = index - 1;
  if (left >= 0 && index < entries.length && entries[left] === entries[index]) {
    remove(left === cursor ? index : left);
  }
  return { ...visits, entries, cursor };
}

/** Move one step in `direction`, skipping — and dropping — every entry whose
 *  file no longer exists. Dropped rather than kept to be skipped again, so
 *  whether Back can go anywhere stays a fact about the history alone.
 *
 *  `path` is the file to show, or `null` when there was nowhere to go; `visits`
 *  is the history to keep in either case, since a skip may have pruned it. */
export async function travel(
  visits: Visits,
  direction: Direction,
  exists: (path: string) => Promise<boolean>,
): Promise<{ visits: Visits; path: string | null }> {
  let current = visits;
  while (canGo(current, direction)) {
    const index = current.cursor + STEP[direction];
    const path = current.entries[index];
    if (await exists(path)) {
      return { visits: { ...current, cursor: index }, path };
    }
    current = without(current, index);
  }
  return { visits: current, path: null };
}

/** Record how `path` was left. Ignored when `epoch` is not the current one: the
 *  view was shown under the previous folder. */
export function rememberView(visits: Visits, epoch: number, path: string, state: FileViewState): Visits {
  if (epoch !== visits.epoch) {
    return visits;
  }
  const views = new Map(visits.views);
  views.delete(path);
  views.set(path, state);
  if (views.size > MAX_REMEMBERED_VIEWS) {
    const held = new Set(visits.entries);
    for (const key of views.keys()) {
      if (views.size <= MAX_REMEMBERED_VIEWS) {
        break;
      }
      if (!held.has(key)) {
        views.delete(key);
      }
    }
  }
  return { ...visits, views };
}

export function rememberedView(visits: Visits, path: string): FileViewState | null {
  return visits.views.get(path) ?? null;
}

/** The remembered mode if it is one `modes` offers, else `null` — the view then
 *  takes its own default. */
export function rememberedMode<M extends ViewMode>(state: FileViewState | null, modes: readonly M[]): M | null {
  const mode = state?.mode;
  return mode !== undefined && mode !== null && (modes as readonly ViewMode[]).includes(mode) ? (mode as M) : null;
}
