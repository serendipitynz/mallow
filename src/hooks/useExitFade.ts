import { type AnimationEvent, useState } from 'react';

/** Keeps the last value on screen while it fades out, so a notice leaves the way
 *  it came in rather than vanishing (snz-design doc-9 §6.4). `leaving` is true
 *  from the moment `value` goes to null until the animation named
 *  `exitAnimation` ends; a new value arriving meanwhile replaces the leaving one. */
export function useExitFade<T>(value: T | null, exitAnimation: string) {
  const [shown, setShown] = useState<T | null>(value);
  if (value !== null && value !== shown) {
    setShown(value);
  }
  const leaving = value === null && shown !== null;
  const onAnimationEnd = (e: AnimationEvent) => {
    if (leaving && e.animationName === exitAnimation) {
      setShown(null);
    }
  };
  return { shown: value ?? shown, leaving, onAnimationEnd };
}
