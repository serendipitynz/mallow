import { describe, expect, it } from 'vitest';
import { droppedToOpen, handedAction } from './handover';

describe('handedAction', () => {
  it('opens a folder as a location with no file', () => {
    expect(handedAction({ kind: 'open', folder: '/r/docs', file: null })).toEqual({
      open: { folder: '/r/docs', file: null },
    });
  });

  it('opens a file inside the folder Rust resolved for it', () => {
    expect(handedAction({ kind: 'open', folder: '/r', file: '/r/a.md' })).toEqual({
      open: { folder: '/r', file: '/r/a.md' },
    });
  });

  it('reports each refusal under its own sentence', () => {
    expect(handedAction({ kind: 'missing', path: '/gone.md' })).toEqual({
      notice: { key: 'handoverMissing', path: '/gone.md' },
    });
    expect(handedAction({ kind: 'unsupported', path: '/a.docx' })).toEqual({
      notice: { key: 'handoverUnsupported', path: '/a.docx' },
    });
    expect(handedAction({ kind: 'notAFile', url: 'https://x/y.md' })).toEqual({
      notice: { key: 'handoverNotAFile', path: 'https://x/y.md' },
    });
  });
});

describe('droppedToOpen', () => {
  it('opens nothing when nothing was dropped', () => {
    expect(droppedToOpen([])).toBeNull();
  });

  it('opens the first item and counts the rest', () => {
    expect(droppedToOpen(['/a.md'])).toEqual({ path: '/a.md', skipped: 0 });
    expect(droppedToOpen(['/a.md', '/b.md', '/c'])).toEqual({ path: '/a.md', skipped: 2 });
  });
});
