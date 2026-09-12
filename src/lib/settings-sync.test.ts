import { describe, expect, it, vi } from 'vitest';
import { changeToApply, type SettingBroadcast, type Stamp, supersedes } from './settings-sync';

// The module reaches Tauri only from `broadcastSetting`, `onSettingChange` and
// `snapshotStillCurrent`; the ordering under test touches none of them, so the
// APIs are stubbed just far enough for the import to resolve under Node.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ label: 'w1' }),
}));

function broadcast(stamp: Stamp): SettingBroadcast {
  return { stamp, change: { key: 'theme', value: 'dracula' } };
}

describe('supersedes', () => {
  it('accepts anything when the key has no value yet', () => {
    expect(supersedes({ at: 1, origin: 'w2' }, undefined)).toBe(true);
  });

  it('orders by time first', () => {
    expect(supersedes({ at: 2, origin: 'w2' }, { at: 1, origin: 'w9' })).toBe(true);
    expect(supersedes({ at: 1, origin: 'w9' }, { at: 2, origin: 'w2' })).toBe(false);
  });

  it('breaks a tie the same way in every window', () => {
    const a: Stamp = { at: 5, origin: 'w1' };
    const b: Stamp = { at: 5, origin: 'w2' };
    // Whichever window asks, `w2` is the winner — the property convergence
    // rests on. Resolved one way here and the other way there, the two windows
    // would settle on different values and stay there.
    expect(supersedes(b, a)).toBe(true);
    expect(supersedes(a, b)).toBe(false);
  });

  it('declines an identical stamp, which is a window meeting its own broadcast', () => {
    const own: Stamp = { at: 7, origin: 'w1' };
    expect(supersedes(own, own)).toBe(false);
  });
});

describe('changeToApply', () => {
  it('hands on a change newer than anything applied', () => {
    expect(changeToApply(broadcast({ at: 2, origin: 'w2' }), { at: 1, origin: 'w1' })).toEqual({
      key: 'theme',
      value: 'dracula',
    });
  });

  it('withholds a window its own change, so it cannot fight its own update', () => {
    const own: Stamp = { at: 3, origin: 'w1' };
    expect(changeToApply(broadcast(own), own)).toBeNull();
  });

  it('withholds a change overtaken by a newer one', () => {
    // The interleaving this exists for: w1 changed the theme last, and w2's
    // earlier change arrives afterwards. Applying it would leave w1 on the older
    // value while every other window finished on w1's.
    expect(changeToApply(broadcast({ at: 4, origin: 'w2' }), { at: 9, origin: 'w1' })).toBeNull();
  });

  it('compares the whole label rather than a prefix of it', () => {
    // `w1` and `w11` are both live labels once eleven windows have been opened.
    expect(changeToApply(broadcast({ at: 5, origin: 'w11' }), { at: 5, origin: 'w1' })).not.toBeNull();
  });
});
