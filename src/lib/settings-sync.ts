/**
 * App-wide propagation of a changed preference (TASK-12.8).
 *
 * Every preference in mallow is app-wide — TASK-12 puts per-window theme and
 * language out of scope — so a window that changes one has to change it for the
 * windows that are already open. The window that changes a setting reports it,
 * Rust re-emits it to every window (`src-tauri/src/settings.rs`, which is where
 * the comment on why a broadcast is correct here lives), and each window applies
 * it without persisting or re-reporting.
 *
 * **Not the `storage` event.** Each window is its own WebView, and cross-WebView
 * storage notification is not something to rely on across WKWebView, WebView2
 * and WebKitGTK. Tauri events are the mechanism that is actually app-wide.
 *
 * **The listener stays on the default `Any` target**, which is the opposite
 * decision from `lib/watch`'s and for the opposite reason: there is nothing to
 * narrow. `Any` is not what delivers a broadcast — an unfiltered `emit` reaches
 * every listener whatever its target — so what keeps the originating window out
 * is the stamp each change carries, read by `changeToApply`.
 *
 * **Changes are ordered by that stamp, and the ordering is what makes the
 * windows converge.** Without it two windows that change one preference close
 * together end on different values: each applies its own change locally and
 * then the other's, in whichever order the two events happen to arrive, so the
 * window that changed it last can finish on the older value. That is reachable
 * without any human precision, because a broadcast is not sent when the reader
 * clicks — the custom emoji folder is sent when its **load** finishes, which is
 * a directory scan away from the click. So every window records what it last
 * applied per key and ignores anything not newer.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Lang } from './i18n';
import type { Settings, WritableKey } from './settings';
import type { ThemeId } from './theme';

/** A store-backed preference and its new value, carrying `null` for a cleared
 *  one — `undefined` does not survive the JSON this crosses Rust as.
 *
 *  **Derived from `Settings` rather than listed a second time.** A key added
 *  there is a key this carries, which makes the switch that applies a change
 *  non-exhaustive until the new preference is handled — the alternative is a
 *  setting that broadcasts to windows that silently ignore it. */
type StoredChange = {
  [K in WritableKey]: { key: K; value: NonNullable<Settings[K]> | null };
}[WritableKey];

/** One changed preference. The two keys Rust owns in settings.json — `windows`
 *  and `recentFolders` — are absent from `WritableKey` because no window writes
 *  them; the three that follow live in localStorage rather than the store. */
export type SettingChange =
  | StoredChange
  | { key: 'theme'; value: ThemeId }
  | { key: 'lang'; value: Lang }
  | { key: 'outlineOpen'; value: boolean };

/** When a change was made and by which window.
 *
 *  `Date.now()` rather than a counter minted in Rust: the stamp has to exist
 *  before the window applies the change to itself, and a counter only comes back
 *  after a round trip. One system clock serves every window here, so the numbers
 *  are comparable across them — **a wall clock stepped backwards can misorder one
 *  change**, which the next change to that preference corrects, and which no
 *  counter reachable synchronously would avoid. */
export interface Stamp {
  /** Epoch milliseconds, taken by the window that made the change. */
  at: number;
  /** The window's label, stamped by Rust so that no window can claim another's. */
  origin: string;
}

/** What a window receives: the change and when it was made. */
export interface SettingBroadcast {
  stamp: Stamp;
  change: SettingChange;
}

const EVENT = 'settings:change';

/** What this window last applied for each preference. */
const applied = new Map<SettingChange['key'], Stamp>();

/** Whether `incoming` is newer than what a window has already applied.
 *
 *  **The label breaks a tie, arbitrarily but identically in every window**,
 *  which is the property convergence rests on: two changes stamped in the same
 *  millisecond must not be resolved one way here and the other way there.
 *
 *  An identical stamp does not supersede, which is how a window declines its own
 *  broadcast coming back — it recorded that stamp before it applied the change
 *  to itself, so there is nothing left to do with it. */
export function supersedes(incoming: Stamp, last: Stamp | undefined): boolean {
  if (!last) {
    return true;
  }
  if (incoming.at !== last.at) {
    return incoming.at > last.at;
  }
  return incoming.origin > last.origin;
}

/** The change to apply, or `null` when this window already holds something at
 *  least as new for that key. Kept out of the effect that listens so that it can
 *  be tested at all. */
export function changeToApply(broadcast: SettingBroadcast, last: Stamp | undefined): SettingChange | null {
  return supersedes(broadcast.stamp, last) ? broadcast.change : null;
}

/** Whether the stored value a read issued at `at` returned is still the newest
 *  thing this window knows for `key`, recording the read when it is.
 *
 *  A window applies its settings snapshot through this rather than straight,
 *  because the read is asynchronous: a change broadcast while it was in flight
 *  has already been applied, and the snapshot — taken before that change was
 *  written — would put the window back on the old value. Stamping the snapshot
 *  with the moment the read was *issued* is what makes it comparable, since
 *  anything written earlier than that is in the answer the read returns. */
export function snapshotStillCurrent(key: SettingChange['key'], at: number): boolean {
  return noteApplied(key, { at, origin: selfLabel() });
}

function selfLabel(): string {
  return getCurrentWebviewWindow().label;
}

/** Record a stamp as this window's newest for `key`, answering whether it was. */
function noteApplied(key: SettingChange['key'], stamp: Stamp): boolean {
  if (!supersedes(stamp, applied.get(key))) {
    return false;
  }
  applied.set(key, stamp);
  return true;
}

/** Tell every other window that a preference changed.
 *
 *  **The stamp is taken before anything is awaited**, because the caller has
 *  already applied the change to itself: a stamp minted after a round trip
 *  would leave this window unable to judge a change that arrives inside that
 *  trip, which is the divergence this ordering exists to close.
 *
 *  Fire-and-forget past that point — the change is applied and persisted here,
 *  so a failed emit costs the other windows a live update and nothing else. */
export function broadcastSetting(change: SettingChange): void {
  const at = Date.now();
  noteApplied(change.key, { at, origin: selfLabel() });
  void invoke('broadcast_setting', { change, at }).catch((e) => console.error('Failed to broadcast a setting', e));
}

/** Subscribe to preferences changed in another window. */
export function onSettingChange(apply: (change: SettingChange) => void): Promise<UnlistenFn> {
  return listen<SettingBroadcast>(EVENT, (event) => {
    const change = changeToApply(event.payload, applied.get(event.payload.change.key));
    if (change) {
      applied.set(change.key, event.payload.stamp);
      apply(change);
    }
  });
}
