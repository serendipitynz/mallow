import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detectEditors()
      .then(setEditors)
      .catch((e) => console.error('detectEditors failed', e));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const disabled = !file;

  function openIn(id: string) {
    if (file) {
      void openInEditor(id, file.path).catch((e) => console.error(e));
    }
    setOpen(false);
  }

  function reveal() {
    if (file) {
      void revealInOs(file.path).catch((e) => console.error(e));
    }
    setOpen(false);
  }

  function openDefault() {
    if (file) {
      void openInDefaultApp(file.path).catch((e) => console.error(e));
    }
    setOpen(false);
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        title={t('open')}
        aria-label={t('open')}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ShareIcon />
      </button>
      {open && !disabled && (
        <div className="menu__popup" role="menu">
          {editors.length === 0 && <div className="menu__empty">{t('noEditors')}</div>}
          {editors.map((ed) => (
            <button key={ed.id} type="button" className="menu__item" role="menuitem" onClick={() => openIn(ed.id)}>
              {t('openIn', { editor: ed.label })}
            </button>
          ))}
          <div className="menu__sep" />
          {/* Named for what it does rather than for a browser: the OS handler
              registered for a kind is not always one, and resolving its display
              name costs a per-OS lookup for a word (decision-3). */}
          <button type="button" className="menu__item" role="menuitem" onClick={openDefault}>
            {t('openDefaultApp')}
          </button>
          <button type="button" className="menu__item" role="menuitem" onClick={reveal}>
            {t('revealIn', { manager: t(revealManagerKey()) })}
          </button>
        </div>
      )}
    </div>
  );
}
