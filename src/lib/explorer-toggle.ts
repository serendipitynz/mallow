/** The explorer's show / hide chord: the key, and why it has no gate.
 *
 *  **`CmdOrCtrl+B`**, the chord VS Code gives its side bar, which is where a
 *  reader moving between the two will reach first. It is registered once for the
 *  life of the app and always consumed, on the rule `lib/chord` holds — and here
 *  that is not only defensive: inside a rendered HTML document's
 *  `contenteditable` the engines bind `CmdOrCtrl+B` to bold.
 *
 *  **No gate**, for New Window's reason: hiding or showing the explorer depends
 *  on nothing currently displayed — with no folder open, showing it is how the
 *  reader gets back to Open Folder and the recent folders.
 *
 *  The View menu's Toggle Explorer carries the same accelerator. On macOS the menu
 *  takes the key equivalent before the WebView sees it, and on Windows WebView2
 *  keeps a menu accelerator from arriving at all (`lib/close-window`), so this
 *  handler is what acts there. */
import { createChordHandler, type HandledChordEvent } from './chord';

/** `CmdOrCtrl+B`, as the native menu layer resolves it. */
export const TOGGLE_EXPLORER_CHORD_KEY = 'b';

export function createToggleExplorerChordHandler(deps: {
  onMac: boolean;
  toggleExplorer: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({
    key: TOGGLE_EXPLORER_CHORD_KEY,
    onMac: deps.onMac,
    isAllowed: () => true,
    act: deps.toggleExplorer,
  });
}
