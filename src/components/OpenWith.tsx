import { useId } from 'react';
import { useEditors } from '../hooks/useEditors';
import { useMenu } from '../hooks/useMenu';
import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { FileActionItems } from './FileActions';
import { ShareIcon } from './icons';

export function OpenWith({ file, rootDir }: { file: FileEntry | null; rootDir: string | null }) {
  const t = useT();
  const editors = useEditors();
  const disabled = !file;
  const menu = useMenu({ disabled });
  const reasonId = useId();

  // Closed before the action runs, so the focus is back on the trigger by the
  // time anything the action opens takes it (snz-design doc-9 §6.11).
  function choose(action: () => Promise<void>) {
    menu.close(true);
    void action().catch((e) => console.error(e));
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
      {menu.open && file && (
        <div className="menu__popup" role="menu" aria-label={t('open')} {...menu.popupProps}>
          <FileActionItems entry={file} rootDir={rootDir} editors={editors} choose={choose} />
        </div>
      )}
    </div>
  );
}
