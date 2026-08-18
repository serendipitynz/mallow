/** Cross-platform path helpers for the frontend.
 *
 *  Paths reach the frontend from Rust (`read_dir_tree`, `read_file`, and the
 *  restored session's `lastFolder` / `lastFile`) using whatever separator the
 *  host OS uses: `/` on macOS & Linux, `\` on Windows — including `C:\...`
 *  drive letters and `\\server\share` UNC prefixes. These helpers understand
 *  both so tree expansion and the Explorer root label stay correct everywhere.
 *
 *  Kept intentionally tiny: Node's `path` is not available in the WebView, and
 *  we avoid adding an npm dependency for what is a handful of string ops. */

/** Split a path into its non-empty components, treating both `/` and `\` as
 *  separators. Drive letters (`C:`) and UNC hosts survive as leading
 *  components; leading/trailing/duplicate separators collapse away. */
function segments(path: string): string[] {
  return path.split(/[/\\]+/).filter(Boolean);
}

/** The separator to reconstruct joined paths with, inferred from the input so
 *  the result keeps the caller's (hence Rust's, hence the OS's) style. Any
 *  backslash means a Windows-style path. */
function separatorOf(path: string): '\\' | '/' {
  return path.includes('\\') ? '\\' : '/';
}

/** Whether `a`'s components are a whole-segment prefix of `b`'s. Compared
 *  segment by segment so `C:\foo` is not a prefix of `C:\foobar`. */
function hasPrefix(a: string[], b: string[]): boolean {
  return b.length >= a.length && a.every((seg, i) => seg === b[i]);
}

/** The final component of a path (its file or folder name), handling either
 *  separator style and trailing separators. Falls back to the whole input when
 *  there is nothing to split (e.g. a bare name or a lone root). */
export function basename(path: string): string {
  const segs = segments(path);
  return segs.length > 0 ? segs[segs.length - 1] : path;
}

/** The directory a path sits in, following Node's `path.dirname` for the cases
 *  that have an obvious answer: a trailing separator is ignored, a bare name has
 *  no directory (`''`), and a path directly under a root keeps that root. */
export function dirname(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (cut < 0) {
    return '';
  }
  // `/x` → `/`, not `''`: dropping the separator would turn an absolute path
  // into a relative one.
  return cut === 0 ? trimmed.slice(0, 1) : trimmed.slice(0, cut);
}

/** Resolve a `/`-separated relative reference (as written inside a document)
 *  against a directory path, normalising `.` and `..`.
 *
 *  `..` is applied by trimming `dir`'s own string rather than by rebuilding it
 *  from components, so a drive letter or a UNC prefix survives. Climbing past
 *  the root stops there, and climbing above the folder the user opened is
 *  deliberately not special-cased: the asset-protocol grant is what decides
 *  whether the result can be read, and widening that is not this function's to
 *  do. */
export function resolvePath(dir: string, ref: string): string {
  let base = dir.replace(/[/\\]+$/, '');
  const rest: string[] = [];
  for (const part of ref.split('/')) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part !== '..') {
      rest.push(part);
      continue;
    }
    if (rest.length > 0) {
      rest.pop();
      continue;
    }
    const cut = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
    if (cut > 0) {
      base = base.slice(0, cut);
    } else if (cut === 0) {
      // A component directly under the root: climbing leaves the root itself,
      // and climbing again stays there rather than eating the separator.
      base = base.slice(0, 1);
    }
  }
  if (rest.length === 0) {
    return base;
  }
  // The separator is read off the original `dir`, not off what `..` left of it:
  // a climb that reaches a bare drive letter leaves `C:`, which carries no
  // separator to infer from, and joining with `/` there would emit `C:/x.png`
  // where every other path in the app is backslash-style. An empty `dir` is the
  // one case with nothing to prefix — a separator there would turn a relative
  // result absolute.
  const sep = separatorOf(dir);
  const tail = rest.join(sep);
  if (base === '' || base.endsWith('/') || base.endsWith('\\')) {
    return `${base}${tail}`;
  }
  return `${base}${sep}${tail}`;
}

/** Append child components to a directory path, keeping the input's separator
 *  style so the result lines up with the paths Rust hands back. */
export function join(dir: string, ...parts: string[]): string {
  const sep = separatorOf(dir);
  return [dir.replace(/[/\\]+$/, ''), ...parts].join(sep);
}

/** Whether `path` is `root` itself or sits below it, matched on whole segments
 *  so `C:\foo` is not treated as containing `C:\foobar`. */
export function isInside(root: string, path: string): boolean {
  return hasPrefix(segments(root), segments(path));
}

/** Directory paths between `root` (exclusive) and `file`'s parent (inclusive),
 *  so the tree can be expanded to reveal a restored file.
 *
 *  Returns `[]` when `file` is not actually inside `root`. The reconstructed
 *  paths keep the input's separator style so they line up byte-for-byte with
 *  the paths Rust hands back for those same directories. */
export function ancestorDirs(root: string, file: string): string[] {
  const rootSegs = segments(root);
  const fileSegs = segments(file);
  if (!hasPrefix(rootSegs, fileSegs)) {
    return [];
  }
  // Segments between root and the file, dropping the trailing file name.
  const between = fileSegs.slice(rootSegs.length, -1);
  const sep = separatorOf(file);
  const dirs: string[] = [];
  let current = root.replace(/[/\\]+$/, '');
  for (const seg of between) {
    current = `${current}${sep}${seg}`;
    dirs.push(current);
  }
  return dirs;
}
