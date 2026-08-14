import type { CSSProperties } from 'react';
import type { FileTreeState } from '../hooks/useFileTree';
import { useT } from '../lib/i18n';
import type { FileEntry, FileKind } from '../lib/types';
import { ChevronRight, FileChartIcon, FileConfigIcon, FileTextIcon, FolderIcon } from './icons';

const INDENT_STEP = 14;
const BASE_INDENT = 8;

function indentStyle(depth: number): CSSProperties {
  return { '--row-indent': `${BASE_INDENT + depth * INDENT_STEP}px` } as CSSProperties;
}

/** Lucide icon for a file kind (directories are handled separately). */
function FileKindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'mermaid':
      return <FileChartIcon />;
    case 'json':
    case 'yaml':
    case 'toml':
      return <FileConfigIcon />;
    default:
      return <FileTextIcon />;
  }
}

interface TreeProps {
  entries: FileEntry[];
  depth: number;
  tree: FileTreeState;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onToggle: (path: string) => void;
}

export function FileTree({ entries, depth, tree, selectedPath, onSelect, onToggle }: TreeProps) {
  return (
    <ul className={depth === 0 ? 'tree' : 'tree__group'} role={depth === 0 ? 'tree' : 'group'}>
      {entries.map((entry) => (
        <TreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          tree={tree}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

interface ItemProps {
  entry: FileEntry;
  depth: number;
  tree: FileTreeState;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onToggle: (path: string) => void;
}

function TreeItem({ entry, depth, tree, selectedPath, onSelect, onToggle }: ItemProps) {
  const t = useT();
  const expanded = entry.isDir && tree.expanded.has(entry.path);
  const children = tree.childrenByPath.get(entry.path);
  const loading = tree.loading.has(entry.path);
  const error = tree.errors.get(entry.path);
  const isSelected = !entry.isDir && entry.path === selectedPath;
  const childStatusStyle = indentStyle(depth + 1);

  function activate() {
    if (entry.isDir) onToggle(entry.path);
    else onSelect(entry);
  }

  return (
    <li role="none">
      <button
        type="button"
        className={`tree__row${isSelected ? ' is-selected' : ''}`}
        style={indentStyle(depth)}
        role="treeitem"
        aria-expanded={entry.isDir ? expanded : undefined}
        aria-selected={isSelected || undefined}
        onClick={activate}
        title={entry.name}
      >
        <span className={`tree__chevron${entry.isDir ? '' : ' is-leaf'}${expanded ? ' is-open' : ''}`}>
          {entry.isDir ? <ChevronRight /> : null}
        </span>
        <span className="tree__icon" data-kind={entry.kind}>
          {entry.isDir ? <FolderIcon /> : <FileKindIcon kind={entry.kind} />}
        </span>
        <span className="tree__label">{entry.name}</span>
      </button>

      {expanded && (
        <>
          {loading && !children && (
            <div className="tree__status" style={childStatusStyle}>
              {t('loading')}
            </div>
          )}
          {error && (
            <div className="tree__status is-error" style={childStatusStyle}>
              {error}
            </div>
          )}
          {children && children.length === 0 && !error && (
            <div className="tree__status" style={childStatusStyle}>
              {t('empty')}
            </div>
          )}
          {children && children.length > 0 && (
            <FileTree
              entries={children}
              depth={depth + 1}
              tree={tree}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          )}
        </>
      )}
    </li>
  );
}
