/**
 * Theme system: light / dark / auto plus extra palettes (Solarized, Dracula,
 * Nord). The chosen theme id lives on `<html data-theme>` (set before first paint
 * by the bootstrap in index.html) and is persisted to localStorage. Each palette
 * resolves to a light/dark "mode" that drives mermaid + the Shiki token swap.
 */

export type ThemeId = 'light' | 'dark' | 'auto' | 'solarized-light' | 'solarized-dark' | 'dracula' | 'nord';
export type Resolved = 'light' | 'dark';

/** Theme ids in menu order. Labels are resolved at render time: light/dark/auto
 *  are translated, the named palettes use their proper-noun label. */
export const THEMES: ThemeId[] = ['light', 'dark', 'auto', 'solarized-light', 'solarized-dark', 'dracula', 'nord'];

const STORAGE_KEY = 'theme';

// Light/dark mode each palette resolves to (drives mermaid + Shiki token colors).
const MODE: Record<Exclude<ThemeId, 'auto'>, Resolved> = {
  light: 'light',
  dark: 'dark',
  'solarized-light': 'light',
  'solarized-dark': 'dark',
  dracula: 'dark',
  nord: 'dark',
};

const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<(theme: Resolved) => void>();

export function getTheme(): ThemeId {
  const value = document.documentElement.dataset.theme;
  return THEMES.some((id) => id === value) ? (value as ThemeId) : 'auto';
}

/** The effective light/dark mode once "auto" is resolved against the OS. */
export function resolveTheme(): Resolved {
  const id = getTheme();
  if (id === 'auto') return media.matches ? 'dark' : 'light';
  return MODE[id];
}

let lastResolved: Resolved = resolveTheme();

function notify(): void {
  const resolved = resolveTheme();
  if (resolved === lastResolved) return;
  lastResolved = resolved;
  listeners.forEach((cb) => {
    cb(resolved);
  });
}

/** Subscribe to effective light/dark changes. Returns an unsubscribe function. */
export function onThemeChange(callback: (theme: Resolved) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Persist a theme, reflect it on `<html>`, and notify subscribers. */
export function setTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode / disabled storage: still apply for this session.
  }
  document.documentElement.dataset.theme = id;
  notify();
}

media.addEventListener('change', notify);
