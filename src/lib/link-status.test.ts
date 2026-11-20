import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLinkStatus,
  describeLink,
  onLinkStatusChange,
  readLinkStatus,
  setFocusedLink,
  setHoveredLink,
} from './link-status';

const headings: Record<string, string> = { install: 'Installation', 'été-2024': 'Été 2024' };
const preview = { fragmentsMove: true, webOpens: true, headingText: (id: string) => headings[id] ?? null };
const slide = { ...preview, fragmentsMove: false };

describe('describeLink', () => {
  it('shows a web link as written, whatever the case of its scheme', () => {
    expect(describeLink('https://example.com/a?b=1', preview)).toEqual({
      kind: 'web',
      text: 'https://example.com/a?b=1',
    });
    expect(describeLink('HTTP://example.com', slide)).toEqual({ kind: 'web', text: 'HTTP://example.com' });
  });

  it('names the heading a fragment lands on, decoding the id first', () => {
    expect(describeLink('#install', preview)).toEqual({ kind: 'fragment', text: 'Installation' });
    expect(describeLink('#%C3%A9t%C3%A9-2024', preview)).toEqual({ kind: 'fragment', text: 'Été 2024' });
  });

  it('falls back to the fragment as written where no heading carries it, or it cannot be decoded', () => {
    expect(describeLink('#fn1', preview)).toEqual({ kind: 'fragment', text: '#fn1' });
    expect(describeLink('#%E0%A4%A', preview)).toEqual({ kind: 'fragment', text: '#%E0%A4%A' });
  });

  it('calls a fragment inert where the view does not follow it', () => {
    expect(describeLink('#install', slide)).toEqual({ kind: 'inert', text: '#install' });
  });

  it('calls a web link inert where a click on it opens nothing', () => {
    // The rendered HTML view's frame where it runs no parent-registered listener
    // (decision-9): every link there is described as not opening.
    const scriptless = { ...preview, fragmentsMove: false, webOpens: false };
    expect(describeLink('https://example.com/a', scriptless)).toEqual({ kind: 'inert', text: 'https://example.com/a' });
    expect(describeLink('HTTP://example.com', scriptless)).toEqual({ kind: 'inert', text: 'HTTP://example.com' });
    expect(describeLink('#install', scriptless)).toEqual({ kind: 'inert', text: '#install' });
    // Fragments are decided by their own option, not by this one.
    expect(describeLink('#install', { ...preview, webOpens: false })).toEqual({
      kind: 'fragment',
      text: 'Installation',
    });
  });

  it('calls every other destination inert, as the click handlers treat it', () => {
    for (const href of ['./other.md', '../x.html', 'mailto:a@example.com', 'file:///etc/hosts', 'ftp://h/x', '']) {
      expect(describeLink(href, preview)).toEqual({ kind: 'inert', text: href });
    }
    // A scheme-relative or bare host is not http(s) to the click handler either.
    expect(describeLink('//example.com', preview).kind).toBe('inert');
    expect(describeLink('example.com', preview).kind).toBe('inert');
    // Only a leading scheme counts: a relative path naming a URL does not open.
    expect(describeLink('./https://example.com', preview).kind).toBe('inert');
  });
});

describe('link status', () => {
  afterEach(() => clearLinkStatus());

  const web = { kind: 'web', text: 'https://a.example' } as const;
  const inert = { kind: 'inert', text: './b.md' } as const;

  it('prefers the pointer over the focus, and shows the focus again once the pointer leaves', () => {
    setFocusedLink(inert);
    expect(readLinkStatus()).toBe(inert);
    setHoveredLink(web);
    expect(readLinkStatus()).toBe(web);
    setHoveredLink(null);
    expect(readLinkStatus()).toBe(inert);
    setFocusedLink(null);
    expect(readLinkStatus()).toBeNull();
  });

  it('notifies on a change only, and keeps the snapshot identical for an equal destination', () => {
    const seen = vi.fn();
    const stop = onLinkStatusChange(seen);
    setHoveredLink(web);
    setHoveredLink({ kind: 'web', text: 'https://a.example' });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readLinkStatus()).toBe(web);

    setHoveredLink({ kind: 'inert', text: 'https://a.example' });
    expect(seen).toHaveBeenCalledTimes(2);

    setHoveredLink({ kind: 'inert', text: './other.md' });
    expect(seen).toHaveBeenCalledTimes(3);
    expect(readLinkStatus()).toEqual({ kind: 'inert', text: './other.md' });

    stop();
    setHoveredLink(null);
    expect(seen).toHaveBeenCalledTimes(3);
  });

  it('treats the focus the same way, and says nothing when nothing was shown and nothing is', () => {
    const seen = vi.fn();
    const stop = onLinkStatusChange(seen);
    setHoveredLink(null);
    setFocusedLink(null);
    expect(seen).not.toHaveBeenCalled();

    setFocusedLink(inert);
    setFocusedLink({ kind: 'inert', text: './b.md' });
    expect(seen).toHaveBeenCalledTimes(1);
    setFocusedLink(web);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(readLinkStatus()).toBe(web);
    stop();
  });

  it('clears when only one half holds a link', () => {
    for (const set of [setHoveredLink, setFocusedLink]) {
      const seen = vi.fn();
      const stop = onLinkStatusChange(seen);
      set(web);
      seen.mockClear();
      clearLinkStatus();
      expect(seen).toHaveBeenCalledTimes(1);
      expect(readLinkStatus()).toBeNull();
      stop();
    }
  });

  it('clears both halves at once, and says nothing when there was nothing to clear', () => {
    const seen = vi.fn();
    const stop = onLinkStatusChange(seen);
    setHoveredLink(web);
    setFocusedLink(inert);
    seen.mockClear();
    clearLinkStatus();
    expect(readLinkStatus()).toBeNull();
    expect(seen).toHaveBeenCalledTimes(1);
    clearLinkStatus();
    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });
});
