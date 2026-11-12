import { describe, expect, it } from 'vitest';
import { clampSlide, type SlideKeyEvent, slideStepForKey, stepSlide } from './slide-nav';

const key = (k: string, over: Partial<SlideKeyEvent> = {}): SlideKeyEvent => ({
  key: k,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...over,
});

describe('slideStepForKey', () => {
  it('moves forward on the right and down arrows, Page Down and Space', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) {
      expect(slideStepForKey(key(k))).toBe('next');
    }
  });

  it('moves back on the left and up arrows, Page Up and Shift+Space', () => {
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp']) {
      expect(slideStepForKey(key(k))).toBe('previous');
    }
    expect(slideStepForKey(key(' ', { shiftKey: true }))).toBe('previous');
  });

  it('goes to the ends on Home and End', () => {
    expect(slideStepForKey(key('Home'))).toBe('first');
    expect(slideStepForKey(key('End'))).toBe('last');
  });

  it('leaves a key held with Cmd, Ctrl or Alt to the chords, and other keys alone', () => {
    expect(slideStepForKey(key('ArrowRight', { metaKey: true }))).toBeNull();
    expect(slideStepForKey(key('ArrowLeft', { ctrlKey: true }))).toBeNull();
    expect(slideStepForKey(key('Home', { altKey: true }))).toBeNull();
    expect(slideStepForKey(key('Enter'))).toBeNull();
    expect(slideStepForKey(key('a'))).toBeNull();
  });
});

describe('stepSlide', () => {
  it('steps one at a time and holds at both ends rather than wrapping', () => {
    expect(stepSlide(0, 3, 'next')).toBe(1);
    expect(stepSlide(2, 3, 'next')).toBe(2);
    expect(stepSlide(1, 3, 'previous')).toBe(0);
    expect(stepSlide(0, 3, 'previous')).toBe(0);
  });

  it('jumps to the first and the last slide', () => {
    expect(stepSlide(1, 5, 'first')).toBe(0);
    expect(stepSlide(1, 5, 'last')).toBe(4);
  });

  it('stays at 0 in a deck with no slides', () => {
    expect(stepSlide(0, 0, 'last')).toBe(0);
  });
});

describe('clampSlide', () => {
  it('keeps an index inside a deck that shrank, and refuses a nonsense one', () => {
    expect(clampSlide(7, 3)).toBe(2);
    expect(clampSlide(1, 3)).toBe(1);
    expect(clampSlide(-1, 3)).toBe(0);
    expect(clampSlide(Number.NaN, 3)).toBe(0);
    expect(clampSlide(2, 0)).toBe(0);
  });
});
