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
  | 'xml'
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

/** Where a created window opens: the folder, and the file to select inside it.
 *
 *  Deposited by `open_window` and taken exactly once by the created window's own
 *  `takeWindowInit` at mount. The file half becomes an ordered list plus which
 *  entry is active once one window can hold several documents (TASK-13.4); what
 *  changes then is what this carries, not how it is handed over. */
export interface InitialLocation {
  folder: string;
  file: string | null;
}

/** What a window was told at creation, answered once by `take_window_init`. It is
 *  `null` for a window `open_window` did not create — the launch window, and any
 *  window that has already taken its entry. */
export interface WindowInit {
  location: InitialLocation | null;
}
