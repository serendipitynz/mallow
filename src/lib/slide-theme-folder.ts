/** The slide theme folder and the default-theme preference (decision-19 §2, §3):
 *  the Tauri half of `lib/slide-themes`, holding what the folder gave and the
 *  theme set `lib/deck` draws with, for every view in this window to read.
 *
 *  **A store rather than state in `App`**, because two places that do not share
 *  a parent below `App` need it: the settings modal shows what the folder gave,
 *  and the Slides view re-reads the folder each time it is entered. */
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveSetting } from './settings';
import {
  type DeckThemes,
  type DefaultTheme,
  type FolderTheme,
  MALLOW_THEME,
  NO_DECK_THEMES,
  resolveDefaultTheme,
  type SkippedFile,
  type ThemeFile,
} from './slide-themes';
import { allowMediaDir, listSlideThemeFiles, readFile } from './tauri';

/** What one read of the folder gave. */
export interface FolderLoad {
  dir: string;
  themes: FolderTheme[];
  skipped: SkippedFile[];
  /** Why the folder itself could not be listed; `null` when it was. */
  error: string | null;
}

export interface SlideThemeState {
  dir: string | null;
  /** The last read of `dir`, or `null` until the first one finishes. */
  load: FolderLoad | null;
  /** The stored default-theme preference, as stored. */
  preference: string | null;
  defaultTheme: DefaultTheme;
  /** What `lib/deck` draws with. The same object for as long as the themes and
   *  the default name are unchanged, since the renderers are cached on it and a
   *  re-read of an unedited folder must not render the deck again. */
  deckThemes: DeckThemes;
}

let state: SlideThemeState = {
  dir: null,
  load: null,
  preference: null,
  defaultTheme: { name: MALLOW_THEME, missing: null },
  deckThemes: NO_DECK_THEMES,
};
const listeners = new Set<() => void>();
const granted = new Set<string>();

/** Each read carries a generation and only the newest commits, so a folder
 *  re-picked while the previous one is loading cannot be overwritten by it. */
let generation = 0;
let inFlight: Promise<void> | null = null;

export function getSlideThemes(): SlideThemeState {
  return state;
}

export function subscribeSlideThemes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function themeSignature(set: DeckThemes): string {
  return JSON.stringify([set.defaultName, set.themes.map((t) => [t.name, t.css, Object.entries(t.sizes)])]);
}

function commit(next: Pick<SlideThemeState, 'dir' | 'load' | 'preference'>): void {
  const folderNames = next.load?.themes.map((t) => t.name) ?? [];
  const resolved = resolveDefaultTheme(next.preference, folderNames);
  /* While the folder has not been read yet, a stored folder theme is not known
     to be missing, only not yet known; it draws with mallow's theme meanwhile. */
  const defaultTheme = next.dir !== null && next.load === null ? { name: resolved.name, missing: null } : resolved;
  const candidate: DeckThemes = { themes: next.load?.themes ?? [], defaultName: resolved.name };
  const deckThemes =
    themeSignature(candidate) === themeSignature(state.deckThemes)
      ? state.deckThemes
      : candidate.themes.length === 0 && candidate.defaultName === MALLOW_THEME
        ? NO_DECK_THEMES
        : candidate;
  state = { ...next, defaultTheme, deckThemes };
  for (const listener of listeners) {
    listener();
  }
}

async function readFolder(dir: string): Promise<FolderLoad> {
  try {
    // A theme's url()s are asset: URLs into this folder, whose scope starts empty.
    if (!granted.has(dir)) {
      await allowMediaDir(dir);
      granted.add(dir);
    }
    const paths = await listSlideThemeFiles(dir);
    const files = await Promise.all(
      paths.map(async (path): Promise<ThemeFile> => {
        const result = await readFile(path);
        return result.ok ? { path, text: result.text } : { path, error: result.error.kind };
      }),
    );
    const { registerFolderThemes } = await import('./slide-theme-css');
    return { dir, ...registerFolderThemes(files, convertFileSrc), error: null };
  } catch (e) {
    console.error('Failed to read the slide theme folder', e);
    return { dir, themes: [], skipped: [], error: String(e) };
  }
}

/** Read `dir` as the slide theme folder, or forget the folder for `null`. With
 *  `persist`, the folder is saved and sent to the other windows once the read
 *  commits, so a superseded pick is never the last value saved. */
export function applySlideThemeDir(dir: string | null, persist = false): Promise<void> {
  generation += 1;
  const mine = generation;
  if (dir !== state.dir) {
    // Shown at once, with nothing read yet, rather than beside the old folder's themes.
    commit({ dir, load: null, preference: state.preference });
  }
  const done = (async () => {
    const load = dir ? await readFolder(dir) : null;
    if (mine !== generation) {
      return;
    }
    commit({ dir, load, preference: state.preference });
    if (persist) {
      void saveSetting('slideThemeDir', dir ?? undefined);
    }
  })();
  inFlight = done;
  void done.finally(() => {
    if (inFlight === done) {
      inFlight = null;
    }
  });
  return done;
}

/** Read the current folder again, so an edited theme shows on the next visit to
 *  Slides (decision-19 §3). A read already under way answers for it. */
export function reloadSlideThemes(): Promise<void> {
  if (inFlight) {
    return inFlight;
  }
  return state.dir ? applySlideThemeDir(state.dir) : Promise.resolve();
}

/** The persist-free half, which a change from another window takes too. */
export function applyDefaultSlideTheme(name: string | null): void {
  commit({ dir: state.dir, load: state.load, preference: name && name !== MALLOW_THEME ? name : null });
}

/** Choose the default theme here: mallow's slide theme is stored as no
 *  preference, which is what an absent one means. */
export function chooseDefaultSlideTheme(name: string): void {
  applyDefaultSlideTheme(name);
  void saveSetting('defaultSlideTheme', state.preference ?? undefined);
}
