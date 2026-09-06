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
