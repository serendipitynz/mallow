import { describe, expect, it } from 'vitest';
import { drawnMode, modeAvailable, readChoice, type StoredColor } from './color-choice';

const stored = (s: Partial<StoredColor>): StoredColor => ({ legacy: null, family: null, mode: null, ...s });

describe('readChoice', () => {
  it.each([
    [null, 'standard', 'auto'],
    ['auto', 'standard', 'auto'],
    ['light', 'standard', 'light'],
    ['dark', 'standard', 'dark'],
    ['solarized-light', 'solarized', 'light'],
    ['solarized-dark', 'solarized', 'dark'],
    ['dracula', 'dracula', 'dark'],
    ['nord', 'nord', 'dark'],
  ])('reads the pre-split value %s as %s + %s', (legacy, family, mode) => {
    expect(readChoice(stored({ legacy }))).toEqual({ choice: { family, mode }, unrecognized: false });
  });

  it('draws an unknown pre-split value as the initial choice and says so', () => {
    expect(readChoice(stored({ legacy: 'bogus' }))).toEqual({
      choice: { family: 'standard', mode: 'auto' },
      unrecognized: true,
    });
  });

  it('does not read an inherited property name as a pre-split value', () => {
    expect(readChoice(stored({ legacy: 'toString' }))).toEqual({
      choice: { family: 'standard', mode: 'auto' },
      unrecognized: true,
    });
  });

  it('prefers the per-axis keys to the pre-split value', () => {
    expect(readChoice(stored({ legacy: 'dracula', family: 'solarized', mode: 'light' })).choice).toEqual({
      family: 'solarized',
      mode: 'light',
    });
  });

  it('reads an axis without its own key from the pre-split value, which is what was drawn', () => {
    expect(readChoice(stored({ legacy: 'solarized-dark', family: 'nord' })).choice).toEqual({
      family: 'nord',
      mode: 'dark',
    });
    expect(readChoice(stored({ legacy: 'nord', mode: 'light' })).choice).toEqual({ family: 'nord', mode: 'light' });
  });

  it('keeps a chosen axis over an unknown pre-split value', () => {
    expect(readChoice(stored({ legacy: 'bogus', family: 'solarized' })).choice).toEqual({
      family: 'solarized',
      mode: 'auto',
    });
    expect(readChoice(stored({ legacy: 'bogus', family: 'solarized', mode: 'dark' })).unrecognized).toBe(false);
  });

  it('keeps a carried-over pair the family cannot draw rather than treating it as unknown', () => {
    expect(readChoice(stored({ family: 'dracula', mode: 'auto' }))).toEqual({
      choice: { family: 'dracula', mode: 'auto' },
      unrecognized: false,
    });
  });

  it('draws the initial choice when either axis holds a value this version does not know', () => {
    expect(readChoice(stored({ family: 'catppuccin', mode: 'dark' }))).toEqual({
      choice: { family: 'standard', mode: 'auto' },
      unrecognized: true,
    });
    expect(readChoice(stored({ family: 'solarized', mode: 'dim' })).unrecognized).toBe(true);
  });
});

describe('drawnMode', () => {
  it('follows the OS only when the mode is auto', () => {
    expect(drawnMode({ family: 'standard', mode: 'auto' }, true)).toBe('dark');
    expect(drawnMode({ family: 'standard', mode: 'auto' }, false)).toBe('light');
    expect(drawnMode({ family: 'solarized', mode: 'light' }, true)).toBe('light');
  });

  it('draws the side a one-sided family carries whatever mode was carried over', () => {
    expect(drawnMode({ family: 'dracula', mode: 'light' }, false)).toBe('dark');
    expect(drawnMode({ family: 'nord', mode: 'auto' }, false)).toBe('dark');
  });
});

describe('modeAvailable', () => {
  it('offers every mode on a two-sided family and only the carried side on a one-sided one', () => {
    expect(['light', 'dark', 'auto'].map((m) => modeAvailable('standard', m as 'light'))).toEqual([true, true, true]);
    expect(['light', 'dark', 'auto'].map((m) => modeAvailable('nord', m as 'light'))).toEqual([false, true, false]);
  });
});
