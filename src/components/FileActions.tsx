import { copyText } from '../lib/codeblock';
import { useT } from '../lib/i18n';
import { relativePath } from '../lib/path';
import { openInDefaultApp, openInEditor, revealInOs } from '../lib/tauri';
import type { EditorInfo, FileEntry } from '../lib/types';

function revealManagerKey(): string {
  const p = navigator.platform.toLowerCase();
  if (p.includes('mac')) {
    return 'manager.finder';
  }
  if (p.includes('win')) {
    return 'manager.explorer';
  }
  return 'manager.fileManager';
}

// The legacy fallback inside `copyText` selects a textarea of its own, which
// takes the focus the menu has just given back to its row or trigger.
async function copyPath(text: string): Promise<void> {
  const back = document.activeElement;
  const ok = await copyText(text);
  if (back instanceof HTMLElement && back.isConnected && document.activeElement !== back) {
    back.focus();
  }
  if (!ok) {
    throw new Error('clipboard unavailable');
  }
}

function ActionItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="menu__item" role="menuitem" tabIndex={-1} onClick={onClick}>
      {label}
    </button>
  );
}

/** The items acting on one file or folder from outside mallow — the toolbar's
 *  Open menu and the explorer's context menu both render this, so the two
 *  cannot list different things.
 *
 *  `choose` closes the menu before the action runs (snz-design doc-9 §6.11). A
 *  folder is offered Reveal and the two copies only: `open_in_editor` hands any
 *  path to the editor as it is, and not every detected editor takes a folder,
 *  while the default app for a folder is the file manager Reveal already opens
 *  (TASK-50). */
export function FileActionItems({
  entry,
  rootDir,
  editors,
  choose,
}: {
  entry: FileEntry;
  rootDir: string | null;
  editors: EditorInfo[];
  choose: (action: () => Promise<void>) => void;
}) {
  const t = useT();
  const relative = rootDir ? relativePath(rootDir, entry.path) : null;
  const reveal = (
    <ActionItem
      label={t('revealIn', { manager: t(revealManagerKey()) })}
      onClick={() => choose(() => revealInOs(entry.path))}
    />
  );

  return (
    <>
      {entry.isDir ? (
        reveal
      ) : (
        <>
          {editors.length === 0 && <div className="menu__empty">{t('noEditors')}</div>}
          {editors.map((ed) => (
            <ActionItem
              key={ed.id}
              label={t('openIn', { editor: ed.label })}
              onClick={() => choose(() => openInEditor(ed.id, entry.path))}
            />
          ))}
          <div className="menu__sep" />
          {/* Named for what it does rather than for a browser: the OS handler
              registered for a kind is not always one, and resolving its display
              name costs a per-OS lookup for a word (decision-3). */}
          <ActionItem label={t('openDefaultApp')} onClick={() => choose(() => openInDefaultApp(entry.path))} />
          {reveal}
        </>
      )}
      <div className="menu__sep" />
      <ActionItem label={t('copyPath')} onClick={() => choose(() => copyPath(entry.path))} />
      {relative !== null && (
        <ActionItem label={t('copyRelativePath')} onClick={() => choose(() => copyPath(relative))} />
      )}
    </>
  );
}
