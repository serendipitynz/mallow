import { useId, useSyncExternalStore } from 'react';
import { useMenu } from '../hooks/useMenu';
import { isOneSided, MODE_CHOICES, type ModeChoice, modeAvailable } from '../lib/color-choice';
import { useT } from '../lib/i18n';
import { getColorChoice, onColorChoiceChange } from '../lib/theme';
import { chooseColorEverywhere, useFamilyLabel } from './color';
import { CheckIcon, MoonIcon, SunIcon, SunMoonIcon } from './icons';

const GLYPH: Record<ModeChoice, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  auto: SunMoonIcon,
};

/** Chooses the light / dark mode from the toolbar; the family is chosen in the
 *  settings modal, which carries both axes (snz-design doc-9 §6.11). */
export function ModeMenu() {
  const t = useT();
  const familyLabel = useFamilyLabel();
  // Subscribed rather than held locally: another window's choice arrives
  // through `lib/settings-sync` and lands here via `applyColorChoice`.
  const { choice } = useSyncExternalStore(onColorChoiceChange, getColorChoice);
  const menu = useMenu({ valueMenu: true });
  const reasonId = useId();
  const oneSided = isOneSided(choice.family);

  function pick(mode: ModeChoice) {
    // A disabled item keeps the menu open; its reason is on screen below the
    // items and tied to it for the keyboard (snz-design doc-8 §5.4).
    if (!modeAvailable(choice.family, mode)) {
      return;
    }
    menu.close(true);
    if (mode === choice.mode) {
      return;
    }
    chooseColorEverywhere({ mode });
  }

  return (
    <div className="menu" ref={menu.rootRef}>
      <button
        type="button"
        className="icon-btn"
        title={t('colorMode')}
        aria-label={t('colorMode')}
        {...menu.triggerProps}
      >
        <SunMoonIcon />
      </button>
      {menu.open && (
        <div className="menu__popup" role="menu" aria-label={t('colorMode')} {...menu.popupProps}>
          {MODE_CHOICES.map((mode) => {
            const Glyph = GLYPH[mode];
            const available = modeAvailable(choice.family, mode);
            // The mark stays on the stored mode even where the family cannot
            // draw it: the stored value is not rewritten, and the mark on a
            // disabled item is what tells the reader so (snz-design doc-7 §4.2).
            const current = mode === choice.mode;
            return (
              <button
                key={mode}
                type="button"
                className={`menu__item${current ? ' is-active' : ''}`}
                role="menuitemradio"
                tabIndex={-1}
                aria-checked={current}
                aria-disabled={available ? undefined : true}
                aria-describedby={available ? undefined : reasonId}
                onClick={() => pick(mode)}
              >
                <span className="menu__item-check">{current && <CheckIcon />}</span>
                <span className="menu__item-icon">
                  <Glyph />
                </span>
                {t(`mode.${mode}`)}
              </button>
            );
          })}
          {oneSided && (
            <p id={reasonId} className="menu__note">
              {t('modeOneSided', { family: familyLabel(choice.family) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
