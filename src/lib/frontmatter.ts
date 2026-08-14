/**
 * Extract leading front-matter (YAML `---` or TOML `+++`) from a markdown source
 * and render it as a GitHub-style key/value table. Only a fenced block that parses
 * to a plain object at the very start is treated as front-matter; anything else
 * leaves the document untouched
 * (so a document that genuinely opens with a `---` rule still renders normally).
 */
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

const YAML_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TOML_RE = /^\+\+\+[ \t]*\r?\n([\s\S]*?)\r?\n\+\+\+[ \t]*(?:\r?\n|$)/;

export interface FrontMatterResult {
  data: Record<string, unknown> | null;
  body: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function extractFrontMatter(src: string): FrontMatterResult {
  const tryFence = (re: RegExp, parse: (s: string) => unknown): FrontMatterResult | null => {
    const m = src.match(re);
    if (!m) {
      return null;
    }
    try {
      const data = parse(m[1]);
      if (isPlainObject(data)) {
        return { data, body: src.slice(m[0].length) };
      }
    } catch {
      // Not valid front-matter — fall through and leave the document untouched.
    }
    return null;
  };

  return tryFence(YAML_RE, parseYaml) ?? tryFence(TOML_RE, (s) => parseToml(s)) ?? { data: null, body: src };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    if (value.every((x) => x === null || typeof x !== 'object')) {
      return value.map((x) => String(x)).join(', ');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function renderFrontMatterTable(data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatValue(value))}</td></tr>`)
    .join('');
  return `<table class="doc-frontmatter"><tbody>${rows}</tbody></table>`;
}
