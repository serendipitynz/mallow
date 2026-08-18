/** Whether the document outline is open. One preference across the views that
 *  have one — a reader who closed it in a markdown document does not expect it
 *  back on the next HTML one. */

const OUTLINE_KEY = 'doc-outline:open';

export function readOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OUTLINE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeOutlineOpen(open: boolean): void {
  try {
    localStorage.setItem(OUTLINE_KEY, open ? '1' : '0');
  } catch {
    // Non-fatal: the toggle still works for this view.
  }
}
