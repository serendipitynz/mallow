import { describe, expect, it } from 'vitest';
import type { WindowInit } from './types';
import { locationToOpenAtMount } from './window-init';

const SESSION = { lastFolder: '/docs', lastFile: '/docs/readme.md' };

describe('what a window opens at mount', () => {
  it('opens the stored session where nothing created the window', () => {
    expect(locationToOpenAtMount(null, SESSION)).toEqual({ folder: '/docs', file: '/docs/readme.md' });
  });

  it('opens nothing where nothing created the window and the session is empty', () => {
    expect(locationToOpenAtMount(null, {})).toBeNull();
  });

  it('opens a stored folder with no file as a folder with no file', () => {
    expect(locationToOpenAtMount(null, { lastFolder: '/docs' })).toEqual({ folder: '/docs', file: null });
  });

  /* The regression. `open_window()` with no location deposits an entry whose
     `location` is null, and reading that as "no entry" sent the window on to the
     stored session — so New Window opened a duplicate of the last folder, which is
     the one thing it is specified not to do. */
  it('leaves a window created empty empty, even with a folder in the session', () => {
    const created: WindowInit = { location: null };
    expect(locationToOpenAtMount(created, SESSION)).toBeNull();
  });

  it('opens what a created window was handed, not what the session remembers', () => {
    const created: WindowInit = { location: { folder: '/notes', file: null } };
    expect(locationToOpenAtMount(created, SESSION)).toEqual({ folder: '/notes', file: null });
  });

  it('carries the file half of what a created window was handed', () => {
    const created: WindowInit = { location: { folder: '/notes', file: '/notes/a.md' } };
    expect(locationToOpenAtMount(created, SESSION)).toEqual({ folder: '/notes', file: '/notes/a.md' });
  });
});
