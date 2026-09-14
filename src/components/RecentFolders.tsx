import { newWindowModifierHeld, onMacPlatform } from '../lib/chord';
import { useT } from '../lib/i18n';
import { basename, dirname } from '../lib/path';

interface RecentFoldersProps {
  folders: string[];
  onChoose: (folder: string, newWindow: boolean) => void;
}

/** The in-app Open Recent list, shown in the empty state a window has before a
 *  folder is opened.
 *
 *  **It is not a copy of the native submenu and it does not depend on the
 *  spike.** A DOM click event carries the modifier outright, so the new-window
 *  gesture is available here on every platform whatever the native read at
 *  menu-event time turns out to be worth (`src-tauri/src/modifier.rs`); and it is
 *  the discoverable path for a reader who never opens the menu bar. The decision
 *  itself is Rust's — one function behind both entries — so this reports the
 *  gesture and does not interpret it (TASK-12.5).
 *
 *  The folder is shown by name over its own path rather than abbreviated against
 *  the home directory the way the submenu's labels are: a list has the room for
 *  both, and the full path is what tells two folders of one name apart. */
export function RecentFolders({ folders, onChoose }: RecentFoldersProps) {
  const t = useT();
  const onMac = onMacPlatform();
  if (folders.length === 0) {
    return null;
  }
  return (
    <nav className="recent" aria-label={t('recentFolders')}>
      <h2 className="recent__title">{t('recentFolders')}</h2>
      <ul className="recent__list">
        {folders.map((folder) => (
          <li key={folder}>
            <button
              type="button"
              className="recent__item"
              title={folder}
              onClick={(e) => onChoose(folder, newWindowModifierHeld(e, onMac))}
            >
              <span className="recent__name">{basename(folder)}</span>
              <span className="recent__path">{dirname(folder)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="recent__hint">{t('recentNewWindowHint', { modifier: onMac ? '⌘' : 'Ctrl' })}</p>
    </nav>
  );
}
