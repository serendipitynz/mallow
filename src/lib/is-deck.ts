/** Kept apart from `lib/deck`, which carries Marpit and postcss: every markdown
 *  document asks this, and only a deck shown as slides needs the renderer, which
 *  `DeckView` loads on demand. */
import { extractFrontMatter } from './frontmatter';

/** Whether `source` is a deck: leading YAML front matter whose `marp` is the
 *  boolean `true`. TOML front matter does not make one — Marpit reads YAML only,
 *  and Marp's own tools would not open such a document as a deck either. */
export function isDeck(source: string): boolean {
  if (!source.startsWith('---')) {
    return false;
  }
  return extractFrontMatter(source).data?.marp === true;
}
