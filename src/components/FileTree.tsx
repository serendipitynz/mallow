import { type CSSProperties, type KeyboardEvent, useId } from 'react';
import type { FileTreeState } from '../hooks/useFileTree';
import { useT } from '../lib/i18n';
import type { FileEntry, FileKind } from '../lib/types';
import { Busy } from './Busy';
import { ChevronRight, FileChartIcon, FileConfigIcon, FileTextIcon, FolderIcon, TableIcon } from './icons';
import { Notice } from './Notice';

function levelStyle(depth: number): CSSProperties {
  return { '--tree-depth': depth } as CSSProperties;
}

/** Lucide icon for a file kind (directories are handled separately). */
function FileKindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'mermaid':
      return <FileChartIcon />;
    case 'json':
    case 'yaml':
    case 'toml':
    // XML shares the config icon rather than getting one of its own: what these
    // marks separate is a structured view from a text one, and plist / xsd / xsl
    // are configuration by any reading.
    case 'xml':
      return <FileConfigIcon />;
    // Marked apart from the plain-text kinds for the same reason the config
    // kinds are: it opens in a structured view rather than as text.
    case 'csv':
      return <TableIcon />;
    default:
      return <FileTextIcon />;
  }
}

/** What every row needs from the explorer that owns the focus. */
export interface TreeRowHandlers {
  tabStop: string | null;
  selectedPath: string | null;
  onRowClick: (entry: FileEntry) => void;
  onRowFocus: (path: string) => void;
  onRowKeyDown: (e: KeyboardEvent<HTMLDivElement>, path: string) => void;
}

interface TreeProps {
  entries: FileEntry[];
  tree: FileTreeState;
  rows: TreeRowHandlers;
  label: string;
}

export function FileTree({ entries, tree, rows, label }: TreeProps) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the WAI-ARIA tree pattern puts `tree` on the list its items already form; a div would drop the list structure the rows are laid out in
    <ul className="tree" role="tree" aria-label={label}>
      {entries.map((entry) => (
        <TreeItem key={entry.path} entry={entry} depth={0} tree={tree} rows={rows} />
      ))}
    </ul>
  );
}

interface ItemProps {
  entry: FileEntry;
  depth: number;
  tree: FileTreeState;
  rows: TreeRowHandlers;
}

function TreeItem({ entry, depth, tree, rows }: ItemProps) {
  const t = useT();
  const groupId = useId();
  const expanded = entry.isDir && tree.expanded.has(entry.path);
  const children = tree.childrenByPath.get(entry.path);
  const loading = tree.loading.has(entry.path);
  const error = tree.errors.get(entry.path);
  const isSelected = !entry.isDir && entry.path === rows.selectedPath;
  const statusStyle = levelStyle(depth + 1);

  return (
    <li role="none">
      <div
        className={`tree__row${isSelected ? ' is-selected' : ''}`}
        style={levelStyle(depth)}
        role="treeitem"
        tabIndex={entry.path === rows.tabStop ? 0 : -1}
        data-path={entry.path}
        aria-level={depth + 1}
        aria-expanded={entry.isDir ? expanded : undefined}
        aria-selected={isSelected || undefined}
        aria-owns={expanded ? groupId : undefined}
        onClick={() => rows.onRowClick(entry)}
        onFocus={() => rows.onRowFocus(entry.path)}
        onKeyDown={(e) => rows.onRowKeyDown(e, entry.path)}
        title={entry.name}
      >
        <span className={`tree__chevron${entry.isDir ? '' : ' is-leaf'}${expanded ? ' is-open' : ''}`}>
          {entry.isDir ? <ChevronRight size={16} /> : null}
        </span>
        <span className="tree__icon" data-kind={entry.kind}>
          {entry.isDir ? <FolderIcon /> : <FileKindIcon kind={entry.kind} />}
        </span>
        <span className="tree__label">{entry.name}</span>
      </div>

      {/* The child area belongs to the item, so a screen reader hears which
          parent it is under and not only how deep (snz-design doc-9 §6.1.1). A
          failure keeps the children read before it: removing them would draw a
          failure and an empty folder as the same screen (snz-design doc-9 §5.5). */}
      {expanded && (
        // biome-ignore lint/a11y/useSemanticElements: a tree's child list is an ARIA `group`; `<fieldset>` groups form controls and would be read as a form
        <ul className="tree__group" role="group" id={groupId}>
          {error && (
            <li role="none" className="tree__status" style={statusStyle}>
              <Notice level="failure">{t('treeReadFailed', { error })}</Notice>
            </li>
          )}
          {!error && loading && !children && (
            <li role="none" className="tree__status" style={statusStyle}>
              <Busy>{t('loading')}</Busy>
            </li>
          )}
          {!error && children && children.length === 0 && (
            <li role="none" className="tree__status" style={statusStyle}>
              {t('empty')}
            </li>
          )}
          {children?.map((child) => (
            <TreeItem key={child.path} entry={child} depth={depth + 1} tree={tree} rows={rows} />
          ))}
        </ul>
      )}
    </li>
  );
}
