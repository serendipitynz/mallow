/** What a window opens at mount, given what it was told at creation.
 *
 *  **Nothing falls back to the stored session any more.** Every window is created
 *  by `open_window` now — the configured window carries `"create": false` and the
 *  restore path creates the windows the last quit left behind — so a window that
 *  was given nowhere to open was *meant* to open nowhere, which is what New Window
 *  is. Consulting the session here would make an empty New Window open a duplicate
 *  of the last folder, the one thing it is specified not to do.
 *
 *  So `null` no longer means "ask the session": it means this window's entry has
 *  already been taken, which today is a WebView reload and nothing else. A
 *  reloaded window therefore comes back empty — the price of keeping filesystem
 *  paths out of the URL, recorded in `src-tauri/src/window.rs`.
 *
 *  Split from `App` because that is where the mistake was: the branch is the whole
 *  behaviour, and inside a mount effect nothing can reach it. */
import type { InitialLocation, WindowInit } from './types';

export function locationToOpenAtMount(init: WindowInit | null): InitialLocation | null {
  return init?.location ?? null;
}
