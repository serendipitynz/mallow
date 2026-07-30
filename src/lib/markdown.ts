/**
 * Runtime markdown pipeline. markdown-it + Shiki (dual theme) + emoji + GitHub
 * alerts + heading anchors, plus a mermaid fence rewrite and GFM task lists.
 * Returns the HTML and a flat heading list for the outline.
 */
import { fromHighlighter } from '@shikijs/markdown-it/core';
import type { BundledLanguage } from 'shiki';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { full as emoji } from 'markdown-it-emoji';
import builtinEmojiDefs from 'markdown-it-emoji/lib/data/full.mjs';
import githubAlerts from 'markdown-it-github-alerts';
import { extractFrontMatter, renderFrontMatterTable } from './frontmatter';
import { getHighlighter, SHIKI_THEMES, stripPreBackground } from './shiki';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

/**
 * A user-supplied set of extra `:shortcode:` definitions, already resolved by
 * the caller (`lib/custom-emoji`) — this module stays free of Tauri APIs so it
 * remains unit-testable in a plain Node environment.
 */
export interface CustomEmojiSet {
  /** shortcode -> the character(s) to substitute. */
  unicode: Record<string, string>;
  /** shortcode -> a ready-to-use image URL (`asset:` in the app). */
  images: Record<string, string>;
}

const EMPTY_EMOJI: CustomEmojiSet = { unicode: {}, images: {} };
let customEmoji: CustomEmojiSet = EMPTY_EMOJI;

// Bumped whenever the pipeline's configuration changes, so mounted views can
// re-render a document that is already open instead of waiting to be reopened.
let configVersion = 0;
const configListeners = new Set<() => void>();

/** Subscribe to pipeline-configuration changes (for `useSyncExternalStore`). */
export function subscribeMarkdownConfig(listener: () => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

/** Current configuration revision; changes when `setCustomEmoji` takes effect. */
export function getMarkdownConfigVersion(): number {
  return configVersion;
}

/**
 * Install (or, with `null`, remove) the user's custom emoji set. Discards the
 * cached MarkdownIt instance because the shortcode table is compiled into a
 * regexp when the plugin is registered, so it cannot be swapped in place.
 */
export function setCustomEmoji(set: CustomEmojiSet | null): void {
  customEmoji = set ?? EMPTY_EMOJI;
  mdPromise = null;
  configVersion += 1;
  for (const listener of configListeners) listener();
}

// GitHub-compatible, deduplicating slugs (same library Astro uses). Reset before
// each render so slug counters start fresh per document.
const slugger = new GithubSlugger();
// Filled by the anchor plugin's callback during a (synchronous) render.
let headingSink: Heading[] = [];

/**
 * Rewrite ```mermaid fenced blocks into `<pre class="mermaid">` so Shiki leaves
 * them alone and the client renderer (lib/mermaid.ts) can pick them up.
 */
function mermaidFence(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim().toLowerCase() === 'mermaid') {
      return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
}

/** `- [ ] ` / `- [x] ` at the very start of a list item's first paragraph.
 *  GFM allows any whitespace (not just a space) between the brackets. */
const TASK_MARKER = /^\[([ \txX])\][ \t]+/;

/**
 * Plain text of an inline token's children, for the checkbox's accessible name.
 * markdown-it keeps inline children flat, so a link contributes its text token
 * here while `link_open` / `link_close` contribute nothing — the name reads as
 * the item does, without the URL. `image` carries its alt text in `content`.
 */
function inlineText(children: { type: string; content: string }[]): string {
  let out = '';
  for (const child of children) {
    if (child.type === 'text' || child.type === 'code_inline' || child.type === 'image' || child.type === 'emoji') {
      out += child.content;
    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      out += ' ';
    }
  }
  return out.trim();
}

/**
 * GFM task lists (`- [ ] todo` / `- [x] done`) as disabled checkboxes.
 *
 * Hand-rolled instead of pulling in markdown-it-task-lists: the whole plugin is
 * this one core rule, and mallow is a read-only viewer so none of that package's
 * interactive/label options apply. The checkbox is emitted as an `html_inline`
 * token, which the *renderer* always passes through — `html: false` only governs
 * raw HTML in the source, so the untrusted-input boundary is unaffected.
 */
function taskLists(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'task-lists', (state) => {
    const tokens = state.tokens;
    // Enclosing list tokens, so the checkbox marker can be suppressed on the
    // right `<ul>`/`<ol>` only.
    const listStack: (typeof tokens)[number][] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        listStack.push(token);
        continue;
      }
      if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
        listStack.pop();
        continue;
      }
      if (token.type !== 'inline' || i < 2) continue;
      if (tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;

      // Match on the first child rather than `inline.content` so a marker that
      // inline parsing already turned into something else (a link, emphasis) is
      // left alone.
      const first = token.children?.[0];
      if (!first || first.type !== 'text') continue;
      const match = TASK_MARKER.exec(first.content);
      if (!match) continue;

      first.content = first.content.slice(match[0].length);
      token.content = token.content.slice(match[0].length);

      // Name the checkbox after the item's own text. A generic name ("Completed
      // task") would announce the state without saying which task it belongs to,
      // and it would need the UI language plumbed into what is otherwise a pure,
      // i18n-free module. `aria-label` rather than a wrapping `<label>`: task text
      // routinely contains links, and a label must not contain interactive
      // elements. `aria-labelledby` would work too but needs ids that could
      // collide with the heading anchors in the same document.
      const name = inlineText(token.children ?? []);
      const checkbox = new state.Token('html_inline', '', 0);
      checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${
        match[1].toLowerCase() === 'x' ? ' checked' : ''
      }${name ? ` aria-label="${md.utils.escapeHtml(name)}"` : ''}>`;
      token.children!.unshift(checkbox);

      tokens[i - 2].attrJoin('class', 'task-list-item');
      // attrJoin would repeat the class once per item in the list.
      const list = listStack[listStack.length - 1];
      if (list && !list.attrGet('class')?.includes('contains-task-list')) {
        list.attrJoin('class', 'contains-task-list');
      }
    }
    return true;
  });
}

/**
 * Emoji rendering.
 *
 * Unicode emoji are wrapped in a `<span class="emoji">` so CSS can put a colour
 * emoji font first for them alone. Without it the document's Japanese body font
 * wins the fallback race for the handful of emoji it happens to cover (`:ok:` is
 * U+1F197, a Japanese carrier symbol that Hiragino / Noto Sans JP ship as a
 * monochrome glyph), so those render flat while every other emoji is in colour.
 * The font stack cannot simply lead with the emoji font: Apple Color Emoji also
 * covers the ASCII digits used by keycap sequences.
 *
 * Custom shortcodes backed by an image render as an `<img>`. That is safe with
 * `html: false` because the document only ever contributes the shortcode name,
 * and a name is only matched at all when it is a key of the table the app built
 * from the user's own emoji folder — the URL never comes from the document.
 */
function emojiRenderer(md: MarkdownIt): void {
  md.renderer.rules.emoji = (tokens, idx) => {
    const { markup, content } = tokens[idx];
    const src = customEmoji.images[markup];
    if (src) {
      const name = md.utils.escapeHtml(markup);
      return `<img class="emoji emoji--custom" src="${md.utils.escapeHtml(src)}" alt=":${name}:" title=":${name}:" draggable="false">`;
    }
    return `<span class="emoji">${md.utils.escapeHtml(content)}</span>`;
  };
}

let mdPromise: Promise<MarkdownIt> | null = null;

async function getMd(): Promise<MarkdownIt> {
  if (!mdPromise) {
    mdPromise = (async () => {
      const highlighter = await getHighlighter();
      // Security boundary: mallow opens untrusted Markdown, so raw HTML embedded
      // in a document is NOT rendered. `html: false` makes markdown-it escape any
      // literal `<script>`, `<img onerror=...>`, etc. into visible text instead of
      // live DOM. markdown-it's default `validateLink` additionally drops dangerous
      // link hrefs (javascript:, vbscript:, file:, and data: other than images), so
      // `[x](javascript:alert(1))` is not turned into a link at all. HTML that mallow itself
      // generates (Shiki code blocks, GitHub alerts, the mermaid fence rewrite below,
      // and the front-matter table) is emitted by the renderer regardless of this
      // flag — `html` only governs raw HTML *in the source* — so none of it breaks.
      const md = new MarkdownIt({ html: false, linkify: true });

      md.use(
        fromHighlighter(highlighter, {
          themes: SHIKI_THEMES,
          transformers: [stripPreBackground],
          // `text` is a Shiki special language (no grammar needed); it isn't in
          // the BundledLanguage union, so assert it for the type checker.
          fallbackLanguage: 'text' as unknown as BundledLanguage,
        }),
      );
      // Custom shortcodes are merged on top of the preset table (the plugin's
      // `defs` option replaces it, so the preset defs are re-supplied). An image
      // shortcode's substitution text is the shortcode itself, which is what the
      // plain-text fallbacks (task-list `aria-label`, outline titles) then show.
      md.use(emoji, {
        defs: {
          ...builtinEmojiDefs,
          ...customEmoji.unicode,
          ...Object.fromEntries(Object.keys(customEmoji.images).map((name) => [name, `:${name}:`])),
        },
      });
      // After the plugin, which installs its own default emoji rule.
      emojiRenderer(md);
      md.use(githubAlerts);
      md.use(anchor, {
        slugify: (s: string) => slugger.slug(s),
        callback: (token, info) => {
          headingSink.push({
            depth: Number(token.tag.slice(1)) || 1,
            slug: info.slug,
            text: info.title,
          });
        },
      });
      md.use(taskLists);
      // Must run after the Shiki plugin so it wraps Shiki's fence rule.
      mermaidFence(md);

      return md;
    })();
  }
  return mdPromise;
}

/** Render markdown source to HTML and extract its heading outline. Leading
 *  front-matter (YAML / TOML) is shown as a key/value table above the body. */
export async function renderMarkdown(src: string): Promise<RenderResult> {
  const md = await getMd();
  const { data, body } = extractFrontMatter(src);
  slugger.reset();
  headingSink = [];
  const bodyHtml = md.render(body);
  const html = data && Object.keys(data).length > 0 ? renderFrontMatterTable(data) + bodyHtml : bodyHtml;
  return { html, headings: headingSink.slice() };
}
