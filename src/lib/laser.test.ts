import { describe, expect, it } from 'vitest';
import {
  isLaserToggleKey,
  LONG_TRAIL_LIFETIME_MS,
  liveTrail,
  TRAIL_LIFETIME_MS,
  trailPoint,
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
    expect(trailPoint(1, 2, 0, false).lifetime).toBe(TRAIL_LIFETIME_MS);
    expect(trailPoint(1, 2, 0, true).lifetime).toBe(LONG_TRAIL_LIFETIME_MS);
    expect(LONG_TRAIL_LIFETIME_MS).toBeGreaterThanOrEqual(1000);
    expect(LONG_TRAIL_LIFETIME_MS).toBeLessThanOrEqual(1200);
  });

  it('fades a point from full strength to nothing over its lifetime', () => {
    const point = trailPoint(0, 0, 1000, false);
    expect(trailStrength(point, 1000)).toBe(1);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS / 2)).toBeCloseTo(0.5);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS)).toBe(0);
    expect(trailStrength(point, 1000 + TRAIL_LIFETIME_MS * 2)).toBe(0);
  });

  it('keeps only the living points, each by its own lifetime, in the order laid', () => {
    const long = trailPoint(0, 0, 0, true);
    const short = trailPoint(1, 1, 100, false);
    const later = trailPoint(2, 2, 500, false);
    const points = [long, short, later];
    expect(liveTrail(points, 200)).toEqual([long, short, later]);
    // The short point laid after the long one goes first.
    expect(liveTrail(points, 450)).toEqual([long, later]);
    expect(liveTrail(points, 900)).toEqual([long]);
    expect(liveTrail(points, LONG_TRAIL_LIFETIME_MS)).toEqual([]);
  });
});
