import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Explorer } from './components/Explorer';
import { SettingsIcon } from './components/icons';
import { SettingsModal } from './components/SettingsModal';
import { Toolbar } from './components/Toolbar';
import { UpdateDialog } from './components/UpdateDialog';
import { Viewer } from './components/Viewer';
import { useFileTree } from './hooks/useFileTree';
import { useUpdater } from './hooks/useUpdater';
import { useWindowEvent } from './hooks/useWindowEvent';
import { UNATTENDED } from './lib/build-flags';
import { matchesCmdOrCtrl, onMacPlatform } from './lib/chord';
import { createCloseWindowChordHandler } from './lib/close-window';
import { type CustomEmojiStatus, loadCustomEmoji, NO_CUSTOM_EMOJI } from './lib/custom-emoji';
import { fileEntryFromPath } from './lib/file';
import { useI18n, useT } from './lib/i18n';
import { type CustomEmojiSet, setCustomEmoji } from './lib/markdown';
import { isMarkdownPreviewActive, onMarkdownPreviewChange } from './lib/markdown-preview';
import { createNewWindowChordHandler } from './lib/new-window';
import { applyOutlineOpen } from './lib/outline-pref';
import { ancestorDirs, isInside } from './lib/path';
import { createPdfExportChordHandler, pdfDestinationFor, runExclusiveExport } from './lib/pdf-export';
import { createPrintChordHandler } from './lib/print';
import { loadSettings, saveSetting } from './lib/settings';
import { onSettingChange, type SettingChange, snapshotStillCurrent } from './lib/settings-sync';
import {
  allowMediaDir,
  closeWindow,
  openWindow,
  pathExists,
  pickFolder,
  pickPdfDestination,
  printWindow,
  recordRecent,
  reportMarkdownPreview,
  reportWindowContent,
  showErrorDialog,
  takeWindowInit,
  writeWindowPdf,
} from './lib/tauri';
import { applyTheme } from './lib/theme';
import type { FileEntry } from './lib/types';
import { onFsChange, startWatch } from './lib/watch';
import { locationToOpenAtMount } from './lib/window-init';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;
/** Named because a propagated change can carry `null` — a preference deleted
 *  from the store — and the window that receives one has to land on the value a
 *  window with nothing stored would show. */
const DEFAULT_SIDE: 'left' | 'right' = 'left';
const DEFAULT_AUTO_CHECK_UPDATES = true;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

/** How long after the session has settled the launch update check runs. It is
 *  gated on the restore finishing rather than on a timer alone, so this only has
 *  to keep the request off the first document's render. */
const LAUNCH_CHECK_DELAY_MS = 2_000;

export default function App() {
  const t = useT();
  const { applyLang } = useI18n();
  const tree = useFileTree();
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_WIDTH);
  const [explorerSide, setExplorerSide] = useState<'left' | 'right'>(DEFAULT_SIDE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emoji, setEmoji] = useState<CustomEmojiStatus>(NO_CUSTOM_EMOJI);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(DEFAULT_AUTO_CHECK_UPDATES);
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
  }, []);

  /** Show `folder`, and select `file` inside it when the location carries one.
   *
   *  One function because the ways a window arrives at a folder — the picker and
   *  the initial location a creating or restoring window deposited
   *  (`take_window_init`) — have to agree on the order: the asset-scope
   *  grant is awaited before the tree opens, so a media file selected straight
   *  after cannot build its asset URL before the asset protocol is allowed to
   *  serve it.
   *
   *  `cancelled` is read after every await rather than taken as a boolean: the
   *  sequence outlives several of them, and a window unmounted midway must not
   *  go on to select a file. */
  const openLocation = useCallback(
    async (folder: string, file: string | null, cancelled: () => boolean) => {
      /* Recorded here rather than at each entry because this function is
         already the one sequence all of them take, so TASK-12.5's Open Recent
         replace is covered by the same line. It is not what the restored session
         reads — the recent list and the window set record different facts, and
         the restored session is reported by the effect below. An unattended
         export reaches none of this, so a measurement run still leaves the
         reader's session where it found it. */
      void recordRecent(folder).catch((e) => console.error('Failed to record the recent folder', e));
      await allowMediaDir(folder).catch((e) => console.error('Failed to allow media dir', e));
      if (cancelled()) {
        return;
      }
      await openTree(folder);
      startWatch(folder).catch((e) => console.error('Failed to start watch', e));
      if (!file || !isInside(folder, file) || !(await pathExists(file))) {
        return;
      }
      await expandPaths(ancestorDirs(folder, file));
      const entry = fileEntryFromPath(file);
      if (!cancelled() && entry) {
        setSelected(entry);
      }
    },
    [openTree, expandPaths],
  );

  const openFolder = useCallback(async () => {
    const dir = await pickFolder();
    if (!dir) {
      return;
    }
    setSelected(null);
    await openLocation(dir, null, () => false);
  }, [openLocation]);

  /** New Window opens empty rather than duplicating this window's folder: a
   *  window opened to compare against something is opened on a different folder,
   *  and the recent-folder list is one click away once TASK-12.3 has it. */
  const newWindow = useCallback(() => {
    void openWindow().catch((e) => console.error('Failed to open a window', e));
  }, []);

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

  /* ---- Preferences changed in another window (TASK-12.8) --------------------
     Every preference is app-wide — TASK-12 puts per-window theme and language
     out of scope — and the settings modal opens in any window, so a change made
     anywhere has to land here. `lib/settings-sync` holds why this is the one
     place a broadcast is correct, and how two changes made close together are
     ordered.

     **Each applier is the persist-free half on purpose.** Writing the value
     again would be this window re-doing the work of the window that changed it
     — one WebView data store and one settings.json are shared — and going
     through the persisting setters would send an echo back out. */
  const applySettingChange = useCallback(
    (change: SettingChange) => {
      switch (change.key) {
        case 'theme':
          applyTheme(change.value);
          break;
        case 'lang':
          applyLang(change.value);
          break;
        case 'outlineOpen':
          applyOutlineOpen(change.value);
          break;
        case 'explorerSide':
          setExplorerSide(change.value ?? DEFAULT_SIDE);
          break;
        case 'explorerWidth':
          setExplorerWidth(clampWidth(change.value ?? DEFAULT_WIDTH));
          break;
        case 'customEmojiDir':
          void applyEmojiDir(change.value);
          break;
        case 'autoCheckUpdates':
          setAutoCheckUpdates(change.value ?? DEFAULT_AUTO_CHECK_UPDATES);
          break;
        default: {
          // A preference added to `Settings` arrives here as a key this switch
          // does not handle and stops the build, which is the point: a setting
          // that propagates to a window that ignores it is worse than one that
          // does not propagate at all.
          const unhandled: never = change;
          console.error('Unhandled setting change', unhandled);
        }
      }
    },
    [applyLang, applyEmojiDir],
  );

  // ---- Session restore + settings (on launch) -------------------------------
  useEffect(() => {
    let disposed = false;
    let unlistenSettings: (() => void) | undefined;

    /* An unattended build opens the document its command line named instead, and
       reads no settings at all — the store it would read is the installed app's,
       and a measurement run must leave a reader's session where it found it. The
       condition is a build-time constant, so an ordinary bundle contains neither
       this branch nor the module it imports (`lib/build-flags`). */
    if (UNATTENDED) {
      void import('./unattended/run').then(({ runUnattendedExport }) =>
        runUnattendedExport({ openTree, select: setSelected }),
      );
      return;
    }

    (async () => {
      /* **Registered before the settings are read, not beside it.** Both are
         asynchronous, so a change broadcast between the read and the
         registration would reach a window that is listening for nothing —
         and a broadcast is not sent when the reader clicks: the custom emoji
         folder is sent when its load finishes, which can be a directory scan
         after the window that opened this one was asked for. Ordering the two
         closes the gap in one direction; `snapshotStillCurrent` closes the
         other, where a change applied while the read was in flight would be
         overwritten by the answer it beat. */
      unlistenSettings = await onSettingChange(applySettingChange);
      if (disposed) {
        unlistenSettings();
        return;
      }
      const readAt = Date.now();
      const s = await loadSettings();
      if (disposed) {
        return;
      }
      if (s.explorerWidth && snapshotStillCurrent('explorerWidth', readAt)) {
        setExplorerWidth(clampWidth(s.explorerWidth));
      }
      if (s.explorerSide && snapshotStillCurrent('explorerSide', readAt)) {
        setExplorerSide(s.explorerSide);
      }
      if (s.autoCheckUpdates === false && snapshotStillCurrent('autoCheckUpdates', readAt)) {
        setAutoCheckUpdates(false);
      }
      if (s.customEmojiDir && snapshotStillCurrent('customEmojiDir', readAt)) {
        await applyEmojiDir(s.customEmojiDir);
      }
      if (disposed) {
        return;
      }

      /* What this window was told at creation, taken exactly once. A window
         opens what it was handed and nothing else — including nothing at all,
         for New Window — and there is nothing to fall back to: every window is
         created now, so being handed nothing means opening nothing.
         `lib/window-init` holds why the two answers stay distinct all the same.
         What this window ends up showing reaches the restored session through
         the effect below. */
      const init = await takeWindowInit().catch((e) => {
        console.error("Failed to take this window's initialization", e);
        return null;
      });
      if (disposed) {
        return;
      }
      const target = locationToOpenAtMount(init);
      if (target && (await pathExists(target.folder))) {
        await openLocation(target.folder, target.file, () => disposed);
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
      unlistenSettings?.();
    };
  }, [openTree, openLocation, applyEmojiDir, applySettingChange]);

  /* ---- The restored session (TASK-12.7) -------------------------------------
     **A predicate, not a call site.** The rule is that a window says what it
     shows whenever what it shows changes, so this watches the displayed folder
     and selection rather than sitting beside the picker, the mount-time restore
     and — once TASK-12.5 lands — Open Recent replacing a folder in place. Written
     as three calls instead, the third would be the one nobody remembers, and the
     symptom is quiet: replace the folder, quit, and the window comes back on the
     folder it had before.

     Rust owns the list itself, for the reason it owns the recent folders: several
     windows read-modify-writing one array cannot do it from here.

     **Held until the mount-time open has settled**, because until then this
     window shows nothing while its row already says what it is about to show:
     reporting that emptiness would overwrite the row, and a window closed in
     the second before its folder arrives would be restored empty. Rust seeded
     the row when it created the window, so nothing is lost by waiting.

     An unattended export reports nothing, for the reason it records no recent
     folder — the store it would write is an installed mallow's. */
  useEffect(() => {
    if (UNATTENDED || !restoreSettled) {
      return;
    }
    void reportWindowContent(tree.rootDir, selected?.path ?? null).catch((e) =>
      console.error('Failed to report what this window shows', e),
    );
  }, [restoreSettled, tree.rootDir, selected?.path]);

  // ---- Filesystem watch (debounced) -----------------------------------------
  useEffect(() => {
    // Nothing watches during an unattended export: the document is read once and
    // the process ends, so a watcher could only fire after the paper is written.
    if (UNATTENDED) {
      return;
    }
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

  /* ---- The native menu (TASK-12.4) ------------------------------------------
     Every one of these arrives **at this window only**: the menu is app-wide and
     `menu.rs` emits to whichever window is focused, which a plain `listen()`
     would defeat — `EventTarget::Any` matches a filtered emit as readily as an
     unfiltered one. `useWindowEvent` is that pairing.

     The menu says what was chosen and the window does it, so each of these lands
     on the same function the toolbar button or the chord already calls. That is
     what keeps one implementation behind two entries rather than two that can
     drift. */
  useWindowEvent('menu:settings', () => setSettingsOpen(true));
  useWindowEvent('menu:open', () => void openFolder());
  useWindowEvent('menu:print', () => void printWindow().catch((err) => console.error('print failed', err)));

  /** Open Recent, without the modifier: the chosen folder replaces this window's.
   *
   *  Nothing calls `report_window_content` here, and that is the rule rather than
   *  an omission — reporting is a predicate over the displayed folder and
   *  selection, which the effect above satisfies, so replacing the tree's root
   *  reports it. TASK-12.5 adds the modifier branch, which opens a window
   *  instead and leaves this one untouched. */
  useWindowEvent<string>('menu:open-recent', (folder) => {
    setSelected(null);
    void openLocation(folder, null, () => false);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesCmdOrCtrl(e, ',', onMacPlatform())) {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- What the two gated menu items show -----------------------------------
     The flag lives in this WebView and the menu lives in Rust, so the condition
     has to be pushed rather than read. **The current value is sent at
     subscription time as well**, because React runs a child's effects before its
     parent's: a markdown preview has already published by the time this runs, so
     waiting for the next change would leave the items disabled over the first
     document a window opens. */
  useEffect(() => {
    const report = (active: boolean) =>
      void reportMarkdownPreview(active).catch((e) => console.error('Failed to report the view state', e));
    report(isMarkdownPreviewActive());
    return onMarkdownPreviewChange(report);
  }, []);

  /* ---- Print (decision-13) --------------------------------------------------
     Registered for the life of the app and **always** consuming the chord, even
     where printing is refused. That is the correction Windows forced: the handler
     used to live in `MarkdownView`, so a view that could not print registered
     nothing — and WebView2's own `Ctrl+P` then printed the view anyway, measured
     with a `.csv` on screen. Registering nothing does not make a chord inert; it
     concedes it to the platform.

     It also closes the chord on Linux, where reaching the platform's print path
     costs the user their session and `print_window` refusing in Rust would not
     have helped: a native binding never goes through `print_window`. */
  useEffect(() => {
    const onKey = createPrintChordHandler({
      onMac: onMacPlatform(),
      print: () => void printWindow().catch((err) => console.error('print failed', err)),
    });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- PDF export (decision-14) ---------------------------------------------
     A second route to paper that never opens a print UI, which is what lets it
     sidestep printing's three platform defects — and on Linux it is the only way
     a page leaves mallow at all, since `print_window` refuses there.

     The chord is registered and consumed on the same terms as printing's, for the
     same measured reason (`lib/chord`), and the gate is the same sentence for a
     different one (`lib/pdf-export`). The destination is the reader's: nothing
     here writes to a location they did not name. */
  const exportPdf = useCallback(
    () =>
      runExclusiveExport(async () => {
        const open = selectedRef.current;
        const chosen = await pickPdfDestination(open ? pdfDestinationFor(open.path) : undefined);
        if (!chosen) {
          return;
        }
        try {
          // **Whatever the dialog answered is what gets written.** An extension
          // added afterwards would be a path the dialog never confirmed, and its
          // overwrite prompt is per-name: a reader who types `report` is asked
          // about `report` and would silently lose a `report.pdf` beside it. The
          // default name already carries `.pdf`, so this only gives up renaming
          // what the reader deliberately typed instead.
          await writeWindowPdf(chosen);
        } catch (err) {
          console.error('PDF export failed', err);
          void showErrorDialog(t('pdfExportFailedTitle'), t('pdfExportFailed', { error: String(err) }));
        }
      }),
    [t],
  );

  useEffect(() => {
    const onKey = createPdfExportChordHandler({ onMac: onMacPlatform(), exportPdf: () => void exportPdf() });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportPdf]);

  // Registered here rather than beside the other menu listeners because it is the
  // same `exportPdf` the chord runs, declared just above: one implementation
  // behind both entries, including the flag that serialises them.
  useWindowEvent('menu:export-pdf', () => void exportPdf());

  /* ---- New Window (TASK-12.2) ----------------------------------------------
     Registered and consumed on the same terms as the other two chords and for the
     same measured reason (`lib/chord`), with no gate: a new window depends on
     nothing that is currently displayed. The menu item beside it is TASK-12.4's,
     on the split TASK-30 took — the chord ships with the mechanism. */
  useEffect(() => {
    const onKey = createNewWindowChordHandler({ onMac: onMacPlatform(), newWindow });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newWindow]);

  /* ---- Close Window (TASK-12.4) ---------------------------------------------
     Registered and consumed on the same terms as the other three, with no gate.
     **On Windows it is not a second route to the menu item but the only working
     one**: measured 2026-09-12, `Ctrl+W` reached nothing while the menu item
     itself closed the window, so muda's accelerator does not arrive at a
     WebView2-focused window. On Linux it does — `Ctrl+W` already closed a window
     there before this handler existed — and only one of the two layers answers a
     press, measured with two windows open. macOS never reaches it at all, the
     predefined item taking the key equivalent first. */
  useEffect(() => {
    const onKey = createCloseWindowChordHandler({
      onMac: onMacPlatform(),
      closeWindow: () => void closeWindow().catch((e) => console.error('Failed to close the window', e)),
    });
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
        setExplorerWidth(clampWidth(raw));
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
        covered={updater.flow.phase !== 'none'}
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
