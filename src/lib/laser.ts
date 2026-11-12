/** The presentation's laser pointer (TASK-51.3): the key that switches it, and
 *  the trail it leaves. Pure, so both are tested without a DOM or a clock. */
import type { SlideKeyEvent } from './slide-nav';

/** How long a trail point stays on screen, in ms. Shift held while moving
 *  leaves the long trail, for tracing a shape the audience should follow. */
export const TRAIL_LIFETIME_MS = 300;
export const LONG_TRAIL_LIFETIME_MS = 1100;

/** A point the pointer passed, in CSS pixels of the window. */
export interface TrailPoint {
  x: number;
  y: number;
  at: number;
  lifetime: number;
}

/** `L`, with or without Shift (Caps Lock or a held Shift reports `L`), and
 *  never with Cmd, Ctrl or Alt, which belong to whatever binds that chord. */
export function isLaserToggleKey(event: SlideKeyEvent): boolean {
  return event.key.toLowerCase() === 'l' && !event.metaKey && !event.ctrlKey && !event.altKey;
}

export function trailPoint(x: number, y: number, at: number, longTrail: boolean): TrailPoint {
  return { x, y, at, lifetime: longTrail ? LONG_TRAIL_LIFETIME_MS : TRAIL_LIFETIME_MS };
}

/** How much of a point's life is left at `now`: 1 as it is laid, 0 once spent. */
export function trailStrength(point: TrailPoint, now: number): number {
  const left = 1 - (now - point.at) / point.lifetime;
  return Math.min(1, Math.max(0, left));
}

/** The points still alive at `now`, in the order they were laid. Each point
 *  carries its own lifetime, so a short-trail point laid after a long-trail one
 *  can expire first; filtering rather than trimming the front keeps both right. */
export function liveTrail(points: readonly TrailPoint[], now: number): TrailPoint[] {
  return points.filter((point) => trailStrength(point, now) > 0);
}
