import { describe, expect, it } from 'vitest';
import { resolveDefaultTheme } from './slide-themes';

describe('resolveDefaultTheme', () => {
  it("is mallow's slide theme when nothing is stored", () => {
    expect(resolveDefaultTheme(undefined, ['paper'])).toEqual({ name: 'default', missing: null });
    expect(resolveDefaultTheme(null, [])).toEqual({ name: 'default', missing: null });
    expect(resolveDefaultTheme('default', [])).toEqual({ name: 'default', missing: null });
  });

  it('is the stored theme when it is held', () => {
    expect(resolveDefaultTheme('paper', ['paper'])).toEqual({ name: 'paper', missing: null });
  });

  it('holds the bundled kinari whatever the folder gave', () => {
    expect(resolveDefaultTheme('kinari', [])).toEqual({ name: 'kinari', missing: null });
  });

  it("draws mallow's slide theme for a name no longer held, and keeps the name as missing", () => {
    expect(resolveDefaultTheme('paper', [])).toEqual({ name: 'default', missing: 'paper' });
  });
});
