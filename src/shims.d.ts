// markdown-it-emoji v3 ships ESM without bundled type declarations.
declare module 'markdown-it-emoji' {
  import type { MarkdownIt } from 'markdown-it';

  interface EmojiOptions {
    /** shortcode -> replacement string. Replaces the preset's table wholesale. */
    defs?: Record<string, string>;
    shortcuts?: Record<string, string | string[]>;
    enabled?: string[];
  }

  type EmojiPlugin = (md: MarkdownIt, options?: EmojiOptions) => void;

  export const full: EmojiPlugin;
  export const light: EmojiPlugin;
  export const bare: EmojiPlugin;
}

// The preset's own definition table, imported so custom shortcodes can be merged
// on top of it (the plugin's `defs` option replaces the table rather than
// extending it). Reachable through the package's `./*` export map.
declare module 'markdown-it-emoji/lib/data/full.mjs' {
  const defs: Record<string, string>;
  export default defs;
}
