import { describe, expect, it } from 'vitest';
import {
  isLaserToggleKey,
  LONG_TRAIL_LIFETIME_MS,
  liveTrail,
  TRAIL_LIFETIME_MS,
  trailPoint,
  trailSegments,
  trailStrength,
} from './laser';
import type { SlideKeyEvent } from './slide-nav';

const key = (k: string, over: Partial<SlideKeyEvent> = {}): SlideKeyEvent => ({
  key: k,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...over,
});

describe('isLaserToggleKey', () => {
  it('takes L in either case, with or without Shift', () => {
    expect(isLaserToggleKey(key('l'))).toBe(true);
    expect(isLaserToggleKey(key('L'))).toBe(true);
    expect(isLaserToggleKey(key('L', { shiftKey: true }))).toBe(true);
  });

  it('leaves L held with Cmd, Ctrl or Alt to whatever binds that chord', () => {
    expect(isLaserToggleKey(key('l', { metaKey: true }))).toBe(false);
    expect(isLaserToggleKey(key('l', { ctrlKey: true }))).toBe(false);
    expect(isLaserToggleKey(key('l', { altKey: true }))).toBe(false);
  });

  it('ignores every other key, including the presentation and slide keys', () => {
    for (const k of ['f', 'Escape', ' ', 'ArrowRight', 'Home', 'k']) {
      expect(isLaserToggleKey(key(k))).toBe(false);
    }
  });
});

describe('trail', () => {
  it('lays a short point normally and a long one while Shift is held', () => {
    expect(trailPoint(1, 2, 0, false, 0).lifetime).toBe(TRAIL_LIFETIME_MS);
    expect(trailPoint(1, 2, 0, true, 0).lifetime).toBe(LONG_TRAIL_LIFETIME_MS);
    expect(LONG_TRAIL_LIFETIME_MS).toBeGreaterThanOrEqual(1000);
    expect(LONG_TRAIL_LIFETIME_MS).toBeLessThanOrEqual(1200);
  });

  it('fades a point from full strength to nothing over its lifetime', () => {
    const point = trailPoint(0, 0, 1000, false, 0);
    expect(trailStrength(point, 1000)).toBe(1);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS / 2)).toBeCloseTo(0.5);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS)).toBe(0);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS * 2)).toBe(0);
  });

  it('keeps only the living points, each by its own lifetime, in the order laid', () => {
    const long = trailPoint(0, 0, 0, true, 0);
    const short = trailPoint(1, 1, 100, false, 1);
    const later = trailPoint(2, 2, 500, false, 2);
    const points = [long, short, later];
    expect(liveTrail(points, 200)).toEqual([long, short, later]);
    // The short point laid after the long one goes first.
    expect(liveTrail(points, 450)).toEqual([long, later]);
    expect(liveTrail(points, 900)).toEqual([long]);
    expect(liveTrail(points, LONG_TRAIL_LIFETIME_MS)).toEqual([]);
  });

  it('draws a segment only between points laid one after the other', () => {
    // A Shift stroke, a short crossing, then a second Shift stroke.
    const first = [trailPoint(0, 0, 0, true, 0), trailPoint(10, 0, 10, true, 1)];
    const crossing = [trailPoint(50, 50, 20, false, 2), trailPoint(90, 90, 30, false, 3)];
    const second = [trailPoint(100, 100, 40, true, 4), trailPoint(110, 100, 50, true, 5)];
    const points = [...first, ...crossing, ...second];

    const whole = trailSegments(points, 60).map(({ from, to }) => [from.seq, to.seq]);
    expect(whole).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);

    // Once the crossing has expired the two strokes are side by side in the
    // list, and nothing may join the end of one to the start of the other.
    const afterCrossing = trailSegments(liveTrail(points, 400), 400).map(({ from, to }) => [from.seq, to.seq]);
    expect(afterCrossing).toEqual([
      [0, 1],
      [4, 5],
    ]);
  });

  it('gives a segment the strength of its newer end', () => {
    const [segment] = trailSegments([trailPoint(0, 0, 0, false, 7), trailPoint(1, 1, 100, false, 8)], 250);
    expect(segment.strength).toBeCloseTo(0.5);
  });
});
