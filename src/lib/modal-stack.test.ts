import { describe, expect, it } from 'vitest';
import { keyboardOwner } from './modal-stack';

describe('keyboardOwner', () => {
  it('is nobody when nothing is open', () => {
    expect(keyboardOwner([])).toBeUndefined();
  });

  it('is the innermost modal when none is covered', () => {
    const settings = { covered: false };
    const update = { covered: false };
    expect(keyboardOwner([settings, update])).toBe(update);
  });

  it('skips a covered modal that mounted last', () => {
    const update = { covered: false };
    const settings = { covered: true };
    expect(keyboardOwner([update, settings])).toBe(update);
  });

  it('skips a covered modal that mounted first', () => {
    const settings = { covered: true };
    const update = { covered: false };
    expect(keyboardOwner([settings, update])).toBe(update);
  });
});
