/** Persistent app settings via the Tauri store plugin (settings.json in the app
 *  config dir). Theme is intentionally kept in localStorage (read before paint). */
import { load, type Store } from '@tauri-apps/plugin-store';
import { broadcastSetting, type SettingChange } from './settings-sync';

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

/** Persist a preference **and tell the other windows**, which is one function
 *  rather than two calls because they are one event: a preference saved without
 *  being propagated leaves every other open window on the old value until the
 *  next launch, which is the defect TASK-12.8 exists to close, and the call that
 *  gets forgotten is the third one nobody remembers writing.
 *
 *  Absent because the caller has already applied it: this window's own state. */
export async function saveSetting<K extends WritableKey>(key: K, value: Settings[K]): Promise<void> {
  const store = await getStore();
  if (value === undefined || value === null) {
    await store.delete(key);
  } else {
    await store.set(key, value);
  }
  // Narrowing a generic key against the change union is not something the
  // compiler does; `WritableKey` is what makes the pairing sound, and `undefined`
  // becomes the `null` the wire carries for a cleared setting.
  broadcastSetting({ key, value: value ?? null } as SettingChange);
}
