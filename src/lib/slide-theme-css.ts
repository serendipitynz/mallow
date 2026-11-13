/** Which files of the slide theme folder are themes, under what names, and what
 *  the walk took out of each (decision-19 §3, §4). Pure, so the rules are tested
 *  under Node; loaded on demand, since postcss is a large share of the bundle. */
import postcss from 'postcss';
import { walkDeckCss } from './deck-css';
import { dirname } from './path';
import {
  type FolderTheme,
  type FolderThemes,
  RESERVED_THEME_NAMES,
  type SkippedFile,
  type SlideSize,
  type ThemeFile,
} from './slide-themes';

/** Marpit's own meta pattern (`lib/postcss/meta.js`), so the name read here is
 *  the name Marpit registers the file under. */
const META = /^[*!\s]*@([\w-]+)\s+(.+)$/gim;

/** The absolute units Marpit converts a slide size from, so an entry it could
 *  not lay out is not taken. Also what keeps a value from carrying anything but
 *  a length into the CSS `lib/deck` writes from it. */
const LENGTH = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|cm|mm|in|pt|pc|q)$/i;

export interface ThemeMeta {
  /** The last `@theme`, as Marpit takes it; `null` when there is none. */
  name: string | null;
  sizes: Record<string, SlideSize>;
}

/** `@theme` and `@size` read out of a theme's comments, or `null` for CSS that
 *  does not parse. An `@size` entry is `<name> <width> <height>`, as Marp's own
 *  tools read it, and one with a length Marpit cannot convert is dropped. */
export function readThemeMeta(css: string): ThemeMeta | null {
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return null;
  }
  let name: string | null = null;
  const sizes: Record<string, SlideSize> = Object.create(null);
  root.walkComments((comment) => {
    for (const [, key, value] of comment.text.matchAll(META)) {
      if (key === 'theme') {
        name = value;
      } else if (key === 'size') {
        const parts = value.trim().split(/\s+/);
        if (parts.length === 3 && LENGTH.test(parts[1]) && LENGTH.test(parts[2])) {
          sizes[parts[0]] = { width: parts[1], height: parts[2] };
        }
      }
    }
  });
  return { name, sizes };
}

/** The folder's files made into themes (decision-19 §3, §4). Each theme's CSS is
 *  walked as a deck's is, its `url()`s resolved against its own file's
 *  directory. **Two files claiming one name register neither**, so which theme a
 *  name means never depends on the order the folder was listed in. */
export function registerFolderThemes(files: readonly ThemeFile[], toAssetUrl: (path: string) => string): FolderThemes {
  const skipped: SkippedFile[] = [];
  const candidates: FolderTheme[] = [];
  for (const file of files) {
    if ('error' in file) {
      skipped.push({ path: file.path, reason: 'unreadable' });
      continue;
    }
    const walked = walkDeckCss(file.text, { dir: dirname(file.path), toAssetUrl });
    const meta = walked.unparsed ? null : readThemeMeta(walked.css);
    if (!meta) {
      skipped.push({ path: file.path, reason: 'unparsed' });
    } else if (meta.name === null) {
      skipped.push({ path: file.path, reason: 'noTheme' });
    } else if (RESERVED_THEME_NAMES.includes(meta.name)) {
      skipped.push({ path: file.path, reason: 'reserved', name: meta.name });
    } else {
      candidates.push({
        name: meta.name,
        path: file.path,
        css: walked.css,
        sizes: meta.sizes,
        removed: { atRules: walked.removedAtRules, assetUrls: walked.refusedAssetUrls },
      });
    }
  }
  const claims = new Map<string, number>();
  for (const theme of candidates) {
    claims.set(theme.name, (claims.get(theme.name) ?? 0) + 1);
  }
  const themes: FolderTheme[] = [];
  for (const theme of candidates) {
    if ((claims.get(theme.name) ?? 0) > 1) {
      skipped.push({ path: theme.path, reason: 'conflict', name: theme.name });
    } else {
      themes.push(theme);
    }
  }
  return { themes, skipped };
}
