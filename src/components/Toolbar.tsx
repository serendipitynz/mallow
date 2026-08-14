import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { FolderOpenIcon } from './icons';
import { OpenWith } from './OpenWith';
import { ThemePicker } from './ThemePicker';

interface ToolbarProps {
  selected: FileEntry | null;
  onOpenFolder: () => void;
}

export function Toolbar({ selected, onOpenFolder }: ToolbarProps) {
  const t = useT();
  return (
    <header className="toolbar">
      <button
        type="button"
        className="icon-btn"
        title={t('openFolder')}
        aria-label={t('openFolder')}
        onClick={onOpenFolder}
      >
        <FolderOpenIcon />
      </button>
      <span className="toolbar__path" title={selected?.path ?? undefined}>
        {selected?.path ?? ''}
      </span>
      <div className="toolbar__actions">
        <OpenWith file={selected} />
        <ThemePicker />
      </div>
    </header>
  );
}
