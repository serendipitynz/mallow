/** What the print chord does, and where the app remembers whether it may.
 *
 *  **The chord has to be handled even when printing is not allowed**, which is
 *  the opposite of what decision-13's "a view that cannot be printed registers
 *  no entry" implied. Measured on Windows 2026-09-07: with a `.csv` open —
 *  a table view, not a markdown preview — `Ctrl+P` opened WebView2's print
 *  preview and offered to print the table. Nothing in mallow ran. **WebView2
 *  carries its own `Ctrl+P`**, so a view that registers no handler does not
 *  make the chord inert; it hands the chord to the platform, which prints
 *  whatever is on screen.
 *
 *  So the handler is registered once, for the life of the app, and always calls
 *  `preventDefault`. Whether it goes on to print is a separate question, which
 *  is why `printChordAction` answers with three outcomes rather than a boolean:
 *  **`suppress` is the case the earlier design had no name for.**
 *
 *  This also closes the chord on Linux, where reaching the platform's print
 *  path costs the user their session (decision-13) and where `print_window`
 *  refusing in Rust would not have helped — a native binding never goes through
 *  `print_window`. Whether WebKitGTK has one is unmeasured; suppressing the
 *  chord means it does not matter.
 */
import { type ChordEvent, matchesCmdOrCtrl } from './chord';

/** Whether a markdown preview — the one printable view (decision-13) — is on
 *  screen. Module state rather than React state on purpose: the one reader is a
 *  `keydown` handler outside the tree, and threading a boolean through `Viewer`
 *  to reach it would put the condition in three files instead of one. */
let printablePreview = false;

/** Called by the printable view as it mounts and unmounts. */
export function setPrintablePreview(printable: boolean): void {
  printablePreview = printable;
}

export function isPrintablePreview(): boolean {
  return printablePreview;
}

/** `print` — invoke the print call. `suppress` — swallow the chord so the
 *  platform's own binding cannot act on it. `ignore` — not the print chord,
 *  leave it alone. */
export type PrintChordAction = 'print' | 'suppress' | 'ignore';

export function printChordAction(event: ChordEvent, onMac: boolean, printable: boolean): PrintChordAction {
  if (!matchesCmdOrCtrl(event, 'p', onMac)) {
    return 'ignore';
  }
  return printable ? 'print' : 'suppress';
}

/** The part of a `KeyboardEvent` the handler needs. A real one satisfies it, so
 *  `addEventListener('keydown', …)` takes the handler as-is; an object literal
 *  satisfies it too, which is what lets the wiring be tested under Node. */
export interface PrintChordEvent extends ChordEvent {
  preventDefault(): void;
}

/** The `keydown` handler itself, built rather than inlined so that **what it does
 *  with the event is covered and not just how it classifies one**.
 *
 *  That distinction is the whole reason this exists: the classifier can be
 *  perfectly right while the handler forgets to call `preventDefault`, and the
 *  bug this module was written for was exactly a chord that reached the platform.
 *  A test that only asserts `suppress` would stay green through that.
 *
 *  `isPrintable` is a function rather than a boolean because the handler outlives
 *  every view: it is registered once and has to read the flag at the moment the
 *  key is pressed, not at the moment it was built.
 *
 *  **What this does not cover is the `addEventListener` call itself.** The suite
 *  runs under Node with no DOM by design, so nothing here can dispatch a real
 *  `keydown`; that one line in `App` is held by review.
 */
export function createPrintChordHandler(deps: {
  onMac: boolean;
  isPrintable: () => boolean;
  print: () => void;
}): (event: PrintChordEvent) => void {
  return (event) => {
    const action = printChordAction(event, deps.onMac, deps.isPrintable());
    if (action === 'ignore') {
      return;
    }
    event.preventDefault();
    if (action === 'print') {
      deps.print();
    }
  };
}
