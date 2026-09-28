import type { Ref } from 'react';
import { onMacPlatform } from '../lib/chord';
import type { ExplorerSide } from '../lib/explorer-width';
import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { FolderOpenIcon, PanelLeftIcon, PanelRightIcon } from './icons';
import { ModeMenu } from './ModeMenu';
import { OpenWith } from './OpenWith';

interface ToolbarProps {
  selected: FileEntry | null;
  onOpenFolder: () => void;
  explorerShown: boolean;
  explorerSide: ExplorerSide;
  explorerId: string;
  onToggleExplorer: () => void;
  explorerToggleRef: Ref<HTMLButtonElement>;
}

export function Toolbar({
  selected,
  onOpenFolder,
  explorerShown,
  explorerSide,
  explorerId,
  onToggleExplorer,
  explorerToggleRef,
}: ToolbarProps) {
  const t = useT();
  const chord = onMacPlatform() ? '⌘B' : 'Ctrl+B';
  /* Outside the explorer, so hiding it never hides the way back — and at the end
     of the toolbar on the explorer's own side, so the control sits by the pane it
     shows (snz-design doc-9 §6.3.1). */
  const toggle = (
    <button
      ref={explorerToggleRef}
      type="button"
      className="icon-btn toolbar__explorer-toggle"
      title={`${t('explorer')} (${chord})`}
      aria-label={t('explorer')}
      aria-expanded={explorerShown}
      aria-controls={explorerShown ? explorerId : undefined}
      onClick={onToggleExplorer}
    >
      {explorerSide === 'right' ? <PanelRightIcon /> : <PanelLeftIcon />}
    </button>
  );
  return (
    <header className="toolbar">
      <div className="toolbar__lead">
        {explorerSide === 'left' && toggle}
        <button
          type="button"
          className="icon-btn"
          title={t('openFolder')}
          aria-label={t('openFolder')}
          onClick={onOpenFolder}
        >
          <FolderOpenIcon />
        </button>
      </div>
      <span className="toolbar__path" title={selected?.path ?? undefined}>
        {selected?.path ?? ''}
      </span>
      <div className="toolbar__actions">
        <OpenWith file={selected} />
        <ModeMenu />
        {explorerSide === 'right' && toggle}
      </div>
    </header>
  );
}
