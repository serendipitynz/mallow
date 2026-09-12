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
 * is the label Rust stamps on the change, read by `changeFromOtherWindow`.
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

/** What a window receives: the change plus the label of the window that made it. */
export interface SettingBroadcast {
  origin: string;
  change: SettingChange;
}

const EVENT = 'settings:change';

/** The change to apply, or `null` when this window is the one that made it.
 *
 *  The guard against a window fighting its own update, kept out of the effect
 *  that listens so that it can be tested at all. */
export function changeFromOtherWindow(broadcast: SettingBroadcast, self: string): SettingChange | null {
  return broadcast.origin === self ? null : broadcast.change;
}

/** Tell every other window that a preference changed. Fire-and-forget: the
 *  change is already applied and persisted here, so a failed emit costs the
 *  other windows a live update and nothing else. */
export function broadcastSetting(change: SettingChange): void {
  void invoke('broadcast_setting', { change }).catch((e) => console.error('Failed to broadcast a setting', e));
}

/** Subscribe to preferences changed in another window. */
export function onSettingChange(apply: (change: SettingChange) => void): Promise<UnlistenFn> {
  const self = getCurrentWebviewWindow().label;
  return listen<SettingBroadcast>(EVENT, (event) => {
    const change = changeFromOtherWindow(event.payload, self);
    if (change) {
      apply(change);
    }
  });
}
