import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '../lib/i18n';
import { broadcastSetting } from '../lib/settings-sync';
import { getTheme, onThemeIdChange, setTheme, THEMES, type ThemeId } from '../lib/theme';
import { MoonIcon, SunIcon, SunMoonIcon } from './icons';

// Proper-noun palette names are not translated.
const PROPER: Partial<Record<ThemeId, string>> = {
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark',
  dracula: 'Dracula',
  nord: 'Nord',
};

function glyphFor(id: ThemeId) {
  if (id === 'auto') {
    return SunMoonIcon;
  }
  if (id === 'light' || id === 'solarized-light') {
    return SunIcon;
  }
  return MoonIcon;
}

export function ThemePicker() {
  const t = useT();
  // Subscribed rather than held locally, because this window is not the only
  // thing that changes the theme any more: another window's change arrives
  // through `lib/settings-sync` and lands on `<html>` via `applyTheme`.
  const current = useSyncExternalStore(onThemeIdChange, getTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(id: ThemeId) {
    setTheme(id);
    // The theme is app-wide (TASK-12 puts a per-window one out of scope), so the
    // windows already open have to follow. Sent from here rather than from
    // `setTheme` so that `lib/theme` keeps no dependency on the Tauri layer.
    broadcastSetting({ key: 'theme', value: id });
    setOpen(false);
  }

  function labelFor(id: ThemeId): string {
    return PROPER[id] ?? t(`theme.${id}`);
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        title={t('selectTheme')}
        aria-label={t('selectTheme')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SunMoonIcon />
      </button>
      {open && (
        <div className="menu__popup" role="menu">
          {THEMES.map((id) => {
            const Glyph = glyphFor(id);
            return (
              <button
                key={id}
                type="button"
                className={`menu__item${current === id ? ' is-active' : ''}`}
                role="menuitemradio"
                aria-checked={current === id}
                onClick={() => pick(id)}
              >
                <span className="menu__item-icon">
                  <Glyph />
                </span>
                {labelFor(id)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
