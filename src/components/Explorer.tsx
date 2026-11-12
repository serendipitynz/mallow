import { type KeyboardEvent, type MouseEvent, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContextMenu } from '../hooks/useContextMenu';
import { useEditors } from '../hooks/useEditors';
import type { FileTreeController } from '../hooks/useFileTree';
import { onMacPlatform } from '../lib/chord';
import { isContextMenuKey } from '../lib/context-menu';
import { useT } from '../lib/i18n';
import { basename } from '../lib/path';
import { isShownUnder, tabStopPath, treeKeyAction, visibleRows } from '../lib/tree-nav';
import type { FileEntry } from '../lib/types';
import { Busy } from './Busy';
import { FileActionItems } from './FileActions';
import { FileTree, type TreeRowHandlers } from './FileTree';
import { Notice } from './Notice';
import { RecentFolders } from './RecentFolders';

interface ExplorerProps {
  id: string;
  tree: FileTreeController;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onOpenFolder: () => void;
  recentFolders: string[];
  onChooseRecent: (folder: string, newWindow: boolean) => void;
}

export function Explorer({
  id,
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
  const editors = useEditors();
  const contextMenu = useContextMenu<FileEntry>();

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

  const { openAt: openContextMenu, close: closeContextMenu } = contextMenu;

  // On macOS a Ctrl+click is the secondary click, which opens the context menu;
  // taken as a click as well, it would select the row the menu is about.
  const onRowClick = useCallback(
    (e: MouseEvent<HTMLDivElement>, entry: FileEntry) => {
      if (e.ctrlKey && onMacPlatform()) {
        return;
      }
      activate(entry);
    },
    [activate],
  );

  const onRowContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>, entry: FileEntry) => {
      e.preventDefault();
      openContextMenu(entry, e.currentTarget, { x: e.clientX, y: e.clientY });
    },
    [openContextMenu],
  );

  const onRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, entry: FileEntry) => {
      if (e.nativeEvent.isComposing) {
        return;
      }
      // Consumed here, so the WebView's own menu does not open over the row.
      if (isContextMenuKey(e)) {
        e.preventDefault();
        const row = e.currentTarget;
        const at = (row.querySelector('.tree__label') ?? row).getBoundingClientRect();
        openContextMenu(entry, row, { x: at.left, y: at.bottom });
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }
      const action = treeKeyAction(
        rows,
        rows.findIndex((row) => row.entry.path === entry.path),
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
    [rows, focusRow, toggleRow, onSelect, openContextMenu],
  );

  // Closed before the action runs, so the focus is back on the row by the time
  // anything the action opens takes it (snz-design doc-9 §6.11).
  const chooseFromContextMenu = useCallback(
    (action: () => Promise<void>) => {
      closeContextMenu(true);
      void action().catch((e) => console.error(e));
    },
    [closeContextMenu],
  );

  const handlers: TreeRowHandlers = {
    tabStop,
    selectedPath,
    onRowClick,
    onRowContextMenu,
    onRowFocus: setFocusedPath,
    onRowKeyDown,
  };

  return (
    <aside className="explorer" id={id}>
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
      {contextMenu.target &&
        createPortal(
          <div
            className="menu__popup menu__popup--context"
            role="menu"
            aria-label={t('fileActions', { name: contextMenu.target.name })}
            {...contextMenu.popupProps}
            onContextMenu={(e) => e.preventDefault()}
          >
            <FileActionItems
              entry={contextMenu.target}
              rootDir={rootDir}
              editors={editors}
              choose={chooseFromContextMenu}
            />
          </div>,
          document.body,
        )}
    </aside>
  );
}
