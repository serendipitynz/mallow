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
 *  than a general accelerator problem.
 *
 *  **Measured 2026-09-12 on Linux with two windows open: each press produced one
 *  action and no duplicate was seen** — one `Ctrl+N` opened one window, one
 *  `Ctrl+W` closed one. **That is the observation, not a count of handlers**, and
 *  the two halves are not equally strong. `Ctrl+N` is: a second window would have
 *  been unmistakable and nothing dedupes a creation. `Ctrl+W` is weaker, because
 *  `close()` is asynchronous IPC — both routes could ask, resolve the same window
 *  and still show one close. **Which layer or layers act is unmeasured.**
 *
 *  Two windows is what made it a test at all, and the reason survives the benign
 *  answer: **a duplicate here need not land on one window.** This handler closes
 *  *this* window, while the menu route resolves its target from `focused_window`
 *  when the queued menu event is delivered (tauri-2.11.3 `src/app.rs:2350-2351`,
 *  delivered at `:2588`) — so a doubled press could resolve this window twice, or
 *  take this one and then whichever one focus moved to. **Neither ordering was
 *  instrumented**, and a single-window round cannot show the second outcome at
 *  all.
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
