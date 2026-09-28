import { type KeyboardEvent, useCallback, useMemo, useRef, useState } from 'react';
import type { FileTreeController } from '../hooks/useFileTree';
import { useT } from '../lib/i18n';
import { basename } from '../lib/path';
import { isShownUnder, tabStopPath, treeKeyAction, visibleRows } from '../lib/tree-nav';
import type { FileEntry } from '../lib/types';
import { Busy } from './Busy';
import { FileTree, type TreeRowHandlers } from './FileTree';
import { Notice } from './Notice';
import { RecentFolders } from './RecentFolders';

interface ExplorerProps {
  tree: FileTreeController;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onOpenFolder: () => void;
  recentFolders: string[];
  onChooseRecent: (folder: string, newWindow: boolean) => void;
}

export function Explorer({
  tree,
  selectedPath,
  onSelect,
  onOpenFolder,
  recentFolders,
  onChooseRecent,
}: ExplorerProps) {
  const t = useT();
  const { rootDir, rootEntries, rootLoading, rootError, expanded, childrenByPath, toggle } = tree;
  const rootName = rootDir ? basename(rootDir) : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  const rows = useMemo(
    () => visibleRows(rootEntries, expanded, childrenByPath),
    [rootEntries, expanded, childrenByPath],
  );
  const tabStop = tabStopPath(rows, focusedPath, selectedPath);

  const focusRow = useCallback((path: string) => {
    setFocusedPath(path);
    scrollRef.current?.querySelector<HTMLElement>(`.tree__row[data-path="${CSS.escape(path)}"]`)?.focus();
  }, []);

  // Closing a folder takes its rows off the screen, and a focused one would drop
  // the focus to the top of the document (snz-design doc-9 §6.1.1).
  const toggleRow = useCallback(
    (path: string) => {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.path : undefined;
      if (expanded.has(path) && focused && isShownUnder(rows, focused, path)) {
        focusRow(path);
      }
      toggle(path);
    },
    [expanded, rows, focusRow, toggle],
  );

  const activate = useCallback(
    (entry: FileEntry) => {
      if (entry.isDir) {
        toggleRow(entry.path);
      } else {
        onSelect(entry);
      }
    },
    [toggleRow, onSelect],
  );

  const onRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, path: string) => {
      if (e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }
      const action = treeKeyAction(
        rows,
        rows.findIndex((row) => row.entry.path === path),
        e.key,
      );
      if (!action) {
        return;
      }
      e.preventDefault();
      switch (action.kind) {
        case 'focus':
          focusRow(action.path);
          break;
        case 'toggle':
          toggleRow(action.path);
          break;
        case 'activate':
          onSelect(action.entry);
          break;
      }
    },
    [rows, focusRow, toggleRow, onSelect],
  );

  const handlers: TreeRowHandlers = {
    tabStop,
    selectedPath,
    onRowClick: activate,
    onRowFocus: setFocusedPath,
    onRowKeyDown,
  };

  return (
    <aside className="explorer">
      <div className="explorer__header">
        <span title={rootDir ?? undefined}>{rootName ?? t('explorer')}</span>
      </div>
      <div className="explorer__scroll" ref={scrollRef}>
        {!rootDir && (
          <div className="explorer__empty">
            <p className="explorer__empty-words">{t('noFolderOpen')}</p>
            <button type="button" className="btn" onClick={onOpenFolder}>
              {t('openFolder')}
            </button>
            <RecentFolders folders={recentFolders} onChoose={onChooseRecent} />
          </div>
        )}
        {rootDir && rootLoading && (
          <div className="explorer__status">
            <Busy>{t('loading')}</Busy>
          </div>
        )}
        {rootDir && rootError && (
          <div className="explorer__status">
            <Notice level="failure">{t('folderReadFailed', { error: rootError })}</Notice>
          </div>
        )}
        {rootDir && !rootLoading && !rootError && rootEntries.length === 0 && (
          <div className="explorer__empty">
            <p className="explorer__empty-words">{t('noFiles')}</p>
          </div>
        )}
        {rootDir && rootEntries.length > 0 && (
          <FileTree entries={rootEntries} tree={tree} rows={handlers} label={rootName ?? t('explorer')} />
        )}
      </div>
    </aside>
  );
}
