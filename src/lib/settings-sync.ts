/**
 * App-wide propagation of a changed preference (TASK-12.8), ordered by one
 * authority in Rust (TASK-33).
 *
 * Every preference in mallow is app-wide — TASK-12 puts per-window theme and
 * language out of scope — so a window that changes one has to change it for the
 * windows that are already open. The window that changes a setting applies it,
 * stamps it and commits it; Rust gives the change its place in the order, writes
 * it to settings.json if the store is what holds it, and re-emits it to every
 * window (`src-tauri/src/settings.rs`, which is where the comment on why a
 * broadcast is correct here lives); each window applies what it receives without
 * persisting or re-committing.
 *
 * **Not the `storage` event.** Each window is its own WebView, and cross-WebView
 * storage notification is not something to rely on across WKWebView, WebView2
 * and WebKitGTK. Tauri events are the mechanism that is actually app-wide.
 *
 * **The listener stays on the default `Any` target**, which is the opposite
 * decision from `lib/watch`'s and for the opposite reason: there is nothing to
 * narrow. `Any` is not what delivers a broadcast — an unfiltered `emit` reaches
 * every listener whatever its target — so what keeps a window from fighting its
 * own update is the stamp each change carries, read by `changeToApply`.
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
 *
 * **What a window mints is a request, and Rust is what answers it.** A window
 * can only order what it has seen, which leaves two things it cannot do alone:
 * keep a mark for changes made before it opened (so a window opened after the
 * wall clock stepped backwards mints below every window that lived through the
 * step, and is refused by all of them), and make its store write join the order
 * at all. Rust holds the high-water mark for the process and raises a stamp that
 * arrives below it, so the stamp a window records here is provisional — its own
 * broadcast comes back carrying the stamp the change actually got, and the value
 * being unchanged is what makes re-applying it invisible.
 *
 * **The provisional stamp is still minted before the change is applied**, and
 * that is not a leftover: a stamp that only existed after a round trip would
 * make every preference wait on one to take effect, and in the meantime an older
 * change arriving from another window would overwrite the value this one has
 * already shown.
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
 *  `at` starts as `Date.now()` in the window making the change, because it has
 *  to exist before that window applies the value to itself; what a change ends
 *  up carrying is what Rust assigned it, which is that number or the first one
 *  past the key's mark. One system clock serves every window, so the requests
 *  are already comparable in the ordinary case and the raise is what covers the
 *  clock going backwards. */
export interface Stamp {
  /** Epoch milliseconds — requested by the window that made the change, assigned
   *  by `src-tauri/src/settings.rs`. */
  at: number;
  /** The window's label, stamped by Rust so that no window can claim another's.
   *  A snapshot read carries `SNAPSHOT_ORIGIN` instead. */
  origin: string;
}

/** The origin a settings snapshot is stamped with. Empty so that it loses every
 *  same-millisecond tie against a real change: a read and a write stamped in the
 *  same millisecond cannot be ordered by their times, and the write is the one
 *  that carries an intention — a snapshot winning would put the window back on
 *  the value the store held before the change it just applied. */
const SNAPSHOT_ORIGIN = '';

/** What a window receives: the change and the place it was given. */
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
 *  millisecond must not be resolved one way here and the other way there. Two
 *  *committed* changes to one key no longer tie — Rust's mark strictly increases
 *  — so what the label orders is a stamp Rust did not assign: this window's own
 *  provisional one, and a settings read.
 *
 *  An identical stamp does not supersede, which is how a window declines a
 *  broadcast it has already dealt with. */
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
 *  be tested at all.
 *
 *  A window's own change comes back here carrying the stamp Rust assigned it,
 *  which supersedes the provisional one it recorded whenever the two differ — so
 *  the window re-applies its own value. That is the mechanism rather than a
 *  wasted round: it is how the window learns the place its change actually took,
 *  and the value is the one already on screen. */
export function changeToApply(broadcast: SettingBroadcast, last: Stamp | undefined): SettingChange | null {
  return supersedes(broadcast.stamp, last) ? broadcast.change : null;
}

/** Whether the stored value a read stamped `at` returned is still the newest
 *  thing this window knows for `key`, recording the read when it is.
 *
 *  A window applies its settings snapshot through this rather than straight,
 *  because the read is asynchronous: a change broadcast while it was in flight
 *  has already been applied, and the snapshot — taken before that change was
 *  written — would put the window back on the old value. `settingsReadStamp` is
 *  what makes the two comparable. */
export function snapshotStillCurrent(key: SettingChange['key'], at: number): boolean {
  return noteApplied(key, { at, origin: SNAPSHOT_ORIGIN });
}

/** The stamp to compare a settings snapshot against, asked for **before** the
 *  read is issued.
 *
 *  Rust answers with the highest place it has assigned so far, which is the one
 *  number that says the right thing about the answer a read issued now will
 *  return: every change committed before it has already been written, and every
 *  change committed after it is given a higher place than this. The wall clock
 *  cannot say that — a window's read stamped from a clock that has stepped
 *  forwards refuses the next change every other window accepts. */
export function settingsReadStamp(): Promise<number> {
  return invoke<number>('settings_read_stamp');
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

/** The time to request for a change this window is making: the wall clock, or
 *  one past what it already knows for the key, whichever is later.
 *
 *  Rust raises anything that arrives below the process-wide mark, so this is not
 *  what saves a window whose clock has stepped backwards. What it does is keep
 *  *this* window's provisional stamps ordered among themselves, which is what
 *  holds the value it has just applied against an older change arriving from
 *  another window before its own commit comes back. Minted from the wall clock
 *  alone, a second change made inside the same millisecond as the first would
 *  record nothing, and the window would take the first change back. */
export function mintAt(now: number, last: Stamp | undefined): number {
  return Math.max(now, last ? last.at + 1 : 0);
}

/** Apply this window's provisional stamp and hand the change to Rust, which
 *  gives it its place, persists it when `persist` is set, and tells every
 *  window.
 *
 *  **`persist` is passed rather than derived there**: which preferences the
 *  store holds is a list, and mirroring it in Rust would be a second copy to
 *  keep in step — the two callers here are the two answers. */
export function commitSetting(change: SettingChange, persist: boolean): Promise<void> {
  const at = mintAt(Date.now(), applied.get(change.key));
  noteApplied(change.key, { at, origin: selfLabel() });
  return invoke('commit_setting', { change, at, persist });
}

/** Tell every other window that a preference changed, for a caller with nothing
 *  to persist — the three preferences localStorage holds. */
export function broadcastSetting(change: SettingChange): void {
  // Fire-and-forget: the change is applied here already, so a failure costs the
  // other windows a live update and nothing else.
  void commitSetting(change, false).catch((e) => console.error('Failed to broadcast a setting', e));
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
