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
