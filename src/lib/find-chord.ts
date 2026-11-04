/** Find's three chords: `CmdOrCtrl+F` opens the bar, and Find Next / Find
 *  Previous follow each platform's own keys — `Cmd+G` / `Cmd+Shift+G` on macOS,
 *  `F3` / `Shift+F3` on Windows and Linux (TASK-47). The menu items carry the same
 *  accelerators.
 *
 *  **All three are consumed in every view, including the ones without find**, on
 *  `lib/chord`'s rule — and on Windows that is measured rather than precautionary:
 *  with nothing consuming it, `Ctrl+F` opened WebView2's own find bar (TASK-46).
 *  `F3` is that bar's Find Next in every Chromium, so it is consumed for the same
 *  reason. **The menu accelerators are not relied on**, because they do not
 *  arrive at a WebView2-focused window (`lib/close-window`).
 *
 *  The gate is a function for the reason `createChordHandler`'s is: the handlers
 *  outlive every view. */
import { type ChordEvent, createChordHandler, type HandledChordEvent } from './chord';
import type { FindDirection } from './find';

/** `CmdOrCtrl+F`, as the native menu layer resolves it. */
export const FIND_CHORD_KEY = 'f';

export function createFindChordHandler(deps: {
  onMac: boolean;
  isAllowed: () => boolean;
  open: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({ key: FIND_CHORD_KEY, onMac: deps.onMac, isAllowed: deps.isAllowed, act: deps.open });
}

/** Which way a keystroke steps through the matches, or `null` for any other one.
 *  Shift is the direction, so unlike `matchesCmdOrCtrl` it is not refused. */
export function findStepDirection(event: ChordEvent, onMac: boolean): FindDirection | null {
  const direction: FindDirection = event.shiftKey ? 'previous' : 'next';
  if (onMac) {
    return event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'g' ? direction : null;
  }
  return !event.metaKey && !event.ctrlKey && !event.altKey && event.key === 'F3' ? direction : null;
}

export function createFindStepChordHandler(deps: {
  onMac: boolean;
  isAllowed: () => boolean;
  step: (direction: FindDirection) => void;
}): (event: HandledChordEvent) => void {
  return (event) => {
    const direction = findStepDirection(event, deps.onMac);
    if (direction === null) {
      return;
    }
    event.preventDefault();
    if (deps.isAllowed()) {
      deps.step(direction);
    }
  };
}
