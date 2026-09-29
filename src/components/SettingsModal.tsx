import { type RefObject, useId, useSyncExternalStore } from 'react';
import {
  type ColorFamily,
  FAMILIES,
  isOneSided,
  MODE_CHOICES,
  type ModeChoice,
  modeAvailable,
} from '../lib/color-choice';
import type { CustomEmojiStatus } from '../lib/custom-emoji';
import { LANGS, type Lang, useI18n } from '../lib/i18n';
import { broadcastSetting } from '../lib/settings-sync';
import { getColorChoice, onColorChoiceChange } from '../lib/theme';
import type { CheckState } from '../lib/update-flow';
import { chooseColorEverywhere, useFamilyLabel } from './color';
import { Modal } from './Modal';
import { Segmented } from './Segmented';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  onSideChange: (side: 'left' | 'right') => void;
  emoji: CustomEmojiStatus;
  onPickEmojiDir: () => void;
  onClearEmojiDir: () => void;
  /** Null only for the moment before the app version has been read. */
  runningVersion: string | null;
  autoCheckUpdates: boolean;
  onAutoCheckChange: (on: boolean) => void;
  updateCheck: CheckState;
  onCheckForUpdate: () => void;
  /** True while another dialog is painted over this modal. It then handles no
   *  Escape and takes no focus or clicks, so the dialog on top owns both:
   *  otherwise one Escape closes the two at once, and Tab reaches the controls
   *  behind the dialog — including the check that would supersede the very offer
   *  the dialog is asking about. `inert` carries the focus and pointer half; on a
   *  WebView old enough to ignore it the Escape guard still holds and only the
   *  Tab path degrades. */
  covered: boolean;
  /** Where the focus returns to when the modal was opened without a control
   *  holding it (a pointer press, the menu, the shortcut). */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function SettingsModal({
  open,
  onClose,
  side,
  onSideChange,
  emoji,
  onPickEmojiDir,
  onClearEmojiDir,
  runningVersion,
  autoCheckUpdates,
  onAutoCheckChange,
  updateCheck,
  onCheckForUpdate,
  covered,
  returnFocusTo,
}: SettingsModalProps) {
  const { t, lang, setLang } = useI18n();
  const familyLabel = useFamilyLabel();
  const { choice, unrecognized } = useSyncExternalStore(onColorChoiceChange, getColorChoice);
  const familyId = useId();
  const modeId = useId();
  const reasonId = useId();
  const oneSided = isOneSided(choice.family);

  /** The language is app-wide (TASK-12 puts a per-window one out of scope), so
   *  the windows already open have to follow. Sent from here rather than from
   *  `setLang` so that `lib/i18n` keeps no dependency on the Tauri layer. */
  const changeLang = (next: Lang) => {
    setLang(next);
    broadcastSetting({ key: 'lang', value: next });
  };

  if (!open) {
    return null;
  }

  return (
    <Modal title={t('settings')} onClose={onClose} covered={covered} returnFocusTo={returnFocusTo}>
      {/* Two selects, the family deciding which modes can be chosen
              (snz-design doc-9 §6.10). Choosing a family never rewrites the
              mode: a mode the family cannot draw stays selected, marked and
              disabled, with the reason beside it (snz-design doc-7 §4.2). */}
      <section className="settings-group">
        <h3 className="settings-group__label">{t('appearance')}</h3>
        <div className="settings-field">
          <label htmlFor={familyId}>{t('colorFamily')}</label>
          <select
            id={familyId}
            className="select"
            data-autofocus
            value={choice.family}
            onChange={(e) => chooseColorEverywhere({ family: e.target.value as ColorFamily })}
          >
            {FAMILIES.map((family) => (
              <option key={family} value={family}>
                {familyLabel(family)}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label htmlFor={modeId}>{t('colorMode')}</label>
          <select
            id={modeId}
            className="select"
            value={choice.mode}
            aria-describedby={oneSided ? reasonId : undefined}
            onChange={(e) => chooseColorEverywhere({ mode: e.target.value as ModeChoice })}
          >
            {MODE_CHOICES.map((mode) => {
              const available = modeAvailable(choice.family, mode);
              const label = t(`mode.${mode}`);
              return (
                <option key={mode} value={mode} disabled={!available}>
                  {available ? label : `${label} (${t('unavailable')})`}
                </option>
              );
            })}
          </select>
        </div>
        {oneSided && (
          <p id={reasonId} className="settings-group__hint">
            {t('modeOneSided', { family: familyLabel(choice.family) })}
          </p>
        )}
        {unrecognized && <p className="settings-group__hint">{t('colorUnrecognized')}</p>}
      </section>

      <section className="settings-group">
        <h3 className="settings-group__label">{t('explorerPosition')}</h3>
        <Segmented
          label={t('explorerPosition')}
          options={[
            { value: 'left', label: t('left') },
            { value: 'right', label: t('right') },
          ]}
          value={side}
          onSelect={onSideChange}
        />
      </section>

      <section className="settings-group">
        <h3 className="settings-group__label">{t('language')}</h3>
        <select
          className="select settings-group__select"
          aria-label={t('language')}
          value={lang}
          onChange={(e) => changeLang(e.target.value as Lang)}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
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

      <section className="settings-group">
        <h3 className="settings-group__label">{t('update')}</h3>
        <p className="settings-path">
          {runningVersion ? t('updateRunningVersion', { version: runningVersion }) : t('loading')}
        </p>
        <p className="settings-group__hint">{t('updateAutoCheck')}</p>
        <Segmented
          label={t('updateAutoCheck')}
          options={[
            { value: 'on', label: t('on') },
            { value: 'off', label: t('off') },
          ]}
          value={autoCheckUpdates ? 'on' : 'off'}
          onSelect={(next) => onAutoCheckChange(next === 'on')}
        />
        <p className="settings-group__hint">{t('updateAutoCheckHint')}</p>
        <div className="seg">
          <button type="button" className="btn" disabled={updateCheck.status === 'checking'} onClick={onCheckForUpdate}>
            {t('updateCheckNow')}
          </button>
        </div>
        {updateCheck.status === 'idle' ? null : (
          /* The failure text the plugin produced goes in `title` rather than on
                 screen: offline is the normal outcome here, and the sentence is what
                 the user acts on. The text is also logged. */
          <p
            className={`settings-group__hint${updateCheck.status === 'failed' ? ' is-error' : ''}`}
            title={updateCheck.status === 'failed' ? updateCheck.message : undefined}
          >
            {updateCheck.status === 'checking' ? t('updateChecking') : null}
            {updateCheck.status === 'upToDate' ? t('updateUpToDate') : null}
            {updateCheck.status === 'failed' ? t('updateCheckFailed') : null}
          </p>
        )}
      </section>
    </Modal>
  );
}
