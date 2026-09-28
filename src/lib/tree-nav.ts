import type { FileEntry } from './types';

/** One row the tree currently shows, with what the keys need to know about it. */
export interface TreeRow {
  entry: FileEntry;
  parent: string | null;
  expanded: boolean;
  /** The first row under an open directory, or `null` while its children are
   *  unknown, still loading, or none. */
  firstChild: string | null;
}

/** The rows on screen, top to bottom — what the arrows, Home and End move over. */
export function visibleRows(
  roots: readonly FileEntry[],
  expanded: ReadonlySet<string>,
  childrenByPath: ReadonlyMap<string, readonly FileEntry[]>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (entries: readonly FileEntry[], parent: string | null) => {
    for (const entry of entries) {
      const open = entry.isDir && expanded.has(entry.path);
      const children = open ? childrenByPath.get(entry.path) : undefined;
      rows.push({
        entry,
        parent,
        expanded: open,
        firstChild: children?.[0]?.path ?? null,
      });
      if (children) {
        walk(children, entry.path);
      }
    }
  };
  walk(roots, null);
  return rows;
}

/** `none` is a key the tree owns that has nothing to do here — a right arrow on
 *  a file — and is still consumed, so the scroll box does not scroll instead. */
export type TreeKeyAction =
  | { kind: 'focus'; path: string }
  | { kind: 'toggle'; path: string }
  | { kind: 'activate'; entry: FileEntry }
  | { kind: 'none' };

/** What a key does on the row at `index`, or `null` when the key is not the
 *  tree's. Moving the focus never selects (snz-design doc-9 §6.1.1): in mallow a
 *  selection replaces the viewer's document, so selecting on every arrow would
 *  open each file passed on the way. The arrows stop at the ends rather than
 *  wrapping, which is what separates a list that stays on screen from a menu. */
export function treeKeyAction(rows: readonly TreeRow[], index: number, key: string): TreeKeyAction | null {
  const row = rows[index];
  if (!row) {
    return null;
  }
  const focus = (path: string | null | undefined): TreeKeyAction => (path ? { kind: 'focus', path } : { kind: 'none' });
  switch (key) {
    case 'ArrowDown':
      return focus(rows[Math.min(index + 1, rows.length - 1)].entry.path);
    case 'ArrowUp':
      return focus(rows[Math.max(index - 1, 0)].entry.path);
    case 'Home':
      return focus(rows[0].entry.path);
    case 'End':
      return focus(rows[rows.length - 1].entry.path);
    case 'ArrowRight':
      if (!row.entry.isDir) {
        return { kind: 'none' };
      }
      return row.expanded ? focus(row.firstChild) : { kind: 'toggle', path: row.entry.path };
    case 'ArrowLeft':
      if (row.entry.isDir && row.expanded) {
        return { kind: 'toggle', path: row.entry.path };
      }
      return focus(row.parent);
    case 'Enter':
      return row.entry.isDir ? { kind: 'toggle', path: row.entry.path } : { kind: 'activate', entry: row.entry };
    default:
      return null;
  }
}

/** The one row Tab lands on: the row that last held the focus, else the
 *  selected one, else the first (snz-design doc-9 §6.1.1). A remembered row that
 *  is no longer shown — a refresh removed it — falls through rather than leaving
 *  the tree with no tab stop at all. */
export function tabStopPath(
  rows: readonly TreeRow[],
  remembered: string | null,
  selected: string | null,
): string | null {
  const shown = (path: string | null) => path !== null && rows.some((row) => row.entry.path === path);
  if (shown(remembered)) {
    return remembered;
  }
  if (shown(selected)) {
    return selected;
  }
  return rows[0]?.entry.path ?? null;
}

/** Whether `path` sits somewhere under `ancestor` among the shown rows — the case
 *  where closing `ancestor` would take the focused row off the screen. */
export function isShownUnder(rows: readonly TreeRow[], path: string, ancestor: string): boolean {
  const parents = new Map(rows.map((row) => [row.entry.path, row.parent]));
  let at = parents.get(path) ?? null;
  while (at !== null) {
    if (at === ancestor) {
      return true;
    }
    at = parents.get(at) ?? null;
  }
  return false;
}
