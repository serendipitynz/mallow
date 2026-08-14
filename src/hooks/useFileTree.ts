import { useCallback, useEffect, useRef, useState } from 'react';
import { readDirTree } from '../lib/tauri';
import type { FileEntry } from '../lib/types';

/** Centralized, controlled state for the lazy file tree. Lifting it here (rather
 *  than per-node local state) lets us refresh on fs changes (P4) and restore the
 *  expanded set on session restore (P6). */
export interface FileTreeState {
  rootDir: string | null;
  rootEntries: FileEntry[];
  rootLoading: boolean;
  rootError: string | null;
  childrenByPath: Map<string, FileEntry[]>;
  expanded: Set<string>;
  loading: Set<string>;
  errors: Map<string, string>;
}

export interface FileTreeController extends FileTreeState {
  open: (dir: string) => Promise<void>;
  toggle: (path: string) => void;
  refresh: () => Promise<void>;
  expandPaths: (paths: string[]) => Promise<void>;
}

export function useFileTree(): FileTreeController {
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [childrenByPath, setChildrenByPath] = useState<Map<string, FileEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Refs mirror state for synchronous reads inside callbacks (toggle / refresh).
  const rootDirRef = useRef<string | null>(null);
  const childrenRef = useRef(childrenByPath);
  const expandedRef = useRef(expanded);
  useEffect(() => {
    rootDirRef.current = rootDir;
  }, [rootDir]);
  useEffect(() => {
    childrenRef.current = childrenByPath;
  }, [childrenByPath]);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const loadChildren = useCallback(async (path: string) => {
    setLoading((s) => new Set(s).add(path));
    try {
      const entries = await readDirTree(path);
      setChildrenByPath((m) => new Map(m).set(path, entries));
      setErrors((m) => {
        if (!m.has(path)) {
          return m;
        }
        const n = new Map(m);
        n.delete(path);
        return n;
      });
    } catch (e) {
      setErrors((m) => new Map(m).set(path, String(e)));
    } finally {
      setLoading((s) => {
        const n = new Set(s);
        n.delete(path);
        return n;
      });
    }
  }, []);

  const open = useCallback(async (dir: string) => {
    setRootDir(dir);
    setExpanded(new Set());
    setChildrenByPath(new Map());
    setErrors(new Map());
    setRootEntries([]);
    setRootError(null);
    setRootLoading(true);
    try {
      setRootEntries(await readDirTree(dir));
    } catch (e) {
      setRootError(String(e));
    } finally {
      setRootLoading(false);
    }
  }, []);

  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!childrenRef.current.has(path)) {
            void loadChildren(path);
          }
        }
        return next;
      });
    },
    [loadChildren],
  );

  const refresh = useCallback(async () => {
    const dir = rootDirRef.current;
    if (dir) {
      try {
        setRootEntries(await readDirTree(dir));
        setRootError(null);
      } catch (e) {
        setRootError(String(e));
      }
    }
    const paths = Array.from(expandedRef.current).filter((p) => childrenRef.current.has(p));
    await Promise.all(paths.map((p) => loadChildren(p)));
  }, [loadChildren]);

  // Expand a set of directory paths (parents first) and load their children.
  const expandPaths = useCallback(
    async (paths: string[]) => {
      const ordered = [...paths].sort((a, b) => a.length - b.length);
      setExpanded((prev) => {
        const next = new Set(prev);
        ordered.forEach((p) => {
          next.add(p);
        });
        return next;
      });
      for (const p of ordered) {
        if (!childrenRef.current.has(p)) {
          await loadChildren(p);
        }
      }
    },
    [loadChildren],
  );

  return {
    rootDir,
    rootEntries,
    rootLoading,
    rootError,
    childrenByPath,
    expanded,
    loading,
    errors,
    open,
    toggle,
    refresh,
    expandPaths,
  };
}
