/** Where a key moves a deck's slide, in the Slides view and while presenting
 *  alike (TASK-51.2). Pure, so the keys are tested without a DOM. */

export type SlideStep = 'next' | 'previous' | 'first' | 'last';

/** The subset of a `KeyboardEvent` a slide step is decided from. */
export interface SlideKeyEvent {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/** The step a key asks for, or `null` for one that is not a slide key. A key
 *  held with Cmd, Ctrl or Alt is left to whatever binds that chord; Shift
 *  matters only to Space, where it turns the step around. */
export function slideStepForKey(event: SlideKeyEvent): SlideStep | null {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return 'previous';
    case ' ':
      return event.shiftKey ? 'previous' : 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/** The slide a step lands on. The ends hold rather than wrap: a presenter
 *  pressing once too often should stay on the last slide, not reach the title. */
export function stepSlide(index: number, count: number, step: SlideStep): number {
  if (count <= 0) {
    return 0;
  }
  switch (step) {
    case 'next':
      return Math.min(index + 1, count - 1);
    case 'previous':
      return Math.max(index - 1, 0);
    case 'first':
      return 0;
    case 'last':
      return count - 1;
  }
}

/** A remembered or current index held inside a deck that may have changed
 *  length since — a live reload can drop slides from under the reader. */
export function clampSlide(index: number, count: number): number {
  if (count <= 0 || !Number.isInteger(index) || index < 0) {
    return 0;
  }
  return Math.min(index, count - 1);
}
