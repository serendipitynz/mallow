import { describe, expect, it } from 'vitest';
import type { WindowInit } from './types';
import { locationToOpenAtMount } from './window-init';

describe('what a window opens at mount', () => {
  it('opens what a created window was handed', () => {
    const created: WindowInit = { location: { folder: '/notes', file: null } };
    expect(locationToOpenAtMount(created)).toEqual({ folder: '/notes', file: null });
  });

  it('carries the file half of what a created window was handed', () => {
    const created: WindowInit = { location: { folder: '/notes', file: '/notes/a.md' } };
    expect(locationToOpenAtMount(created)).toEqual({ folder: '/notes', file: '/notes/a.md' });
  });

  /* The regression this module exists for, in its surviving form. A window
     created empty was meant to open nothing — New Window opens a window to
     compare against something, so it opens a different folder — and nothing here
     may send it looking for a folder elsewhere. */
  it('leaves a window created empty empty', () => {
    const created: WindowInit = { location: null };
    expect(locationToOpenAtMount(created)).toBeNull();
  });

  /* Which today is a WebView reload: the window's entry was taken at its first
     mount, so there is nothing left to open and the restored session is not
     consulted a second time. */
  it('opens nothing where the entry has already been taken', () => {
    expect(locationToOpenAtMount(null)).toBeNull();
  });
});
