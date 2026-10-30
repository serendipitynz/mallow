import { type Ref, useId } from 'react';
import { onMacPlatform } from '../lib/chord';
import type { ExplorerSide } from '../lib/explorer-width';
import { historyChordLabel } from '../lib/history-nav';
import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import type { Direction } from '../lib/visit-history';
import { ArrowLeftIcon, ArrowRightIcon, FolderOpenIcon, PanelLeftIcon, PanelRightIcon } from './icons';
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
  canGoBack: boolean;
  canGoForward: boolean;
  onGo: (direction: Direction) => void;
}

const HISTORY_WORDS = {
  back: { label: 'historyBack', reason: 'historyBackNone' },
  forward: { label: 'historyForward', reason: 'historyForwardNone' },
} as const;

function HistoryButton({
  direction,
  enabled,
  onGo,
}: {
  direction: Direction;
  enabled: boolean;
  onGo: (direction: Direction) => void;
}) {
  const t = useT();
  const reasonId = useId();
  const words = HISTORY_WORDS[direction];
  const label = t(words.label);
  const tip = `${label} (${historyChordLabel(direction, onMacPlatform())})`;
  return (
    <>
      {/* `aria-disabled` rather than `disabled`, so the button keeps the focus
          when the press that emptied its side was its own (snz-design doc-8 §5.4). */}
      <button
        type="button"
        className="icon-btn"
        title={enabled ? tip : `${tip} — ${t(words.reason)}`}
        aria-label={label}
        aria-disabled={!enabled || undefined}
        aria-describedby={enabled ? undefined : reasonId}
        onClick={() => {
          if (enabled) {
            onGo(direction);
          }
        }}
      >
        {direction === 'back' ? <ArrowLeftIcon /> : <ArrowRightIcon />}
      </button>
      {!enabled && (
        <span id={reasonId} className="visually-hidden">
          {t(words.reason)}
        </span>
      )}
    </>
  );
}

export function Toolbar({
  selected,
  onOpenFolder,
  explorerShown,
  explorerSide,
  explorerId,
  onToggleExplorer,
  explorerToggleRef,
  canGoBack,
  canGoForward,
  onGo,
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
        <HistoryButton direction="back" enabled={canGoBack} onGo={onGo} />
        <HistoryButton direction="forward" enabled={canGoForward} onGo={onGo} />
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
