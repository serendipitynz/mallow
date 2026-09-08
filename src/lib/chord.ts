/** Keyboard-accelerator matching for the shortcuts the app binds itself.
 *
 *  Split from the components so the matching is unit-testable without a DOM:
 *  `matchesCmdOrCtrl` takes the platform as an argument and reads only the five
 *  fields it needs, so a test writes an object literal. */

/** The subset of `KeyboardEvent` an accelerator is decided from. */
export interface ChordEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Whether the platform's primary accelerator modifier is Command.
 *
 *  `navigator.platform` is deprecated but is what the WebViews here answer;
 *  `OpenWith` already picks its file-manager label the same way. */
export function onMacPlatform(): boolean {
  return navigator.platform.toLowerCase().includes('mac');
}

/** Whether `event` is `CmdOrCtrl+<key>` as the native menu layer resolves it:
 *  Command on macOS and Control everywhere else — **not either modifier on
 *  either platform**. Accepting both would bind chords no menu item can carry,
 *  and on macOS `Ctrl+P` is the emacs-style "previous line" the WebView gives
 *  text fields, which this would take over and `preventDefault` away.
 *
 *  `shift` and `alt` must be absent, so a chord the app has not bound stays
 *  free for one that is. `key` is compared case-insensitively, because caps
 *  lock reports the upper-case letter with `shiftKey` false. */
export function matchesCmdOrCtrl(event: ChordEvent, key: string, onMac: boolean): boolean {
  const primary = onMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return primary && !event.shiftKey && !event.altKey && event.key.toLowerCase() === key.toLowerCase();
}

/** What a chord the app binds does with one keystroke.
 *
 *  `act` — run it. `suppress` — consume the keystroke and do nothing. `ignore` —
 *  not this chord, leave it alone.
 *
 *  **`suppress` is the case a boolean cannot express, and it is the one that was
 *  missing.** Measured on Windows 2026-09-07: the print handler lived inside the
 *  printable view, so a `.csv` on screen registered nothing — and `Ctrl+P` opened
 *  WebView2's own print preview and offered to print the table. **Registering no
 *  handler does not make a chord inert; it concedes the chord to the platform.**
 *  So a chord the app binds is registered once for the life of the app and always
 *  consumed, and whether it goes on to act is a separate question. */
export type ChordAction = 'act' | 'suppress' | 'ignore';

export function chordAction(event: ChordEvent, key: string, onMac: boolean, allowed: boolean): ChordAction {
  if (!matchesCmdOrCtrl(event, key, onMac)) {
    return 'ignore';
  }
  return allowed ? 'act' : 'suppress';
}

/** The part of a `KeyboardEvent` a handler needs. A real one satisfies it, so
 *  `addEventListener('keydown', …)` takes the handler as-is; an object literal
 *  satisfies it too, which is what lets the wiring be tested under Node. */
export interface HandledChordEvent extends ChordEvent {
  preventDefault(): void;
}

/** The `keydown` handler itself, built rather than inlined so that **what it does
 *  with the event is covered and not only how it classifies one**.
 *
 *  That distinction is the whole reason this is a factory: the classification can
 *  be perfectly right while the handler forgets `preventDefault`, and a chord
 *  reaching the platform is exactly the bug this shape exists for. A test that
 *  only asserted `suppress` would stay green through it.
 *
 *  `isAllowed` is a function rather than a boolean because the handler outlives
 *  every view: it has to read the condition when the key is pressed, not when it
 *  was built. */
export function createChordHandler(deps: {
  key: string;
  onMac: boolean;
  isAllowed: () => boolean;
  act: () => void;
}): (event: HandledChordEvent) => void {
  return (event) => {
    const action = chordAction(event, deps.key, deps.onMac, deps.isAllowed());
    if (action === 'ignore') {
      return;
    }
    event.preventDefault();
    if (action === 'act') {
      deps.act();
    }
  };
}
