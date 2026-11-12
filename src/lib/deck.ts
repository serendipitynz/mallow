/** A Marp deck rendered as slides (decision-18): Marpit on a second instance of
 *  mallow's own markdown-it, under mallow's one slide theme, with the deck's CSS
 *  walked by `lib/deck-css` before Marpit merges it. Pure, so the split, the
 *  directives and the notice are tested under Node. */
import { Marpit } from '@marp-team/marpit';
import type MarkdownIt from 'markdown-it';
import { HTML_TAG_RE } from 'markdown-it/lib/common/html_re.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { walkDeckCss } from './deck-css';
import type { RefResolver } from './html-doc';
import { createMarkdownIt, getMarkdownConfigVersion, localImageSrc } from './markdown';

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
  | { kind: 'math' }
  | { kind: 'theme'; name: string }
  | { kind: 'size'; value: string }
  | { kind: 'fit' }
  | { kind: 'cssAtRule'; name: string }
  | { kind: 'cssAssetUrl' };

export interface DeckResult {
  /** One HTML string per slide, each Marpit's inline SVG; wrap them in
   *  `div.marpit`, the container the CSS is scoped to. */
  slides: string[];
  css: string;
  size: DeckSize;
  unsupported: DeckFeature[];
}

export interface DeckOptions {
  /** How an image path relative to the document becomes a loadable URL, for
   *  `![](…)`, `![bg](…)` and every URL in the deck's CSS alike. */
  images?: RefResolver;
}

/** What one render records while Marpit runs, which its directive parsers have
 *  no `env` to carry. A render is synchronous, so one record per instance holds. */
interface RenderRecord {
  images: RefResolver | undefined;
  themes: Set<string>;
  size: string | null;
  math: boolean;
  rawHtml: boolean;
  fit: boolean;
  atRules: Set<string>;
  assetUrls: number;
}

function emptyRecord(images: RefResolver | undefined): RenderRecord {
  return {
    images,
    themes: new Set(),
    size: null,
    math: false,
    rawHtml: false,
    fit: false,
    atRules: new Set(),
    assetUrls: 0,
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

function createRenderer(md: MarkdownIt, size: DeckSize): DeckRenderer {
  const record = emptyRecord(undefined);
  const marpit = new DeckMarpit({
    markdown: md,
    inlineSVG: true,
    looseYAML: true,
    // Marpit's print CSS carries `@page` and rules on `html, body`, which would
    // reach the app document rather than the slides.
    printable: false,
  });
  const theme = marpit.themeSet.add(slideTheme(size));
  marpit.themeSet.default = theme;
  /* Every theme name a deck asks for is recorded here, because Marpit drops an
     unknown one silently and draws the default instead (decision-18 §5) — so the
     name is gone from the directives by the time anything could read it. Only
     the directive parser asks `has`. */
  const has = marpit.themeSet.has.bind(marpit.themeSet);
  marpit.themeSet.has = (name: string) => {
    record.themes.add(name);
    return has(name);
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
  return result.css;
}

/** Raw HTML is noted where markdown-it's own HTML rules would have recognised a
 *  tag, so a `<` in prose (`a < b`) is not mistaken for one; an escaped `\<` is a
 *  token of its own and never matches. `<!-- fit -->` is the one comment Marp
 *  reads as an instruction rather than a note. */
function noteFeatures(token: Token, record: RenderRecord): void {
  if (token.type === 'text' && !record.rawHtml) {
    const text = token.content;
    for (let at = text.indexOf('<'); at !== -1; at = text.indexOf('<', at + 1)) {
      if (HTML_TAG_RE.test(text.slice(at))) {
        record.rawHtml = true;
        break;
      }
    }
  } else if (token.type === 'marpit_comment' && token.content.trim() === 'fit') {
    record.fit = true;
  }
}

let renderers: { version: number; bySize: Partial<Record<DeckSize, Promise<DeckRenderer>>> } | null = null;

/** One renderer per size, each on an instance of its own: Marpit installs its
 *  plugins into the instance it is handed, and the preview's must stay as it is.
 *  Rebuilt when the pipeline is reconfigured (custom emoji), as the preview's is. */
function getRenderer(size: DeckSize): Promise<DeckRenderer> {
  const version = getMarkdownConfigVersion();
  if (renderers?.version !== version) {
    renderers = { version, bySize: {} };
  }
  const existing = renderers.bySize[size];
  if (existing) {
    return existing;
  }
  const created = createMarkdownIt({ localImageRule: false }).then((md) => createRenderer(md, size));
  renderers.bySize[size] = created;
  return created;
}

function renderWith(renderer: DeckRenderer, source: string, options: DeckOptions) {
  Object.assign(renderer.record, emptyRecord(options.images));
  const { html, css } = renderer.marpit.render(source, { htmlAsArray: true });
  return { slides: html, css, record: renderer.record };
}

/** Render a deck. The size is a global directive that can sit anywhere in the
 *  deck, so it is known only after a render: a `4:3` deck is rendered once more
 *  with the renderer whose theme carries that size. */
export async function renderDeck(source: string, options: DeckOptions = {}): Promise<DeckResult> {
  let size: DeckSize = '16:9';
  let rendered = renderWith(await getRenderer(size), source, options);
  if (rendered.record.size === '4:3') {
    size = '4:3';
    rendered = renderWith(await getRenderer(size), source, options);
  }
  return { slides: rendered.slides, css: rendered.css, size, unsupported: unsupportedFeatures(rendered.record) };
}

function unsupportedFeatures(record: RenderRecord): DeckFeature[] {
  const out: DeckFeature[] = [];
  if (record.rawHtml) {
    out.push({ kind: 'rawHtml' });
  }
  if (record.math) {
    out.push({ kind: 'math' });
  }
  for (const name of record.themes) {
    if (name !== 'default') {
      out.push({ kind: 'theme', name });
    }
  }
  if (record.size !== null && !(record.size in DECK_SIZES)) {
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
  return out;
}
