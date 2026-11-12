/** The walk a deck's own CSS goes through before Marpit merges it
 *  (decision-18 §6): at-rules other than `@media`, `@supports` and `@container`
 *  are removed, and every URL is put through decision-17.
 *
 *  **postcss rather than the engine's CSSOM**, which decision-18 intended and
 *  TASK-51.2 measured not to hold: `CSSStyleSheet.replaceSync` drops an
 *  `@import` without a trace in WKWebView and Chromium alike, so the notice could
 *  never name one. postcss is the parser Marpit already runs over the same CSS,
 *  so it reads the deck exactly as the scoping after it does, and the walk is
 *  testable under Node. */
import postcss, { type Declaration } from 'postcss';
import type { RefResolver } from './html-doc';
import { localImageSrc } from './markdown';

/** Kept because their names are conditions rather than global registrations:
 *  every other at-rule either names something for the whole app document
 *  (`@font-face`, `@keyframes`, `@property`, `@counter-style`, `@layer`, …) or is
 *  hoisted out of the scope (`@import`). A list of what stays, so an at-rule CSS
 *  adds later is out until it is looked at. */
const KEPT_AT_RULES: ReadonlySet<string> = new Set(['media', 'supports', 'container']);

export interface DeckCssResult {
  css: string;
  /** Each removed at-rule's name with its `@`, once per name. */
  removedAtRules: string[];
  /** Declarations removed for naming an `asset:` URL the deck wrote itself. */
  refusedAssetUrls: number;
}

/** Walk one piece of a deck's CSS. CSS postcss cannot parse comes back empty:
 *  passed on, it would fail Marpit's own parse of the whole theme pack. */
export function walkDeckCss(css: string, images: RefResolver | undefined): DeckCssResult {
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return { css: '', removedAtRules: [], refusedAssetUrls: 0 };
  }
  const removed = new Set<string>();
  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase();
    if (!KEPT_AT_RULES.has(name)) {
      removed.add(`@${name}`);
      rule.remove();
    }
  });
  let refusedAssetUrls = 0;
  root.walkDecls((decl) => {
    const value = rewriteCssValue(decl.value, images);
    if (value === null) {
      refusedAssetUrls += 1;
      decl.remove();
    } else if (value !== decl.value) {
      setValue(decl, value);
    }
  });
  return { css: root.toString(), removedAtRules: [...removed], refusedAssetUrls };
}

function setValue(decl: Declaration, value: string): void {
  decl.value = value;
  // postcss prints `raws.value.raw` over `value` while its `value` still matches
  // what was parsed, which it no longer does — but drop it rather than rely on that.
  delete decl.raws.value;
}

/** A function whose string arguments are URLs to fetch, not text. */
const URL_STRING_FUNCTIONS: ReadonlySet<string> = new Set(['image-set', '-webkit-image-set', 'src']);

/**
 * One declaration's value with every URL in it resolved, or `null` when it names
 * an `asset:` URL the deck wrote itself.
 *
 * What counts as a URL is every `url()`, and every string argument of
 * `image-set()` / `src()`. **Any other string that decodes to an `asset:` URL
 * refuses the declaration too**, because a custom property can carry one as a
 * plain string to a later `image-set(var(--x))`, which fetches it; text that only
 * mentions such a URL is not worth that hole. Strings are compared decoded,
 * since `"\61sset:"` spells `asset:` once CSS reads it.
 */
export function rewriteCssValue(value: string, images: RefResolver | undefined): string | null {
  let out = '';
  let i = 0;
  const functions: string[] = [];
  while (i < value.length) {
    const ch = value[i];
    if (ch === '"' || ch === "'") {
      const end = stringEnd(value, i);
      const decoded = decodeCssString(value.slice(i + 1, end - (value[end - 1] === ch ? 1 : 0)));
      const inUrlFunction = URL_STRING_FUNCTIONS.has(functions[functions.length - 1] ?? '');
      if (inUrlFunction) {
        const resolved = localImageSrc(decoded, images);
        if (resolved === null) {
          return null;
        }
        out += resolved === decoded ? value.slice(i, end) : quoteCssString(resolved);
      } else {
        if (localImageSrc(decoded, undefined) === null) {
          return null;
        }
        out += value.slice(i, end);
      }
      i = end;
      continue;
    }
    if (ch === '(') {
      const name = /[-\w]*$/.exec(out)?.[0].toLowerCase() ?? '';
      if (name === 'url') {
        const unquoted = unquotedUrl(value, i);
        if (unquoted) {
          const resolved = localImageSrc(unquoted.url, images);
          if (resolved === null) {
            return null;
          }
          out += `(${quoteCssString(resolved)})`;
          i = unquoted.end;
          continue;
        }
      }
      functions.push(name === 'url' ? 'src' : name);
      out += ch;
      i += 1;
      continue;
    }
    if (ch === ')') {
      functions.pop();
    } else if (ch === '\\') {
      out += value.slice(i, i + 2);
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** The index just past the string opened at `start`, or the end of the value
 *  for one left open. */
function stringEnd(value: string, start: number): number {
  const quote = value[start];
  let i = start + 1;
  while (i < value.length) {
    if (value[i] === '\\') {
      i += 2;
    } else if (value[i] === quote) {
      return i + 1;
    } else {
      i += 1;
    }
  }
  return value.length;
}

/** `url(` at `open` followed by an unquoted URL, which CSS reads as one token. A
 *  quoted one is left to the string branch, with `url` standing for `src`. */
function unquotedUrl(value: string, open: number): { url: string; end: number } | null {
  let i = open + 1;
  while (i < value.length && /\s/.test(value[i])) {
    i += 1;
  }
  if (value[i] === '"' || value[i] === "'") {
    return null;
  }
  let raw = '';
  while (i < value.length && value[i] !== ')') {
    if (value[i] === '\\') {
      raw += value.slice(i, i + 2);
      i += 2;
    } else {
      raw += value[i];
      i += 1;
    }
  }
  return { url: decodeCssString(raw.trim()), end: Math.min(i + 1, value.length) };
}

/** CSS escapes decoded: `\` with up to six hex digits and one optional
 *  whitespace, `\` with a newline (a continuation, dropped), or `\` with any
 *  other character, which stands for itself. */
export function decodeCssString(raw: string): string {
  return raw.replace(/\\(?:([0-9a-fA-F]{1,6})[ \t\n\f]?|(\r\n|[\n\r\f])|([\s\S]))/g, (_, hex, newline, other) => {
    if (hex) {
      const code = Number.parseInt(hex, 16);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '�' : String.fromCodePoint(code);
    }
    if (newline) {
      return '';
    }
    return other;
  });
}

function quoteCssString(text: string): string {
  return `"${text.replace(/[\\"\n\r\f]/g, (c) => `\\${c.codePointAt(0)?.toString(16)} `)}"`;
}
