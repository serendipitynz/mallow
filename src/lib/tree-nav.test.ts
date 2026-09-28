import { describe, expect, it } from 'vitest';
import { isShownUnder, tabStopPath, treeKeyAction, visibleRows } from './tree-nav';
import type { FileEntry } from './types';

const dir = (path: string): FileEntry => ({ name: path, path, isDir: true, kind: 'directory' });
const file = (path: string): FileEntry => ({ name: path, path, isDir: false, kind: 'markdown' });

// a/            (open)
//   a/x.md
//   a/b/        (open, children unknown)
// c/            (closed)
// d.md
const roots = [dir('a'), dir('c'), file('d.md')];
const children = new Map<string, FileEntry[]>([['a', [file('a/x.md'), dir('a/b')]]]);
const expanded = new Set(['a', 'a/b']);
const rows = visibleRows(roots, expanded, children);
const at = (path: string) => rows.findIndex((row) => row.entry.path === path);

describe('visibleRows', () => {
  it('lists the shown rows in screen order, children under their open parent', () => {
    expect(rows.map((row) => row.entry.path)).toEqual(['a', 'a/x.md', 'a/b', 'c', 'd.md']);
    expect(rows[at('a/b')].parent).toBe('a');
  });

  it('gives an open directory its first child only once the children are known', () => {
    expect(rows[at('a')].firstChild).toBe('a/x.md');
    expect(rows[at('a/b')]).toMatchObject({ expanded: true, firstChild: null });
    expect(rows[at('c')]).toMatchObject({ expanded: false, firstChild: null });
  });
});

describe('treeKeyAction', () => {
  it('moves up and down one shown row and stops at the ends', () => {
    expect(treeKeyAction(rows, at('a'), 'ArrowDown')).toEqual({ kind: 'focus', path: 'a/x.md' });
    expect(treeKeyAction(rows, at('c'), 'ArrowUp')).toEqual({ kind: 'focus', path: 'a/b' });
    expect(treeKeyAction(rows, at('d.md'), 'ArrowDown')).toEqual({ kind: 'focus', path: 'd.md' });
    expect(treeKeyAction(rows, at('a'), 'ArrowUp')).toEqual({ kind: 'focus', path: 'a' });
  });

  it('reaches the first and last shown row', () => {
    expect(treeKeyAction(rows, at('a/b'), 'Home')).toEqual({ kind: 'focus', path: 'a' });
    expect(treeKeyAction(rows, at('a/b'), 'End')).toEqual({ kind: 'focus', path: 'd.md' });
  });

  it('opens a closed directory on the right arrow, then moves into it', () => {
    expect(treeKeyAction(rows, at('c'), 'ArrowRight')).toEqual({ kind: 'toggle', path: 'c' });
    expect(treeKeyAction(rows, at('a'), 'ArrowRight')).toEqual({ kind: 'focus', path: 'a/x.md' });
  });

  it('consumes the right arrow without acting on a file or an open directory with no known child', () => {
    expect(treeKeyAction(rows, at('d.md'), 'ArrowRight')).toEqual({ kind: 'none' });
    expect(treeKeyAction(rows, at('a/b'), 'ArrowRight')).toEqual({ kind: 'none' });
  });

  it('closes an open directory on the left arrow, otherwise moves to the parent', () => {
    expect(treeKeyAction(rows, at('a'), 'ArrowLeft')).toEqual({ kind: 'toggle', path: 'a' });
    expect(treeKeyAction(rows, at('a/x.md'), 'ArrowLeft')).toEqual({ kind: 'focus', path: 'a' });
  });

  it('does nothing on the left arrow at the top level', () => {
    expect(treeKeyAction(rows, at('c'), 'ArrowLeft')).toEqual({ kind: 'none' });
    expect(treeKeyAction(rows, at('d.md'), 'ArrowLeft')).toEqual({ kind: 'none' });
  });

  it('activates a file and toggles a directory on Enter', () => {
    expect(treeKeyAction(rows, at('d.md'), 'Enter')).toEqual({ kind: 'activate', entry: file('d.md') });
    expect(treeKeyAction(rows, at('c'), 'Enter')).toEqual({ kind: 'toggle', path: 'c' });
  });

  it('leaves other keys, Tab included, to the platform', () => {
    expect(treeKeyAction(rows, at('a'), 'Tab')).toBeNull();
    expect(treeKeyAction(rows, at('a'), 'a')).toBeNull();
    expect(treeKeyAction(rows, -1, 'ArrowDown')).toBeNull();
  });
});

describe('tabStopPath', () => {
  it('keeps the row that last held the focus', () => {
    expect(tabStopPath(rows, 'a/b', 'd.md')).toBe('a/b');
  });

  it('falls back to the selected row, then the first, when the remembered one is gone', () => {
    expect(tabStopPath(rows, 'gone.md', 'd.md')).toBe('d.md');
    expect(tabStopPath(rows, null, 'c/hidden.md')).toBe('a');
    expect(tabStopPath([], null, null)).toBeNull();
  });
});

describe('isShownUnder', () => {
  it('finds a descendant at any depth, and not the row itself or a sibling', () => {
    const deeper = visibleRows(roots, expanded, new Map([...children, ['a/b', [file('a/b/y.md')]]]));
    expect(isShownUnder(deeper, 'a/b/y.md', 'a')).toBe(true);
    expect(isShownUnder(deeper, 'a', 'a')).toBe(false);
    expect(isShownUnder(deeper, 'd.md', 'a')).toBe(false);
  });
});
