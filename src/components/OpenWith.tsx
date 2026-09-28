import { useEffect, useId, useState } from 'react';
import { useMenu } from '../hooks/useMenu';
import { useT } from '../lib/i18n';
import { detectEditors, openInDefaultApp, openInEditor, revealInOs } from '../lib/tauri';
import type { EditorInfo, FileEntry } from '../lib/types';
import { ShareIcon } from './icons';

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

export function OpenWith({ file }: { file: FileEntry | null }) {
  const t = useT();
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const disabled = !file;
  const menu = useMenu({ disabled });
  const reasonId = useId();

  useEffect(() => {
    detectEditors()
      .then(setEditors)
      .catch((e) => console.error('detectEditors failed', e));
  }, []);

  // Closed before the action runs, so the focus is back on the trigger by the
  // time anything the action opens takes it (snz-design doc-9 §6.11).
  function choose(action: (path: string) => Promise<void>) {
    menu.close(true);
    if (file) {
      void action(file.path).catch((e) => console.error(e));
    }
  }

  return (
    <div className="menu" ref={menu.rootRef}>
      {/* `aria-disabled` rather than `disabled`, so the trigger keeps the focus
          and its reason reaches the keyboard (snz-design doc-8 §5.4). */}
      <button
        type="button"
        className="icon-btn"
        title={disabled ? `${t('open')} — ${t('openNeedsFile')}` : t('open')}
        aria-label={t('open')}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled ? reasonId : undefined}
        {...menu.triggerProps}
      >
        <ShareIcon />
      </button>
      {disabled && (
        <span id={reasonId} className="visually-hidden">
          {t('openNeedsFile')}
        </span>
      )}
      {menu.open && (
        <div className="menu__popup" role="menu" aria-label={t('open')} {...menu.popupProps}>
          {editors.length === 0 && <div className="menu__empty">{t('noEditors')}</div>}
          {editors.map((ed) => (
            <button
              key={ed.id}
              type="button"
              className="menu__item"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choose((path) => openInEditor(ed.id, path))}
            >
              {t('openIn', { editor: ed.label })}
            </button>
          ))}
          <div className="menu__sep" />
          {/* Named for what it does rather than for a browser: the OS handler
              registered for a kind is not always one, and resolving its display
              name costs a per-OS lookup for a word (decision-3). */}
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            tabIndex={-1}
            onClick={() => choose(openInDefaultApp)}
          >
            {t('openDefaultApp')}
          </button>
          <button type="button" className="menu__item" role="menuitem" tabIndex={-1} onClick={() => choose(revealInOs)}>
            {t('revealIn', { manager: t(revealManagerKey()) })}
          </button>
        </div>
      )}
    </div>
  );
}
