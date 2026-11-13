/** mallow's copy of a kinari release (decision-19 §7), as `lib/deck` registers
 *  it. The copy is the release's file byte for byte (`node scripts/kinari.mjs
 *  verify`), so how kinari draws is changed in the kinari repository and never
 *  here, and its sizes are read from its own `@size` comments rather than
 *  written a second time. Not walked: it is the app's own CSS (§4). */
import css from '../slide-themes/kinari.css?raw';
import { readThemeMeta } from './slide-theme-css';
import { type DeckTheme, KINARI_THEME } from './slide-themes';

export const KINARI: DeckTheme = Object.freeze({
  name: KINARI_THEME,
  css,
  sizes: readThemeMeta(css)?.sizes ?? Object.create(null),
});
