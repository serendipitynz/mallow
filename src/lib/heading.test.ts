import { describe, expect, it } from 'vitest';
import { offsetFromContainerTop } from './heading';

describe('offsetFromContainerTop', () => {
  it('subtracts the container top when the heading is in the app document', () => {
    expect(offsetFromContainerTop(220, 0, 100)).toBe(120);
  });

  it('lifts a rect taken inside a frame by the frame offset', () => {
    // The same heading, 120px down its own document, seen through a frame whose
    // own top sits 100px below the container's: 220px down the container.
    expect(offsetFromContainerTop(120, 200, 100)).toBe(220);
  });

  it('is negative for a heading scrolled above the container top', () => {
    expect(offsetFromContainerTop(-300, 200, 100)).toBe(-200);
  });

  it('takes a negative frame offset, which is what a partly scrolled-out frame reports', () => {
    expect(offsetFromContainerTop(900, -400, 100)).toBe(400);
  });

  it('moves by exactly the frame offset when only the frame moved', () => {
    // A notice bar appearing above the frame pushes it down without touching the
    // heading's position inside it: the anchor offset has to follow by the same amount.
    const before = offsetFromContainerTop(120, 200, 100);
    const after = offsetFromContainerTop(120, 236, 100);
    expect(after - before).toBe(36);
  });

  it('keeps sub-pixel rects, which is what the caller compares against a threshold', () => {
    expect(offsetFromContainerTop(120.5, 200.25, 100)).toBeCloseTo(220.75, 10);
  });
});
