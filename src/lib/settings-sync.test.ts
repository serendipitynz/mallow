import { describe, expect, it, vi } from 'vitest';
import { changeFromOtherWindow, type SettingBroadcast } from './settings-sync';

// The module reaches Tauri only from `broadcastSetting` and `onSettingChange`;
// the guard under test touches neither, so the APIs are stubbed just far enough
// for the import to resolve under Node.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ label: 'w1' }),
}));

function broadcast(origin: string): SettingBroadcast {
  return { origin, change: { key: 'theme', value: 'dracula' } };
}

describe('changeFromOtherWindow', () => {
  it('hands on a change another window made', () => {
    expect(changeFromOtherWindow(broadcast('w2'), 'w1')).toEqual({ key: 'theme', value: 'dracula' });
  });

  it('withholds a window its own change, so it cannot fight its own update', () => {
    expect(changeFromOtherWindow(broadcast('w1'), 'w1')).toBeNull();
  });

  it('compares the whole label rather than a prefix of it', () => {
    // `w1` and `w11` are both live labels once eleven windows have been opened.
    expect(changeFromOtherWindow(broadcast('w11'), 'w1')).not.toBeNull();
  });
});
