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
