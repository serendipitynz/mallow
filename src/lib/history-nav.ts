/** Back and forward through the visit history: which keystroke and which mouse
 *  button mean which, and the handlers that consume them (TASK-44).
 *
 *  **The chords follow each platform's browser rather than `CmdOrCtrl`**:
 *  `Cmd+[` / `Cmd+]` on macOS (Safari, Finder) and `Alt+Left` / `Alt+Right` on
 *  Windows and Linux. The menu items carry the same accelerators.
 *
 *  **Both chords are consumed even where there is nowhere to go**, on the rule
 *  `lib/chord` holds — and here it is the reason the handler exists at all on
 *  Windows: `Alt+Left` is WebView2's own back navigation, and the app shell is a
 *  page it would navigate. Whether that navigation would do harm with the shell's
 *  history empty is not measured; consuming the chord makes the question moot,
 *  as it did for `Ctrl+P`. There is no gate, because a move with nowhere to go is
 *  already nothing (`travel` answers `null`).
 *
 *  **A keystroke or a click inside the rendered HTML frame never reaches these
 *  handlers**: they are registered on the app's window, and the frame is a
 *  document of its own. That gap is the one every app chord already has. */
import type { ChordEvent, HandledChordEvent } from './chord';
import type { Direction } from './visit-history';

export function historyChordDirection(event: ChordEvent, onMac: boolean): Direction | null {
  if (event.shiftKey) {
    return null;
  }
  if (onMac) {
    if (!event.metaKey || event.ctrlKey || event.altKey) {
      return null;
    }
    return event.key === '[' ? 'back' : event.key === ']' ? 'forward' : null;
  }
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  return event.key === 'ArrowLeft' ? 'back' : event.key === 'ArrowRight' ? 'forward' : null;
}

export function createHistoryChordHandler(deps: {
  onMac: boolean;
  go: (direction: Direction) => void;
}): (event: HandledChordEvent) => void {
  return (event) => {
    const direction = historyChordDirection(event, deps.onMac);
    if (direction === null) {
      return;
    }
    event.preventDefault();
    deps.go(direction);
  };
}

/** `MouseEvent.button` for the side buttons: 3 is back and 4 is forward in the
 *  DOM's event model. **On macOS this handler did not move the history** (measured
 *  2026-10-30, Logitech MX Anywhere 3S), so `side_buttons.rs` takes the buttons
 *  natively there and consumes them before the page could see one; whether
 *  WebView2 and WebKitGTK deliver them is not measured. */
export function historyButtonDirection(button: number): Direction | null {
  return button === 3 ? 'back' : button === 4 ? 'forward' : null;
}

/** The part of a `MouseEvent` the handler needs, so a test writes a literal. */
export interface HandledButtonEvent {
  type: string;
  button: number;
  preventDefault(): void;
}

/** One handler for `mousedown` and `mouseup`. **Both are consumed and only the
 *  release acts**: an engine that runs its own back navigation does it on one of
 *  the two, and which one is not measured, so both are taken from it — while
 *  acting on both would move two steps per click. */
export function createHistoryButtonHandler(go: (direction: Direction) => void): (event: HandledButtonEvent) => void {
  return (event) => {
    const direction = historyButtonDirection(event.button);
    if (direction === null) {
      return;
    }
    event.preventDefault();
    if (event.type === 'mouseup') {
      go(direction);
    }
  };
}
