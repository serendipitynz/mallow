import type { FileTreeController } from '../hooks/useFileTree';
import { useT } from '../lib/i18n';
import { basename } from '../lib/path';
import type { FileEntry } from '../lib/types';
import { FileTree } from './FileTree';

interface ExplorerProps {
  tree: FileTreeController;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onOpenFolder: () => void;
}

export function Explorer({ tree, selectedPath, onSelect, onOpenFolder }: ExplorerProps) {
  const t = useT();
  const { rootDir, rootEntries, rootLoading, rootError } = tree;
  const rootName = rootDir ? basename(rootDir) : null;

  // Roving keyboard navigation over the visible tree rows.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.tree__row'));
    const idx = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        rows[0]?.focus();
      }
      return;
    }
    const current = rows[idx];
    const expanded = current.getAttribute('aria-expanded');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rows[Math.min(idx + 1, rows.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      rows[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === 'ArrowRight' && expanded === 'false') {
      e.preventDefault();
      current.click();
    } else if (e.key === 'ArrowLeft' && expanded === 'true') {
      e.preventDefault();
      current.click();
    }
  }

  return (
    <aside className="explorer">
      <div className="explorer__header">
        <span title={rootDir ?? undefined}>{rootName ?? t('explorer')}</span>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the handler delegates arrow-key
          navigation for the tree rows below, which are the focusable controls. Moving it onto
          each row would re-register the same listener per file. */}
      <div className="explorer__scroll" onKeyDown={onKeyDown}>
        {!rootDir && (
          <div className="explorer__empty">
            <p>{t('noFolderOpen')}</p>
            <button type="button" className="btn" onClick={onOpenFolder}>
              {t('openFolder')}
            </button>
          </div>
        )}
        {rootDir && rootLoading && <div className="tree__status">{t('loading')}</div>}
        {rootDir && rootError && <div className="tree__status is-error">{rootError}</div>}
        {rootDir && !rootLoading && !rootError && rootEntries.length === 0 && (
          <div className="explorer__empty">{t('noFiles')}</div>
        )}
        {rootDir && rootEntries.length > 0 && (
          <FileTree
            entries={rootEntries}
            depth={0}
            tree={tree}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onToggle={tree.toggle}
          />
        )}
      </div>
    </aside>
  );
}
