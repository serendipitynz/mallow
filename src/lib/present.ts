/** Presenting a deck (TASK-51.2): the chords that start it, and the one
 *  presenter a window has — registered by the markdown view while it shows a
 *  deck, the way `lib/find-target` holds find's target.
 *
 *  `CmdOrCtrl+Enter` presents full-screen and `Shift+CmdOrCtrl+Enter` in the
 *  window. **Both are consumed in every view**, on `lib/chord`'s rule: no engine
 *  is known to bind them today, but registering nothing would concede them to
 *  whichever one starts to. */
import type { ChordEvent, HandledChordEvent } from './chord';

/** Where a presentation is shown: full-screen, or in the window as it is. */
export type PresentPlace = 'fullscreen' | 'window';

type Presenter = (place: PresentPlace) => void;

let presenter: Presenter | null = null;

/** Register the window's presenter, and answer the release. A release only
 *  clears the presenter it registered, so a view mounting before the previous
 *  one's cleanup has run keeps its registration. */
export function setPresenter(next: Presenter): () => void {
  presenter = next;
  return () => {
    if (presenter === next) {
      presenter = null;
    }
  };
}

export function isPresentAvailable(): boolean {
  return presenter !== null;
}

/** Which presentation a keystroke asks for, or `null` for any other one. */
export function presentChord(event: ChordEvent, onMac: boolean): PresentPlace | null {
  const primary = onMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!primary || event.altKey || event.key !== 'Enter') {
    return null;
  }
  return event.shiftKey ? 'window' : 'fullscreen';
}

/** The chord as a menu would print it, for the buttons' tooltips. */
export function presentChordLabel(place: PresentPlace, onMac: boolean): string {
  if (onMac) {
    return place === 'window' ? '⇧⌘↩' : '⌘↩';
  }
  return place === 'window' ? 'Ctrl+Shift+Enter' : 'Ctrl+Enter';
}

export function createPresentChordHandler(deps: {
  onMac: boolean;
  isAllowed: () => boolean;
}): (event: HandledChordEvent) => void {
  return (event) => {
    const place = presentChord(event, deps.onMac);
    if (place === null) {
      return;
    }
    event.preventDefault();
    if (deps.isAllowed()) {
      presenter?.(place);
    }
  };
}
