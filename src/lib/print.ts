/** Printing's chord: the key, the gate, and the reason for each.
 *
 *  **The chord is handled even when printing is not allowed**, which is the
 *  opposite of what decision-13's "a view that cannot be printed registers no
 *  entry" implied. Measured on Windows 2026-09-07: with a `.csv` open — a table
 *  view, not a markdown preview — `Ctrl+P` opened WebView2's print preview and
 *  offered to print the table. Nothing in mallow ran. **WebView2 carries its own
 *  `Ctrl+P`**, so a view that registers no handler does not make the chord inert;
 *  it hands the chord to the platform, which prints whatever is on screen. That
 *  rule and its three outcomes now live in `lib/chord`, where the PDF export
 *  chord reads them too.
 *
 *  This also closes the chord on Linux, where reaching the platform's print path
 *  costs the user their session (decision-13) and where `print_window` refusing in
 *  Rust would not have helped — a native binding never goes through
 *  `print_window`. Whether WebKitGTK has one is unmeasured; suppressing the chord
 *  means it does not matter.
 *
 *  **Printing is gated because the body worth printing is the rendered markdown**,
 *  and because being able to name the mechanism that puts a view out of scope was
 *  a requirement (decision-13). PDF export's identical gate has its own reason —
 *  see `lib/pdf-export`.
 */
import { createChordHandler, type HandledChordEvent } from './chord';
import { isMarkdownPreviewActive } from './markdown-preview';

/** `CmdOrCtrl+P`, as the native menu layer resolves it. */
export const PRINT_CHORD_KEY = 'p';

export function createPrintChordHandler(deps: {
  onMac: boolean;
  print: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({
    key: PRINT_CHORD_KEY,
    onMac: deps.onMac,
    isAllowed: isMarkdownPreviewActive,
    act: deps.print,
  });
}
