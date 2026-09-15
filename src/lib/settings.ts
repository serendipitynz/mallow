/** Persistent app settings via the Tauri store plugin (settings.json in the app
 *  config dir). Theme is intentionally kept in localStorage (read before paint). */
import { load, type Store } from '@tauri-apps/plugin-store';
import { commitSetting, type SettingChange } from './settings-sync';

export interface Settings {
  /** One entry per window open at quit, least-recently-focused first. **Rust owns
   *  this key** — `src-tauri/src/session.rs` is what writes and reads it, for the
   *  reason it owns `recentFolders`: several windows read-modify-writing one
   *  array from JS lose entries. It replaced `lastFolder` / `lastFile`, which a
   *  one-time migration seeds from and then deletes. Declared here because this
   *  is the shape of the same file; nothing in the frontend reads it. */
  windows?: { label: string; folder: string | null; files: string[]; active: string | null }[];
  /** Previously opened folders, newest first, capped. **Rust owns this key** —
   *  `record_recent` / `list_recent` / `clear_recent` in `src-tauri/src/recent.rs`
   *  are what write and read it, so that a recording is one step. Declared here
   *  because this is the shape of the same file. */
  recentFolders?: string[];
  explorerWidth?: number;
  explorerSide?: 'left' | 'right';
  /** Folder holding the user's custom `:shortcode:` emoji (see lib/custom-emoji). */
  customEmojiDir?: string;
  /** Whether to run an update check after launch. Absent means on. Turning it
   *  off leaves the manual check in Settings, and neither installs anything on
   *  its own — so this is not an "auto-update" switch. */
  autoCheckUpdates?: boolean;
}

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load('settings.json', { autoSave: true, defaults: {} });
  }
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const entries = await store.entries();
  return Object.fromEntries(entries) as Settings;
}

/** The keys a window writes. The two Rust owns are excluded rather than listed
 *  again: nothing in the frontend writes them, so there is also nothing to
 *  propagate for them. */
export type WritableKey = Exclude<keyof Settings, 'windows' | 'recentFolders'>;

/** Persist a preference **and tell the other windows**, which is one call rather
 *  than two because they are one event: a preference saved without being
 *  propagated leaves every other open window on the old value until the next
 *  launch, which is the defect TASK-12.8 exists to close, and the call that gets
 *  forgotten is the third one nobody remembers writing.
 *
 *  **The store write happens in Rust** (`commit_setting`), under the same lock
 *  that assigns the change its place in the order — so this is the one function
 *  that says a key is store-backed, and the write joins the order rather than
 *  racing it. TASK-33 says what the alternative was and why the gate it would
 *  have needed cannot close the hole.
 *
 *  Absent because the caller has already applied it: this window's own state.
 *  `undefined` becomes the `null` the wire carries for a cleared setting, and
 *  narrowing a generic key against the change union is not something the
 *  compiler does — `WritableKey` is what makes the pairing sound. */
export function saveSetting<K extends WritableKey>(key: K, value: Settings[K]): Promise<void> {
  return commitSetting({ key, value: value ?? null } as SettingChange, true);
}
