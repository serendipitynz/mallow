import { useEffect } from 'react';
import type { CustomEmojiStatus } from '../lib/custom-emoji';
import { LANGS, useI18n } from '../lib/i18n';
import { CloseIcon } from './icons';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  onSideChange: (side: 'left' | 'right') => void;
  emoji: CustomEmojiStatus;
  onPickEmojiDir: () => void;
  onClearEmojiDir: () => void;
}

export function SettingsModal({
  open,
  onClose,
  side,
  onSideChange,
  emoji,
  onPickEmojiDir,
  onClearEmojiDir,
}: SettingsModalProps) {
  const { t, lang, setLang } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: the overlay is a click-outside target,
       not a control. Closing is also reachable by Escape (the effect above) and by the close
       button below, so the backdrop is not the only path to it. */
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('settings')}>
        <div className="modal__header">
          <h2 className="modal__title">{t('settings')}</h2>
          <button type="button" className="icon-btn" title={t('close')} aria-label={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body">
          <section className="settings-group">
            <h3 className="settings-group__label">{t('explorerPosition')}</h3>
            {/* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
                button cluster. The semantic alternative, <fieldset>, is for form controls and
                requires a <legend>; the label is already carried by aria-label and the <h3>. */}
            <div className="seg" role="group" aria-label={t('explorerPosition')}>
              <button
                type="button"
                className={`btn${side === 'left' ? ' is-active' : ''}`}
                aria-pressed={side === 'left'}
                onClick={() => onSideChange('left')}
              >
                {t('left')}
              </button>
              <button
                type="button"
                className={`btn${side === 'right' ? ' is-active' : ''}`}
                aria-pressed={side === 'right'}
                onClick={() => onSideChange('right')}
              >
                {t('right')}
              </button>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group__label">{t('language')}</h3>
            {/* biome-ignore lint/a11y/useSemanticElements: see the explorer-position group above. */}
            <div className="seg" role="group" aria-label={t('language')}>
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`btn${lang === l.id ? ' is-active' : ''}`}
                  aria-pressed={lang === l.id}
                  onClick={() => setLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group__label">{t('customEmoji')}</h3>
            <p className="settings-group__hint">{t('customEmojiHint')}</p>
            <p className="settings-path" title={emoji.dir ?? undefined}>
              {emoji.dir ?? t('customEmojiUnset')}
            </p>
            <div className="seg">
              <button type="button" className="btn" onClick={onPickEmojiDir}>
                {t('chooseFolder')}
              </button>
              <button type="button" className="btn" disabled={!emoji.dir} onClick={onClearEmojiDir}>
                {t('clear')}
              </button>
            </div>
            {emoji.dir ? (
              <p className={`settings-group__hint${emoji.error ? ' is-error' : ''}`}>
                {emoji.error ? t('customEmojiFailed') : t('customEmojiLoaded', { n: emoji.count })}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
