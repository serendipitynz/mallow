/** What a window opens at mount, given what it was told at creation and what the
 *  stored session remembers.
 *
 *  **A window created empty is not a window nothing created**, and reading them as
 *  one costs New Window its whole specification: an empty window that reported
 *  "nothing was deposited" would fall through to the session and open a duplicate
 *  of the last folder — which is precisely what New Window exists not to do, since
 *  a window opened to compare against something is opened on a different folder.
 *  So `open_window` answers a `WindowInit` for a window it created, `null` for one
 *  it did not, and only the second consults the session.
 *
 *  Split from `App` because that is where the mistake was: the branch is the whole
 *  behaviour, and inside a mount effect nothing can reach it. */
import type { InitialLocation, WindowInit } from './types';

/** The stored-session half, narrowed to the two keys this reads. */
export interface SessionLocation {
  lastFolder?: string;
  lastFile?: string;
}

export function locationToOpenAtMount(init: WindowInit | null, session: SessionLocation): InitialLocation | null {
  if (init) {
    return init.location;
  }
  return session.lastFolder ? { folder: session.lastFolder, file: session.lastFile ?? null } : null;
}
