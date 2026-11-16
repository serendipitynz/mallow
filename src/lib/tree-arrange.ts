import type { FileEntry, FileKind } from './types';

export const TREE_SORTS = ['name', 'kind', 'created', 'modified'] as const;
export type TreeSort = (typeof TREE_SORTS)[number];
export const DEFAULT_TREE_SORT: TreeSort = 'name';

/** The stored preference read back: settings.json is a file a reader can edit,
 *  so a value outside the set reads as the default rather than as no order. */
export function readTreeSort(stored: unknown): TreeSort {
  return TREE_SORTS.find((sort) => sort === stored) ?? DEFAULT_TREE_SORT;
}

/** Documents, then data and configuration, then plain text, then media. */
const KIND_ORDER: readonly FileKind[] = [
  'markdown',
  'mermaid',
  'html',
  'csv',
  'json',
  'yaml',
  'toml',
  'xml',
  'ini',
  'text',
  'diff',
  'sql',
  'image',
  'pdf',
  'video',
];

function kindRank(kind: FileKind): number {
  const rank = KIND_ORDER.indexOf(kind);
  return rank === -1 ? KIND_ORDER.length : rank;
}

/** Case-insensitive, then by the exact name, so two spellings differing in case
 *  alone still have one order rather than the filesystem's. */
function compareNames(a: FileEntry, b: FileEntry): number {
  const la = a.name.toLowerCase();
  const lb = b.name.toLowerCase();
  if (la !== lb) {
    return la < lb ? -1 : 1;
  }
  if (a.name === b.name) {
    return 0;
  }
  return a.name < b.name ? -1 : 1;
}

/** Newest first. An entry without the time goes after every entry that has one:
 *  `created` is absent wherever the filesystem keeps no birth time, and placing
 *  those by name among the dated ones would read as a date they do not have. */
function compareTimes(a: number | null, b: number | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return b - a;
}

/** Directories first in every order, and among themselves by name: a folder's
 *  times say when its own listing changed, not when anything inside was edited,
 *  so a date order over folders would put the latest edit nowhere near the top. */
export function compareEntries(sort: TreeSort): (a: FileEntry, b: FileEntry) => number {
  return (a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    let order = 0;
    if (!a.isDir) {
      switch (sort) {
        case 'kind':
          order = kindRank(a.kind) - kindRank(b.kind);
          break;
        case 'created':
          order = compareTimes(a.created, b.created);
          break;
        case 'modified':
          order = compareTimes(a.modified, b.modified);
          break;
        case 'name':
          break;
      }
    }
    return order || compareNames(a, b);
  };
}

function foldName(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** Whether a filter is applied at all — surrounding spaces typed by accident do
 *  not filter. */
export function filterApplies(query: string): boolean {
  return query.trim() !== '';
}

/** What the explorer shows: the roots, and for every folder it reached the
 *  children it shows. A folder absent from `children` has not been read. */
export interface ArrangedTree {
  roots: FileEntry[];
  children: Map<string, FileEntry[]>;
}

/** The tree in the chosen order, narrowed to names containing `query`.
 *
 *  The filter reaches only what has been read, because the tree is lazy: a
 *  folder never read is kept, since what is inside it is not known and hiding it
 *  would hide a match. A read folder is kept when its own name matches — and its
 *  contents are then shown unfiltered, which is what typing a folder's name is
 *  for — when something kept is inside it, or when it is in `open`: opening a
 *  folder reads it, and one that vanished on the read would take the focus with
 *  it. Applied at render, so a watcher refresh replacing the entries comes out in
 *  the same order and filter. */
export function arrangeTree(
  roots: readonly FileEntry[],
  childrenByPath: ReadonlyMap<string, readonly FileEntry[]>,
  open: ReadonlySet<string>,
  sort: TreeSort,
  query: string,
): ArrangedTree {
  const needle = filterApplies(query) ? foldName(query.trim()) : null;
  const compare = compareEntries(sort);
  const children = new Map<string, FileEntry[]>();
  const matches = (entry: FileEntry) => needle !== null && foldName(entry.name).includes(needle);

  const arrange = (entries: readonly FileEntry[], filtering: boolean): FileEntry[] => {
    const kept: FileEntry[] = [];
    for (const entry of entries) {
      const shownWhole = !filtering || matches(entry);
      if (!entry.isDir) {
        if (shownWhole) {
          kept.push(entry);
        }
        continue;
      }
      const read = childrenByPath.get(entry.path);
      if (read === undefined) {
        kept.push(entry);
        continue;
      }
      const inside = arrange(read, !shownWhole);
      children.set(entry.path, inside);
      if (shownWhole || inside.length > 0 || open.has(entry.path)) {
        kept.push(entry);
      }
    }
    return kept.sort(compare);
  };

  return { roots: arrange(roots, needle !== null), children };
}
