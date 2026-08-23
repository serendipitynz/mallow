/** Persistent app settings via the Tauri store plugin (settings.json in the app
 *  config dir). Theme is intentionally kept in localStorage (read before paint). */
import { load, type Store } from '@tauri-apps/plugin-store';

export interface Settings {
  lastFolder?: string;
  lastFile?: string;
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

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const store = await getStore();
  if (value === undefined || value === null) {
    await store.delete(key);
  } else {
    await store.set(key, value);
  }
}
