import { useMemo, useState } from 'react';
import { delimiterFor, parseDelimited, TABLE_MAX_CELL_CHARS, tableExtent } from '../lib/delimited';
import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { CodeIcon, TableIcon } from './icons';
import { SourceView } from './SourceView';

interface TableViewProps {
  source: string;
  file: FileEntry;
}

/**
 * CSV / TSV as a table, with the source view as the other half of the toggle.
 * What the table leaves out is bounded by decision-7 and stated above it; the
 * document itself is never withheld, since the source half shows all of it.
 */
export function TableView({ source, file }: TableViewProps) {
  const t = useT();
  const delimiter = useMemo(() => delimiterFor(file.name), [file.name]);
  const table = useMemo(() => parseDelimited(source, delimiter), [source, delimiter]);
  const extent = useMemo(() => tableExtent(table), [table]);
  const [mode, setMode] = useState<'table' | 'source'>('table');

  const notice: string[] = [];
  if (table.rowCount > extent.rows) {
    notice.push(t('tableTruncatedRows', { n: table.rowCount - extent.rows }));
  }
  if (table.columnCount > extent.columns) {
    notice.push(t('tableTruncatedColumns', { n: table.columnCount - extent.columns }));
  }
  if (table.clippedCells > 0) {
    notice.push(t('tableClippedCells', { n: table.clippedCells, chars: TABLE_MAX_CELL_CHARS }));
  }
  if (notice.length > 0) {
    notice.push(t('tableTruncatedHint'));
  }

  return (
    <div className="doc-scroll">
      <div className="doc tbl-doc">
        <div className="doc__bar">
          {/* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
              button cluster; <fieldset> is for form controls and requires a <legend>, while the
              label is already carried by aria-label. */}
          <div className="seg" role="group" aria-label={t('viewMode')}>
            <button
              type="button"
              className={`btn${mode === 'table' ? ' is-active' : ''}`}
              title={t('table')}
              aria-label={t('table')}
              aria-pressed={mode === 'table'}
              onClick={() => setMode('table')}
            >
              <TableIcon />
            </button>
            <button
              type="button"
              className={`btn${mode === 'source' ? ' is-active' : ''}`}
              title={t('source')}
              aria-label={t('source')}
              aria-pressed={mode === 'source'}
              onClick={() => setMode('source')}
            >
              <CodeIcon />
            </button>
          </div>
        </div>

        {mode === 'table' ? (
          <>
            {/* A plain <p>, like `SourceView`'s own notice: the text is computed
                once per mount, so a live region would have nothing to announce. */}
            {notice.length > 0 && <p className="tbl-notice">{notice.join(' ')}</p>}
            <Table rows={table.rows} extent={extent} emptyLabel={t('empty')} rowNumberLabel={t('rowNumber')} />
          </>
        ) : (
          // No `csv` grammar is loaded: Shiki's is a ten-column "rainbow" whose
          // scopes the GitHub themes mostly have no colour for, which would tint
          // a few columns and leave the rest plain — read as a fault, not a limit.
          <SourceView source={source} lang="text" />
        )}
      </div>
    </div>
  );
}

function Table({
  rows,
  extent,
  emptyLabel,
  rowNumberLabel,
}: {
  rows: string[][];
  extent: { rows: number; columns: number };
  emptyLabel: string;
  rowNumberLabel: string;
}) {
  if (extent.rows === 0) {
    return <p className="tbl-empty">{emptyLabel}</p>;
  }
  // The first record is the header unconditionally: the format carries no way to
  // say whether it has one, so guessing would be wrong on some files silently.
  const header = rows[0];
  const body = rows.slice(1, extent.rows);
  const columns = Array.from({ length: extent.columns }, (_, c) => c);

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th className="tbl__num" scope="col" abbr={rowNumberLabel}>
            <span className="visually-hidden">{rowNumberLabel}</span>
          </th>
          {columns.map((c) => (
            <th key={c} scope="col">
              {header[c] ?? ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, r) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: a record has no identity beyond its
             position in the file, which is also what the number column shows. */
          <tr key={r}>
            <th className="tbl__num" scope="row">
              {r + 1}
            </th>
            {columns.map((c) => (
              <td key={c}>{row[c] ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
