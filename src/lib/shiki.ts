/** Shiki highlighter singleton + the pre-background-stripping transformer. */
import { createHighlighter, type Highlighter, type ShikiTransformer } from 'shiki';

/** Dual theme. Light is inlined; dark is emitted as
 *  `--shiki-dark` custom properties and swapped in by SCSS under dark mode. */
export const SHIKI_THEMES = { light: 'github-light', dark: 'github-dark' } as const;

// Curated language set (kept explicit so the bundle doesn't pull every grammar).
// Unknown languages fall back to plain text via `fallbackLanguage`.
const LANGS = [
  'markdown',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'ini',
  'xml',
  'html',
  'css',
  'scss',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'bash',
  'shell',
  'python',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'sql',
  'diff',
  'dockerfile',
  'kotlin',
  'swift',
  'graphql',
  'lua',
];

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
      langs: LANGS,
    });
  }
  return highlighterPromise;
}

/**
 * Drop the theme's hard-coded background from the generated `<pre>` so the
 * GitHub-style code surface defined in SCSS wins. Shiki writes the background as
 * an inline style, which this strips.
 */
export const stripPreBackground: ShikiTransformer = {
  name: 'strip-pre-background',
  pre(node) {
    const style = node.properties?.style;
    if (typeof style !== 'string') {
      return;
    }
    const stripped = style
      .replace(/background-color:[^;]*;?/g, '')
      .replace(/^\s*;?\s*/, '')
      .trim();
    if (stripped) {
      node.properties.style = stripped;
    } else {
      delete node.properties.style;
    }
  },
};
