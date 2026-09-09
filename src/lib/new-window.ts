/** New Window's chord: the key, and why it is unconditional.
 *
 *  **`CmdOrCtrl+N` is registered once for the life of the app and always
 *  consumed**, on the rule printing paid for and `lib/chord` holds: registering
 *  no handler does not make a chord inert, it concedes it to the platform, and a
 *  WebView engine that carries its own `Ctrl+N` would open a browser window over
 *  a viewer that has no address bar. Whether any of the three engines binds it is
 *  unmeasured, and consuming it means that never has to be answered.
 *
 *  **Unlike printing's and PDF export's, this chord has no gate.** Those two are
 *  disabled unless a markdown preview is on screen; a new window depends on
 *  nothing that is currently displayed, so `chordAction` never reaches its
 *  `suppress` case here. The three outcomes still run through `lib/chord` rather
 *  than being inlined, so what the handler does with the event is covered the way
 *  the other two entries' is.
 *
 *  The menu item this chord will sit beside is TASK-12.4's, on the same split
 *  TASK-30 took: the chord ships with the mechanism, the item with the menu. */
import { createChordHandler, type HandledChordEvent } from './chord';

/** `CmdOrCtrl+N`, as the native menu layer resolves it. */
export const NEW_WINDOW_CHORD_KEY = 'n';

export function createNewWindowChordHandler(deps: {
  onMac: boolean;
  newWindow: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({
    key: NEW_WINDOW_CHORD_KEY,
    onMac: deps.onMac,
    isAllowed: () => true,
    act: deps.newWindow,
  });
}
