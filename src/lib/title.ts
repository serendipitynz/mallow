/** Compute the native window title for the open document: a markdown front-matter
 *  `title` when one can be determined, otherwise the file name. */
import { extractFrontMatter } from './frontmatter';
import type { FileEntry } from './types';

const APP_NAME = 'mallow';

/** A markdown front-matter `title` (trimmed, non-empty) if present. */
function frontMatterTitle(file: FileEntry, content: string): string | null {
  if (file.kind !== 'markdown') {
    return null;
  }
  const { data } = extractFrontMatter(content);
  const title = data?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/** The document label: front-matter title when available, else the file name. */
export function documentTitle(file: FileEntry, content: string): string {
  return frontMatterTitle(file, content) ?? file.name;
}

/** Full window title string. `doc` is the document label, or null when no file
 *  is open (just the app name). */
export function windowTitle(doc: string | null): string {
  return doc ? `${doc} — ${APP_NAME}` : APP_NAME;
}
