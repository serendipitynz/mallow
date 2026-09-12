/** Close Window's chord: the key, why it has no gate, and why it exists at all
 *  when the menu item already carries the same accelerator.
 *
 *  **Measured on Windows 2026-09-12: the menu accelerator alone did not close a
 *  window.** `Ctrl+W` reached nothing while the menu item itself worked, and the
 *  three chords that did work — `Ctrl+N`, `Ctrl+P`, `Ctrl+E` — are exactly the
 *  ones `App` also registers a `keydown` handler for. So muda's accelerator does
 *  not reach a WebView2-focused window there, and Close Window was the one entry
 *  relying on it. Whether WebView2 consumes `Ctrl+W` itself (browsers close a tab
 *  with it) or the accelerator table is simply never consulted is **not
 *  measured**, and consuming the chord here makes it moot — the same conclusion
 *  `Ctrl+P` forced in `lib/print`: registering no handler does not make a chord
 *  inert, it concedes it to the platform.
 *
 *  **The same round measured Linux, and there the accelerator does arrive**:
 *  `Ctrl+W` closed a window before this module existed. So the gap is WebView2's
 *  rather than muda's, which is what makes it the same shape as `Ctrl+P` rather
 *  than a general accelerator problem — and it means this handler is a second
 *  route on Linux, not the only one. Closing twice is the one duplicate that
 *  costs nothing, so nothing here has to decide which of the two wins.
 *
 *  **No gate, for New Window's reason**: closing depends on nothing that is
 *  currently displayed, so `chordAction` never reaches its `suppress` case here.
 *
 *  **On macOS this handler does not fire**, and that is not a redundancy to
 *  remove: the menu's predefined `close_window` item takes the key equivalent
 *  before the WebView sees it. It is what the other two platforms need, where the
 *  item is an ordinary one.
 *
 *  **decision-4 moves `CmdOrCtrl+W` to Close Tab when TASK-13.3 lands**, with
 *  Close Window on `CmdOrCtrl+Shift+W`. This module is one of the two places that
 *  changes; `menu.rs` is the other. */
import { createChordHandler, type HandledChordEvent } from './chord';

/** `CmdOrCtrl+W`, as the native menu layer resolves it. */
export const CLOSE_WINDOW_CHORD_KEY = 'w';

export function createCloseWindowChordHandler(deps: {
  onMac: boolean;
  closeWindow: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({
    key: CLOSE_WINDOW_CHORD_KEY,
    onMac: deps.onMac,
    isAllowed: () => true,
    act: deps.closeWindow,
  });
}
