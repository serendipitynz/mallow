/** Viewer category for a file, derived from its extension by the Rust backend. */
export type FileKind =
  | 'directory'
  | 'markdown'
  | 'mermaid'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'text'
  | 'ini'
  | 'diff'
  | 'sql'
  | 'html'
  | 'csv'
  | 'image'
  | 'pdf'
  | 'video';

/** A single directory entry returned by the `read_dir_tree` command. */
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  kind: FileKind;
}

/** An external editor detected as installed (from `detect_editors`). */
export interface EditorInfo {
  id: string;
  label: string;
}
