/** Frontend mirror of the Rust `file_kind` mapping, for synthesizing a FileEntry
 *  from a bare path (e.g. when restoring the last-opened file on launch). */
import { basename } from './path';
import type { FileEntry, FileKind } from './types';

export function kindFromName(name: string): FileKind | null {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'mmd':
    case 'mermaid':
      return 'mermaid';
    case 'json':
    case 'jsonc':
    case 'json5':
    case 'jsonl':
    case 'ndjson':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'txt':
    case 'text':
    case 'log':
      return 'text';
    case 'ini':
    case 'conf':
    case 'cfg':
    case 'properties':
    case 'editorconfig':
      return 'ini';
    case 'diff':
    case 'patch':
      return 'diff';
    case 'sql':
      return 'sql';
    case 'html':
    case 'htm':
      return 'html';
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'xml':
    case 'plist':
    case 'xsd':
    case 'xsl':
      return 'xml';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    // heic/heif only render on macOS; the backend gates them out of the tree on
    // other platforms, so the frontend can map them unconditionally.
    case 'heic':
    case 'heif':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'webm':
    case 'mp4':
    case 'mov':
      return 'video';
    default:
      // Null rather than a kind, because `file_kind` returns None here and so
      // keeps such a file out of the tree: naming a kind would let the restored
      // session select a document the tree cannot show, and picking `'markdown'`
      // (as this did) or `'text'` would also be the catch-all "render any
      // unknown extension" rule decision-2 declines.
      return null;
  }
}

/** Null for a path whose extension `file_kind` does not map — see `kindFromName`. */
export function fileEntryFromPath(path: string): FileEntry | null {
  const name = basename(path);
  const kind = kindFromName(name);
  if (kind === null) {
    return null;
  }
  return { name, path, isDir: false, kind };
}
