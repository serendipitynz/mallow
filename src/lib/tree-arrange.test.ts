import { describe, expect, it } from 'vitest';
import { arrangeTree, compareEntries, filterApplies, readTreeSort } from './tree-arrange';
import type { FileEntry, FileKind } from './types';

const dir = (path: string): FileEntry => ({
  name: path.split('/').pop() ?? path,
  path,
  isDir: true,
  kind: 'directory',
  modified: null,
  created: null,
});

const file = (
  path: string,
  {
    kind = 'markdown',
    modified = null,
    created = null,
  }: { kind?: FileKind; modified?: number | null; created?: number | null } = {},
): FileEntry => ({ name: path.split('/').pop() ?? path, path, isDir: false, kind, modified, created });

const names = (entries: readonly FileEntry[]) => entries.map((entry) => entry.name);

describe('readTreeSort', () => {
  it('reads each stored sort back', () => {
    expect(readTreeSort('modified')).toBe('modified');
    expect(readTreeSort('kind')).toBe('kind');
  });

  it('reads an absent or unknown value as the name order', () => {
    expect(readTreeSort(undefined)).toBe('name');
    expect(readTreeSort(null)).toBe('name');
    expect(readTreeSort('size')).toBe('name');
  });
});

describe('compareEntries', () => {
  const sorted = (entries: FileEntry[], sort: Parameters<typeof compareEntries>[0]) =>
    names([...entries].sort(compareEntries(sort)));

  it('puts directories first, case-insensitively by name, in the name order', () => {
    const entries = [file('b.md'), dir('zsub'), file('A.md'), dir('Asub'), file('a.md')];
    expect(sorted(entries, 'name')).toEqual(['Asub', 'zsub', 'A.md', 'a.md', 'b.md']);
  });

  it('keeps directories first and by name in every order', () => {
    const entries = [file('a.md', { modified: 1 }), dir('b'), dir('a')];
    for (const sort of ['name', 'kind', 'created', 'modified'] as const) {
      expect(sorted(entries, sort)).toEqual(['a', 'b', 'a.md']);
    }
  });

  it('groups by kind in the fixed order, then by name', () => {
    const entries = [
      file('z.png', { kind: 'image' }),
      file('b.json', { kind: 'json' }),
      file('b.md'),
      file('a.json', { kind: 'json' }),
      file('a.md'),
    ];
    expect(sorted(entries, 'kind')).toEqual(['a.md', 'b.md', 'a.json', 'b.json', 'z.png']);
  });

  it('puts the newest modification first and ties by name', () => {
    const entries = [file('old.md', { modified: 10 }), file('b.md', { modified: 30 }), file('a.md', { modified: 30 })];
    expect(sorted(entries, 'modified')).toEqual(['a.md', 'b.md', 'old.md']);
  });

  it('places an entry with no creation time after every dated one, by name among themselves', () => {
    const entries = [
      file('c.md', { created: null }),
      file('old.md', { created: 10 }),
      file('a.md', { created: null }),
      file('new.md', { created: 20 }),
    ];
    expect(sorted(entries, 'created')).toEqual(['new.md', 'old.md', 'a.md', 'c.md']);
  });

  it('orders by the chosen time alone, not the other one', () => {
    const entries = [file('a.md', { created: 1, modified: 99 }), file('b.md', { created: 2, modified: 1 })];
    expect(sorted(entries, 'created')).toEqual(['b.md', 'a.md']);
    expect(sorted(entries, 'modified')).toEqual(['a.md', 'b.md']);
  });
});

describe('filterApplies', () => {
  it('does not filter on an empty or blank query', () => {
    expect(filterApplies('')).toBe(false);
    expect(filterApplies('   ')).toBe(false);
    expect(filterApplies(' a ')).toBe(true);
  });
});

describe('arrangeTree', () => {
  const none = new Set<string>();
  const roots = [file('/r/readme.md'), dir('/r/docs'), dir('/r/unread'), file('/r/notes.md')];
  const childrenByPath = new Map<string, FileEntry[]>([
    ['/r/docs', [file('/r/docs/guide.md'), dir('/r/docs/deep'), file('/r/docs/README.json', { kind: 'json' })]],
    ['/r/docs/deep', [file('/r/docs/deep/readme-2.md')]],
  ]);

  it('sorts the roots and every read folder when nothing is filtered', () => {
    const tree = arrangeTree(roots, childrenByPath, none, 'name', '');
    expect(names(tree.roots)).toEqual(['docs', 'unread', 'notes.md', 'readme.md']);
    expect(names(tree.children.get('/r/docs') ?? [])).toEqual(['deep', 'guide.md', 'README.json']);
    expect(tree.children.has('/r/unread')).toBe(false);
  });

  it('keeps matches, the read folders holding them, and every folder not yet read', () => {
    const tree = arrangeTree(roots, childrenByPath, none, 'name', 'readme');
    expect(names(tree.roots)).toEqual(['docs', 'unread', 'readme.md']);
    expect(names(tree.children.get('/r/docs') ?? [])).toEqual(['deep', 'README.json']);
    expect(names(tree.children.get('/r/docs/deep') ?? [])).toEqual(['readme-2.md']);
  });

  it('drops a read folder with nothing matching inside', () => {
    const tree = arrangeTree(roots, childrenByPath, none, 'name', 'notes');
    expect(names(tree.roots)).toEqual(['unread', 'notes.md']);
  });

  it('keeps an open folder with nothing matching inside, so reading it does not take it away', () => {
    const tree = arrangeTree(roots, childrenByPath, new Set(['/r/docs']), 'name', 'notes');
    expect(names(tree.roots)).toEqual(['docs', 'unread', 'notes.md']);
    expect(tree.children.get('/r/docs')).toEqual([]);
  });

  it('shows a matching folder with its contents unfiltered', () => {
    const tree = arrangeTree(roots, childrenByPath, none, 'name', 'DOCS');
    expect(names(tree.roots)).toEqual(['docs', 'unread']);
    expect(names(tree.children.get('/r/docs') ?? [])).toEqual(['deep', 'guide.md', 'README.json']);
    expect(names(tree.children.get('/r/docs/deep') ?? [])).toEqual(['readme-2.md']);
  });

  it('folds width and case, and ignores surrounding spaces', () => {
    const wide = [file('/r/Ｒｅａｄｍｅ.md'), file('/r/other.md')];
    expect(names(arrangeTree(wide, new Map(), none, 'name', '  readme ').roots)).toEqual(['Ｒｅａｄｍｅ.md']);
  });

  it('leaves nothing when nothing matches and every folder has been read', () => {
    const read = new Map<string, FileEntry[]>([['/r/docs', [file('/r/docs/guide.md')]]]);
    expect(arrangeTree([dir('/r/docs'), file('/r/a.md')], read, none, 'name', 'zzz').roots).toEqual([]);
  });

  it('keeps the chosen order inside a filtered folder', () => {
    const read = new Map<string, FileEntry[]>([
      ['/r/d', [file('/r/d/a-note.md', { modified: 1 }), file('/r/d/b-note.md', { modified: 2 }), file('/r/d/x.md')]],
    ]);
    const tree = arrangeTree([dir('/r/d')], read, none, 'modified', 'note');
    expect(names(tree.children.get('/r/d') ?? [])).toEqual(['b-note.md', 'a-note.md']);
  });
});
