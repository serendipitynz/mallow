/** A Marp deck rendered as slides (decision-18): Marpit on a second instance of
 *  mallow's own markdown-it, under the theme the deck names among mallow's slide
 *  theme and the folder themes (decision-19), with the deck's CSS walked by
 *  `lib/deck-css` before Marpit merges it. Pure, so the split, the directives and
 *  the notice are tested under Node. */
import { Marpit } from '@marp-team/marpit';
import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { walkDeckCss } from './deck-css';
import type { RefResolver } from './html-doc';
import { createMarkdownIt, getMarkdownConfigVersion, localImageSrc, resetHeadingState } from './markdown';
import { type DeckTheme, type DeckThemes, MALLOW_THEME, NO_DECK_THEMES } from './slide-themes';

/** Marp's own two sizes, in CSS pixels (decision-18 §4). */
export const DECK_SIZES = {
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 960, height: 720 },
} as const;

export type DeckSize = keyof typeof DECK_SIZES;

/** A Marp feature a deck uses that mallow draws differently from Marp, named in
 *  the notice above the slides (decision-18 §3). */
export type DeckFeature =
  | { kind: 'rawHtml' }
  /** The `math` directive only: a `$…$` in the text is not told apart from a
   *  price, so a deck relying on Marp Core's default math goes unnamed. */
  | { kind: 'math' }
  /** A theme name mallow does not hold, and the theme drawn instead. */
  | { kind: 'theme'; name: string; drawn: string }
  /** A size the drawn theme has no entry for, drawn at the theme's own size. */
  | { kind: 'size'; value: string }
  | { kind: 'fit' }
  | { kind: 'cssAtRule'; name: string }
  | { kind: 'cssAssetUrl' }
  /** CSS postcss could not parse, dropped whole. */
  | { kind: 'cssUnparsed' };

export interface DeckResult {
  /** One HTML string per slide, each Marpit's inline SVG; wrap them in
   *  `div.marpit`, the container the CSS is scoped to. */
  slides: string[];
  css: string;
  /** The theme drawn. */
  theme: string;
  /** The size entry drawn, or `null` for a theme drawn at its own `section`
   *  size; mallow's slide theme always draws one of `DECK_SIZES`. */
  size: string | null;
  unsupported: DeckFeature[];
}

export interface DeckOptions {
  /** How an image path relative to the document becomes a loadable URL, for
   *  `![](…)`, `![bg](…)` and every URL in the deck's CSS alike. */
  images?: RefResolver;
  /** The folder themes and the default-theme preference; mallow's slide theme
   *  alone when absent. Renderers are cached per value, so pass the same object
   *  while the set is unchanged. */
  themes?: DeckThemes;
}

/** What one render records while Marpit runs, which its directive parsers have
 *  no `env` to carry. A render is synchronous, so one record per instance holds. */
interface RenderRecord {
  images: RefResolver | undefined;
  /** Theme names the deck asked for that the set does not hold. */
  unknownThemes: Set<string>;
  size: string | null;
  math: boolean;
  rawHtml: boolean;
  fit: boolean;
  atRules: Set<string>;
  assetUrls: number;
  unparsedCss: boolean;
}

function emptyRecord(images: RefResolver | undefined): RenderRecord {
  return {
    images,
    unknownThemes: new Set(),
    size: null,
    math: false,
    rawHtml: false,
    fit: false,
    atRules: new Set(),
    assetUrls: 0,
    unparsedCss: false,
  };
}

/** Exposes the directives Marpit keeps protected, which the CSS walk has to
 *  reach between the directive parse and the style merge. */
class DeckMarpit extends Marpit {
  get globalDirectives(): Record<string, unknown> | undefined {
    return this.lastGlobalDirectives;
  }
}

interface DeckRenderer {
  marpit: DeckMarpit;
  record: RenderRecord;
}

/** mallow's slide theme (decision-18 §5): the colours are the preview's own
 *  custom properties, so a deck follows the colour family and Light / Dark as a
 *  document does. `lead` and `invert` are the two classes Marp's themes give real
 *  decks. Selectors here are scoped to the slide by Marpit, `section` being the
 *  slide itself. */
export function slideTheme(size: DeckSize): string {
  const { width, height } = DECK_SIZES[size];
  return `/* @theme default */
section {
  width: ${width}px;
  height: ${height}px;
  box-sizing: border-box;
  padding: 72px 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 32px;
  line-height: 1.5;
  background: var(--color-bg);
  color: var(--color-ink);
}
section > :first-child { margin-top: 0; }
section > :last-child { margin-bottom: 0; }
h1, h2, h3, h4, h5, h6 { color: var(--color-ink-strong); line-height: 1.25; margin: 0.5em 0 0.4em; }
h1 { font-size: 1.8em; }
h2 { font-size: 1.45em; }
h3 { font-size: 1.2em; }
h4, h5, h6 { font-size: 1em; }
p, ul, ol, blockquote, pre, table { margin: 0.5em 0; }
a { color: var(--color-link); }
strong { color: var(--color-ink-strong); }
img { max-width: 100%; }
blockquote { padding: 0 1em; border-left: 0.2em solid var(--color-border-strong); color: var(--color-muted); }
code { font-family: var(--slide-font-mono); font-size: 0.85em; padding: 0.1em 0.3em; border-radius: 4px; background: var(--color-surface-nested); }
pre { font-size: 0.7em; line-height: 1.45; padding: 0.8em 1em; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); overflow: hidden; }
pre code { padding: 0; background: none; font-size: 1em; }
table { border-collapse: collapse; font-size: 0.8em; }
th, td { border: 1px solid var(--color-border); padding: 0.3em 0.7em; }
th { background: var(--color-surface-raised); }
header, footer { position: absolute; left: 88px; right: 88px; font-size: 18px; color: var(--color-muted); }
header { top: 28px; }
footer { bottom: 28px; }
section::after { font-size: 18px; color: var(--color-muted); padding: 28px 40px; }
section.lead { text-align: center; align-items: center; }
section.invert { background: var(--color-ink); color: var(--color-bg); }
section.invert h1, section.invert h2, section.invert h3, section.invert h4, section.invert h5, section.invert h6, section.invert strong { color: var(--color-bg); }
section.invert header, section.invert footer, section.invert::after { color: var(--color-bg); }
`;
}

/** A theme's CSS for one size: its `@size` entry of that name laid over its own
 *  `section` size, as `:root` so it outranks a size the theme wrote on `:root`
 *  itself, both in Marpit's size detection and in the cascade. The values are
 *  lengths `readThemeMeta` checked, so nothing else reaches the CSS. */
function themeCss(theme: DeckTheme, size: string | null): string {
  const entry = size === null ? undefined : theme.sizes[size];
  return entry ? `${theme.css}\n:root { width: ${entry.width}; height: ${entry.height}; }\n` : theme.css;
}

function hasSizeEntry(theme: DeckTheme | undefined, size: string): boolean {
  return theme ? size in theme.sizes : size in DECK_SIZES;
}

function createRenderer(md: MarkdownIt, set: DeckThemes, size: string | null): DeckRenderer {
  const record = emptyRecord(undefined);
  const marpit = new DeckMarpit({
    markdown: md,
    inlineSVG: true,
    looseYAML: true,
    // Marpit's print CSS carries `@page` and rules on `html, body`, which would
    // reach the app document rather than the slides.
    printable: false,
  });
  const mallowTheme = marpit.themeSet.add(
    slideTheme(size !== null && size in DECK_SIZES ? (size as DeckSize) : '16:9'),
  );
  marpit.themeSet.default = mallowTheme;
  for (const theme of set.themes) {
    const added = marpit.themeSet.add(themeCss(theme, size));
    if (theme.name === set.defaultName) {
      marpit.themeSet.default = added;
    }
  }
  /* A theme name the set does not hold is recorded here, because Marpit drops
     it silently and draws the default instead (decision-19 §2) — so the name is
     gone from the directives by the time anything could read it. Only the
     directive parser asks `has`. */
  const has = marpit.themeSet.has.bind(marpit.themeSet);
  marpit.themeSet.has = (name: string) => {
    const held = has(name);
    if (!held) {
      record.unknownThemes.add(name);
    }
    return held;
  };
  marpit.customDirectives.global.size = (value) => {
    record.size = String(value);
    return {};
  };
  marpit.customDirectives.global.math = (value) => {
    // A YAML `false` arrives as the boolean, a looser spelling as the string.
    record.math = String(value) !== 'false';
    return {};
  };
  md.inline.ruler2.before('marpit_parse_image', 'mallow_deck_images', (state: StateInline) => {
    for (const token of state.tokens) {
      if (token.type === 'image') {
        // Emptied rather than removed when refused: Marpit's image parse reads
        // `src` unconditionally, and an empty URL fetches nothing.
        const src = token.attrGet('src') ?? '';
        token.attrSet('src', localImageSrc(src, record.images) ?? '');
      }
    }
    return true;
  });
  md.core.ruler.after('inline', 'mallow_deck_features', (state: StateCore) => {
    for (const token of state.tokens) {
      noteFeatures(token, record);
      for (const child of token.children ?? []) {
        noteFeatures(child, record);
      }
    }
    return true;
  });
  // After the directives are parsed and before `marpit_style_assign` merges the
  // deck's CSS with the theme, so the walk sees the deck's own CSS and nothing
  // else (decision-18 §6).
  md.core.ruler.before('marpit_style_assign', 'mallow_deck_css', (state: StateCore) => {
    if (state.inlineMode) {
      return true;
    }
    for (const token of state.tokens) {
      if (token.type === 'marpit_style') {
        token.content = walk(token.content, record);
      }
    }
    const globals = marpit.globalDirectives;
    if (globals && typeof globals.style === 'string') {
      globals.style = walk(globals.style, record);
    }
    return true;
  });
  return { marpit, record };
}

function walk(css: string, record: RenderRecord): string {
  const result = walkDeckCss(css, record.images);
  for (const name of result.removedAtRules) {
    record.atRules.add(name);
  }
  record.assetUrls += result.refusedAssetUrls;
  record.unparsedCss ||= result.unparsed;
  return result.css;
}

/** An open or a closing tag as CommonMark defines one (§6.6), the shape
 *  markdown-it's own HTML rules recognise. Written here rather than imported
 *  from markdown-it's `lib/common/html_re.mjs`, which is not its public API: a
 *  patch release moving that file would break every deck render. Comments and
 *  declarations are left out, since Marpit takes comments as directives and
 *  notes. */
const ATTRIBUTE = `\\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?`;
const HTML_TAG = new RegExp(`^(?:<[A-Za-z][A-Za-z0-9-]*(?:${ATTRIBUTE})*\\s*\\/?>|<\\/[A-Za-z][A-Za-z0-9-]*\\s*>)`);

/** Raw HTML is noted where markdown-it's own HTML rules would have recognised a
 *  tag, so a `<` in prose (`a < b`) is not mistaken for one; an escaped `\<` is a
 *  token of its own and never matches. `<!-- fit -->` is the one comment Marp
 *  reads as an instruction rather than a note. */
function noteFeatures(token: Token, record: RenderRecord): void {
  if (token.type === 'text' && !record.rawHtml) {
    const text = token.content;
    for (let at = text.indexOf('<'); at !== -1; at = text.indexOf('<', at + 1)) {
      if (HTML_TAG.test(text.slice(at))) {
        record.rawHtml = true;
        break;
      }
    }
  } else if (token.type === 'marpit_comment' && token.content.trim() === 'fit') {
    record.fit = true;
  }
}

let renderers: { version: number; set: DeckThemes; bySize: Map<string | null, Promise<DeckRenderer>> } | null = null;

/** One renderer per size, each on an instance of its own: Marpit installs its
 *  plugins into the instance it is handed, and the preview's must stay as it is.
 *  Rebuilt when the pipeline is reconfigured (custom emoji), as the preview's is,
 *  and when the theme set is a different one. `null` is every theme at its own
 *  size. */
function getRenderer(set: DeckThemes, size: string | null): Promise<DeckRenderer> {
  const version = getMarkdownConfigVersion();
  if (renderers?.version !== version || renderers.set !== set) {
    renderers = { version, set, bySize: new Map() };
  }
  const existing = renderers.bySize.get(size);
  if (existing) {
    return existing;
  }
  const created = createMarkdownIt({ localImageRule: false }).then((md) => createRenderer(md, set, size));
  renderers.bySize.set(size, created);
  return created;
}

function renderWith(renderer: DeckRenderer, source: string, options: DeckOptions) {
  Object.assign(renderer.record, emptyRecord(options.images));
  resetHeadingState();
  const { html, css } = renderer.marpit.render(source, { htmlAsArray: true });
  const named = renderer.marpit.globalDirectives?.theme;
  const theme = typeof named === 'string' ? named : (renderer.marpit.themeSet.default?.name ?? MALLOW_THEME);
  return { slides: html, css, theme, record: renderer.record };
}

const corrected = new WeakMap<DeckThemes, DeckThemes>();

/** The set as given, with a default name the set does not hold put back to
 *  mallow's slide theme, so the theme Marpit draws and the one reported agree.
 *  The correction is kept per set, since the renderer cache keys on identity. */
function usableSet(set: DeckThemes | undefined): DeckThemes {
  if (!set) {
    return NO_DECK_THEMES;
  }
  if (set.defaultName === MALLOW_THEME || set.themes.some((theme) => theme.name === set.defaultName)) {
    return set;
  }
  let fixed = corrected.get(set);
  if (!fixed) {
    fixed = { themes: set.themes, defaultName: MALLOW_THEME };
    corrected.set(set, fixed);
  }
  return fixed;
}

/** Render a deck. The size and the theme are global directives that can sit
 *  anywhere in the deck, so both are known only after a render: a deck whose
 *  theme has an entry for its size is rendered once more with the renderer whose
 *  themes carry that size (decision-19 §6). */
export async function renderDeck(source: string, options: DeckOptions = {}): Promise<DeckResult> {
  const themes = usableSet(options.themes);
  let rendered = renderWith(await getRenderer(themes, null), source, options);
  const asked = rendered.record.size;
  const drawn = themes.themes.find((theme) => theme.name === rendered.theme);
  let size: string | null = drawn ? null : '16:9';
  if (asked !== null && hasSizeEntry(drawn, asked)) {
    size = asked;
    if (drawn || asked !== '16:9') {
      rendered = renderWith(await getRenderer(themes, asked), source, options);
    }
  }
  return {
    slides: rendered.slides,
    css: rendered.css,
    theme: rendered.theme,
    size,
    unsupported: unsupportedFeatures(rendered.record, rendered.theme, asked !== null && !hasSizeEntry(drawn, asked)),
  };
}

function unsupportedFeatures(record: RenderRecord, drawn: string, sizeMissing: boolean): DeckFeature[] {
  const out: DeckFeature[] = [];
  if (record.rawHtml) {
    out.push({ kind: 'rawHtml' });
  }
  if (record.math) {
    out.push({ kind: 'math' });
  }
  for (const name of record.unknownThemes) {
    out.push({ kind: 'theme', name, drawn });
  }
  if (sizeMissing && record.size !== null) {
    out.push({ kind: 'size', value: record.size });
  }
  if (record.fit) {
    out.push({ kind: 'fit' });
  }
  for (const name of record.atRules) {
    out.push({ kind: 'cssAtRule', name });
  }
  if (record.assetUrls > 0) {
    out.push({ kind: 'cssAssetUrl' });
  }
  if (record.unparsedCss) {
    out.push({ kind: 'cssUnparsed' });
  }
  return out;
}
