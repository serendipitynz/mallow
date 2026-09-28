/**
 * The two colour axes the reader chooses — a family and a light / dark mode —
 * and the scheme they draw (snz-design doc-7 §4). Pure, so the rule is testable
 * under Node; `lib/theme` holds the DOM and storage half.
 *
 * **index.html carries a copy of `readChoice` and `drawnMode`**, because it runs
 * before any module is loaded; keep the two in step.
 */

export type ColorFamily = 'standard' | 'solarized' | 'dracula' | 'nord';
export type ModeChoice = 'light' | 'dark' | 'auto';
export type Resolved = 'light' | 'dark';

export interface ColorChoice {
  family: ColorFamily;
  mode: ModeChoice;
}

export const FAMILIES: readonly ColorFamily[] = ['standard', 'solarized', 'dracula', 'nord'];
export const MODE_CHOICES: readonly ModeChoice[] = ['light', 'dark', 'auto'];

/** localStorage keys. `theme` is the single value from before the split, read as
 *  a fallback and never written again (snz-design doc-7 §6.1). */
export const FAMILY_KEY = 'colorFamily';
export const MODE_KEY = 'colorMode';
export const LEGACY_KEY = 'theme';

export const INITIAL_CHOICE: ColorChoice = { family: 'standard', mode: 'auto' };

const SIDES: Record<ColorFamily, readonly Resolved[]> = {
  standard: ['light', 'dark'],
  solarized: ['light', 'dark'],
  dracula: ['dark'],
  nord: ['dark'],
};

/** Following the OS is offered only where the family has both sides: on a
 *  one-sided family it would let the reader build a pair that does not exist
 *  (snz-design doc-7 §4.2). */
export function modeAvailable(family: ColorFamily, mode: ModeChoice): boolean {
  if (mode === 'auto') {
    return SIDES[family].length === 2;
  }
  return SIDES[family].includes(mode);
}

export function isOneSided(family: ColorFamily): boolean {
  return SIDES[family].length === 1;
}

const LEGACY = new Map<string, ColorChoice>([
  ['auto', { family: 'standard', mode: 'auto' }],
  ['light', { family: 'standard', mode: 'light' }],
  ['dark', { family: 'standard', mode: 'dark' }],
  ['solarized-light', { family: 'solarized', mode: 'light' }],
  ['solarized-dark', { family: 'solarized', mode: 'dark' }],
  ['dracula', { family: 'dracula', mode: 'dark' }],
  ['nord', { family: 'nord', mode: 'dark' }],
]);

export interface StoredColor {
  legacy: string | null;
  family: string | null;
  mode: string | null;
}

export interface ReadChoice {
  choice: ColorChoice;
  /** A stored value this version does not know, drawn as the initial choice and
   *  left in place (snz-design doc-7 §5.1). */
  unrecognized: boolean;
}

function isFamily(value: string): value is ColorFamily {
  return FAMILIES.some((f) => f === value);
}

function isModeChoice(value: string): value is ModeChoice {
  return MODE_CHOICES.some((m) => m === value);
}

/** The reader's choice from what is stored. An axis with no key of its own is
 *  read from the pre-split value — which is also what the other axis was drawn
 *  from, so writing only the chosen axis's key never changes the one not chosen.
 *
 *  Each axis is judged on its own before any pair is: judging the pair first
 *  would send a carried-over Dracula + auto to the initial choice
 *  (snz-design doc-7 §4.3). */
export function readChoice(stored: StoredColor): ReadChoice {
  const legacy = stored.legacy === null ? INITIAL_CHOICE : (LEGACY.get(stored.legacy) ?? null);
  // An unknown pre-split value was drawn as the initial choice, so that is what
  // an axis without its own key falls back to.
  const base = legacy ?? INITIAL_CHOICE;
  const family = stored.family ?? base.family;
  const mode = stored.mode ?? base.mode;
  if (!isFamily(family) || !isModeChoice(mode)) {
    return { choice: INITIAL_CHOICE, unrecognized: true };
  }
  const legacyConsulted = stored.family === null || stored.mode === null;
  return { choice: { family, mode }, unrecognized: legacyConsulted && legacy === null };
}

/** The side drawn. A mode the family does not carry falls to the side it does,
 *  without the stored mode being rewritten, so returning to a two-sided family
 *  brings the reader's mode back (snz-design doc-7 §4.2). */
export function drawnMode(choice: ColorChoice, osDark: boolean): Resolved {
  const sides = SIDES[choice.family];
  const wanted: Resolved = choice.mode === 'auto' ? (osDark ? 'dark' : 'light') : choice.mode;
  return sides.includes(wanted) ? wanted : sides[0];
}
