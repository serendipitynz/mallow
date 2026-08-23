import { listen } from '@tauri-apps/api/event';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Explorer } from './components/Explorer';
import { SettingsIcon } from './components/icons';
import { SettingsModal } from './components/SettingsModal';
import { Toolbar } from './components/Toolbar';
import { UpdateDialog } from './components/UpdateDialog';
import { Viewer } from './components/Viewer';
import { useFileTree } from './hooks/useFileTree';
import { useUpdater } from './hooks/useUpdater';
import { type CustomEmojiStatus, loadCustomEmoji, NO_CUSTOM_EMOJI } from './lib/custom-emoji';
import { fileEntryFromPath } from './lib/file';
import { useT } from './lib/i18n';
import { type CustomEmojiSet, setCustomEmoji } from './lib/markdown';
import { ancestorDirs, isInside } from './lib/path';
import { loadSettings, saveSetting } from './lib/settings';
import { allowMediaDir, pathExists, pickFolder } from './lib/tauri';
import type { FileEntry } from './lib/types';
import { onFsChange, startWatch } from './lib/watch';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;

/** How long after the session has settled the launch update check runs. It is
 *  gated on the restore finishing rather than on a timer alone, so this only has
 *  to keep the request off the first document's render. */
const LAUNCH_CHECK_DELAY_MS = 2_000;

export default function App() {
  const t = useT();
  const tree = useFileTree();
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_WIDTH);
  const [explorerSide, setExplorerSide] = useState<'left' | 'right'>('left');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emoji, setEmoji] = useState<CustomEmojiStatus>(NO_CUSTOM_EMOJI);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);
  const [restoreSettled, setRestoreSettled] = useState(false);
  const updater = useUpdater();

  const selectedRef = useRef<FileEntry | null>(null);
  const widthRef = useRef(explorerWidth);
  // Serialises overlapping custom-emoji loads; see `applyEmojiDir`.
  const emojiGeneration = useRef(0);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    widthRef.current = explorerWidth;
  }, [explorerWidth]);

  const { open: openTree, refresh, expandPaths } = tree;

  const selectFile = useCallback((entry: FileEntry) => {
    setSelected(entry);
    void saveSetting('lastFile', entry.path);
  }, []);

  const openFolder = useCallback(async () => {
    const dir = await pickFolder();
    if (!dir) {
      return;
    }
    setSelected(null);
    void saveSetting('lastFolder', dir);
    void saveSetting('lastFile', undefined);
    // Await the scope grant so a media file selected right after cannot build its
    // asset URL before the asset protocol is allowed to serve it.
    await allowMediaDir(dir).catch((e) => console.error('Failed to allow media dir', e));
    await openTree(dir);
    startWatch(dir).catch((e) => console.error('Failed to start watch', e));
  }, [openTree]);

  // ---- Custom emoji ---------------------------------------------------------
  // Applying the set rebuilds the markdown pipeline, and any open document
  // re-renders itself off that (see MarkdownView's config subscription).
  //
  // A folder can be re-picked while the previous one is still loading, and the
  // loads can finish in either order, so each carries a generation number and
  // only the newest one is allowed to commit. Persistence happens in that same
  // commit rather than at pick time: otherwise a superseded pick could still be
  // the last `saveSetting` to land, and the remembered folder would disagree
  // with the one on screen.
  const applyEmojiDir = useCallback(async (dir: string | null, persist = false) => {
    emojiGeneration.current += 1;
    const generation = emojiGeneration.current;
    const commit = (status: CustomEmojiStatus, set: CustomEmojiSet | null) => {
      if (generation !== emojiGeneration.current) {
        return;
      }
      setCustomEmoji(set);
      setEmoji(status);
      if (persist) {
        void saveSetting('customEmojiDir', status.dir ?? undefined);
      }
    };

    if (!dir) {
      commit(NO_CUSTOM_EMOJI, null);
      return;
    }
    try {
      const { set, count } = await loadCustomEmoji(dir);
      commit({ dir, count, error: null }, set);
    } catch (e) {
      // Keep the folder on screen with its error rather than silently dropping
      // it: the user needs to see which path failed to fix it.
      console.error('Failed to load custom emoji', e);
      commit({ dir, count: 0, error: String(e) }, null);
    }
  }, []);

  const pickEmojiDir = useCallback(async () => {
    const dir = await pickFolder();
    if (!dir) {
      return;
    }
    await applyEmojiDir(dir, true);
  }, [applyEmojiDir]);

  const clearEmojiDir = useCallback(() => {
    void applyEmojiDir(null, true);
  }, [applyEmojiDir]);

  // ---- Session restore + settings (on launch) -------------------------------
  useEffect(() => {
    let disposed = false;
    (async () => {
      const s = await loadSettings();
      if (disposed) {
        return;
      }
      if (s.explorerWidth) {
        setExplorerWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, s.explorerWidth)));
      }
      if (s.explorerSide) {
        setExplorerSide(s.explorerSide);
      }
      if (s.autoCheckUpdates === false) {
        setAutoCheckUpdates(false);
      }
      if (s.customEmojiDir) {
        await applyEmojiDir(s.customEmojiDir);
      }
      if (disposed) {
        return;
      }

      if (s.lastFolder && (await pathExists(s.lastFolder))) {
        // Await the scope grant before restoring the selection below, so a
        // restored media file cannot build its asset URL and latch a load error
        // before the asset protocol is allowed to serve it.
        await allowMediaDir(s.lastFolder).catch((e) => console.error('Failed to allow media dir', e));
        if (disposed) {
          return;
        }
        await openTree(s.lastFolder);
        startWatch(s.lastFolder).catch((e) => console.error('Failed to start watch', e));
        if (s.lastFile && isInside(s.lastFolder, s.lastFile) && (await pathExists(s.lastFile))) {
          await expandPaths(ancestorDirs(s.lastFolder, s.lastFile));
          const restored = fileEntryFromPath(s.lastFile);
          if (!disposed && restored) {
            setSelected(restored);
          }
        }
      }
    })()
      .catch((e) => console.error('Session restore failed', e))
      .finally(() => {
        if (!disposed) {
          setRestoreSettled(true);
        }
      });
    return () => {
      disposed = true;
    };
  }, [openTree, expandPaths, applyEmojiDir]);

  // ---- Filesystem watch (debounced) -----------------------------------------
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    const changed = new Set<string>();
    let timer = 0;

    const flush = () => {
      const paths = Array.from(changed);
      changed.clear();
      const sel = selectedRef.current;
      if (sel && paths.includes(sel.path)) {
        setReloadToken((t) => t + 1);
      }
      void refresh();
    };

    onFsChange((paths) => {
      paths.forEach((p) => {
        changed.add(p);
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 150);
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unlisten?.();
    };
  }, [refresh]);

  // ---- Update check ---------------------------------------------------------
  // Deferred behind the session restore so it competes with neither first paint
  // nor the restore's own reads. A launch check reports nothing but an available
  // update: being offline at launch is ordinary, and an error box for it would be
  // worse than not checking.
  const { checkForUpdate, resetCheck } = updater;
  const launchChecked = useRef(false);
  useEffect(() => {
    if (!restoreSettled || !autoCheckUpdates || launchChecked.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      launchChecked.current = true;
      checkForUpdate('launch');
    }, LAUNCH_CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [restoreSettled, autoCheckUpdates, checkForUpdate]);

  const changeAutoCheckUpdates = useCallback((on: boolean) => {
    setAutoCheckUpdates(on);
    void saveSetting('autoCheckUpdates', on);
  }, []);

  // ---- Settings (modal opened from the footer, the macOS menu, or Cmd/Ctrl+,) ---
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  // A result from an earlier visit would be read as this visit's answer, so the
  // inline line starts empty each time the modal is opened.
  useEffect(() => {
    if (settingsOpen) {
      resetCheck();
    }
  }, [settingsOpen, resetCheck]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    listen('menu:settings', () => setSettingsOpen(true)).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Explorer resize ------------------------------------------------------
  const [dragging, setDragging] = useState(false);
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const startX = e.clientX;
      const startW = widthRef.current;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const raw = explorerSide === 'left' ? startW + dx : startW - dx;
        setExplorerWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setDragging(false);
        void saveSetting('explorerWidth', widthRef.current);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [explorerSide],
  );

  const changeSide = useCallback((side: 'left' | 'right') => {
    setExplorerSide(side);
    void saveSetting('explorerSide', side);
  }, []);

  const explorer = (
    <Explorer tree={tree} selectedPath={selected?.path ?? null} onSelect={selectFile} onOpenFolder={openFolder} />
  );
  const resizer = (
    // A drag-only splitter: no keyboard path today, so a tab stop would be focusable and inert,
    // and aria-valuenow would report a width nothing can change. Arrow-key resizing is a UI
    // change, tracked separately. HTML has no splitter element, so role says what this is.
    // biome-ignore lint/a11y/useFocusableInteractive: drag-only, see above
    // biome-ignore lint/a11y/useSemanticElements: no semantic splitter element exists
    <div
      className={`app__resizer${dragging ? ' is-dragging' : ''}`}
      // biome-ignore lint/a11y/useAriaPropsForRole: drag-only, see above
      role="separator"
      aria-orientation="vertical"
      onMouseDown={startResize}
    />
  );
  const viewer = <Viewer file={selected} reloadToken={reloadToken} />;

  return (
    <div className="app">
      <Toolbar selected={selected} onOpenFolder={openFolder} />
      <div
        className="app__body"
        data-side={explorerSide}
        style={{ '--explorer-width': `${explorerWidth}px` } as CSSProperties}
      >
        {explorerSide === 'left' ? (
          <>
            {explorer}
            {resizer}
            {viewer}
          </>
        ) : (
          <>
            {viewer}
            {resizer}
            {explorer}
          </>
        )}
      </div>
      <footer className="app__footer">
        <button
          type="button"
          className="icon-btn"
          title={t('settings')}
          aria-label={t('settings')}
          onClick={openSettings}
        >
          <SettingsIcon />
        </button>
      </footer>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        side={explorerSide}
        onSideChange={changeSide}
        emoji={emoji}
        onPickEmojiDir={pickEmojiDir}
        onClearEmojiDir={clearEmojiDir}
        runningVersion={updater.runningVersion}
        autoCheckUpdates={autoCheckUpdates}
        onAutoCheckChange={changeAutoCheckUpdates}
        updateCheck={updater.check}
        onCheckForUpdate={() => checkForUpdate('manual')}
      />
      {/* After the settings modal in document order, so it paints over it when a
          manual check turns one up while the modal is still open. */}
      <UpdateDialog
        flow={updater.flow}
        runningVersion={updater.runningVersion}
        onConfirm={updater.confirmInstall}
        onDismiss={updater.dismiss}
      />
    </div>
  );
}
