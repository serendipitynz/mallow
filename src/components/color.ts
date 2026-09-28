import type { ColorChoice, ColorFamily } from '../lib/color-choice';
import { useT } from '../lib/i18n';
import { broadcastSetting } from '../lib/settings-sync';
import { chooseColor } from '../lib/theme';

/** Persist and apply the reader's choice, and tell the windows already open:
 *  the choice is app-wide (TASK-12 puts a per-window one out of scope). Sent from
 *  here rather than from `lib/theme` so that module keeps no dependency on the
 *  Tauri layer. */
export function chooseColorEverywhere(change: Partial<ColorChoice>): void {
  const written = chooseColor(change);
  if (written.family !== undefined) {
    broadcastSetting({ key: 'colorFamily', value: written.family });
  }
  if (written.mode !== undefined) {
    broadcastSetting({ key: 'colorMode', value: written.mode });
  }
}

// Proper-noun palette names are not translated.
const PROPER: Partial<Record<ColorFamily, string>> = {
  solarized: 'Solarized',
  dracula: 'Dracula',
  nord: 'Nord',
};

export function useFamilyLabel(): (family: ColorFamily) => string {
  const t = useT();
  return (family) => PROPER[family] ?? t(`family.${family}`);
}
