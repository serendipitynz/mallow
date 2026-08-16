/**
 * Delimiter-separated text (CSV / TSV) → a bounded table. Pure logic + tunables,
 * kept apart from the React view so they can be unit-tested in a Node
 * environment — the same split as `lib/config-tree` and `lib/source-cap`.
 *
 * The UTF-8 BOM is stripped in `read_file`, so the first header cell arrives
 * clean and nothing here looks for one.
 */

/** Records rendered at most, whatever the row width: this is what bounds `<tr>`. */
export const TABLE_MAX_ROWS = 5_000;
/** Fields rendered at most per record: this is what bounds a row's width. */
export const TABLE_MAX_COLUMNS = 100;
/**
 * Cells rendered at most. Needed on top of the two above because they multiply:
 * 5,000 rows of 100 fields is half a million cells while satisfying both
 * (decision-7). It lowers the row count as the table gets wider.
 */
export const TABLE_MAX_CELLS = 20_000;
/**
 * Characters one cell renders at most. The three caps above bound how many cells
 * exist, not how much text any one of them holds: a field is allowed to run to
 * the end of the file (an unterminated quote does exactly that), which would put
 * megabytes into a single wrapping cell whose intrinsic width the engine has to
 * measure. A clipped value keeps its ellipsis, so the cell says so on its own.
 */
export const TABLE_MAX_CELL_CHARS = 500;

export type Delimiter = ',' | '\t';

/** Taken from the extension rather than sniffed — decision-2 keeps the mapping explicit. */
export function delimiterFor(name: string): Delimiter {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return ext === 'tsv' ? '\t' : ',';
}

export interface DelimitedTable {
  /** A prefix of the file's records, bounded by the caps above. */
  rows: string[][];
  /** Records the file holds, before any cap. */
  rowCount: number;
  /** Fields in the widest record, before any cap. */
  columnCount: number;
  /** Kept cells whose value was clipped to {@link TABLE_MAX_CELL_CHARS}. */
  clippedCells: number;
}

/** How much of a {@link DelimitedTable} the view may render. */
export interface TableExtent {
  rows: number;
  columns: number;
}

export function tableExtent(table: DelimitedTable): TableExtent {
  const columns = Math.min(table.columnCount, TABLE_MAX_COLUMNS);
  const rows = Math.min(table.rowCount, TABLE_MAX_ROWS, Math.floor(TABLE_MAX_CELLS / Math.max(columns, 1)));
  return { rows, columns };
}

/**
 * Scan the field starting at `start` and return the index just past it. With
 * `keep` false the value is not built, which is what keeps a file of millions of
 * fields from allocating a string for every one of them while still counting.
 */
function readField(text: string, start: number, delimiter: string, keep: boolean): { end: number; value: string } {
  const n = text.length;
  let i = start;
  let value = '';

  if (text[i] === '"') {
    let from = i + 1;
    const parts: string[] = [];
    for (;;) {
      const quote = text.indexOf('"', from);
      if (quote === -1) {
        // Unterminated quote: take the rest of the file as this field. A table
        // view has no error mode to fall into, and refusing the whole document
        // over one stray quote would hide everything before it.
        if (keep) {
          parts.push(text.slice(from));
        }
        i = n;
        break;
      }
      if (text[quote + 1] === '"') {
        if (keep) {
          parts.push(text.slice(from, quote + 1));
        }
        from = quote + 2;
        continue;
      }
      if (keep) {
        parts.push(text.slice(from, quote));
      }
      i = quote + 1;
      break;
    }
    if (keep) {
      value = parts.length === 1 ? parts[0] : parts.join('');
    }
  }

  // The unquoted field, or whatever trails a closing quote: `"a"b` is not RFC
  // 4180, and taking the tail literally keeps the row aligned with its
  // neighbours where dropping it would shift every later column.
  let end = i;
  while (end < n) {
    const c = text[end];
    if (c === delimiter || c === '\n' || c === '\r') {
      break;
    }
    end += 1;
  }
  if (keep && end > i) {
    value += text.slice(i, end);
  }
  return { end, value };
}

/**
 * The cap counts UTF-16 code units, so cutting at it can land between the halves
 * of a surrogate pair and leave a lone surrogate the engine draws as U+FFFD —
 * right where the ellipsis is meant to be the only mark. Backing off one unit
 * drops the whole character instead.
 */
function clipValue(value: string): string {
  const last = value.charCodeAt(TABLE_MAX_CELL_CHARS - 1);
  const isHighSurrogate = last >= 0xd800 && last <= 0xdbff;
  return `${value.slice(0, isHighSurrogate ? TABLE_MAX_CELL_CHARS - 1 : TABLE_MAX_CELL_CHARS)}…`;
}

/**
 * RFC 4180 quoting, with CRLF / LF / CR all accepted as record separators and
 * ragged records left ragged. Records past the caps are counted but not built,
 * so `rowCount` / `columnCount` describe the file while `rows` describes what
 * can be rendered.
 */
export function parseDelimited(text: string, delimiter: string): DelimitedTable {
  const rows: string[][] = [];
  let rowCount = 0;
  let columnCount = 0;
  let clippedCells = 0;
  const n = text.length;
  if (n === 0) {
    return { rows, rowCount, columnCount, clippedCells };
  }

  let i = 0;
  let row: string[] = [];
  let fields = 0;
  let storedCells = 0;
  let storeRow = true;

  for (;;) {
    const keep = storeRow && fields < TABLE_MAX_COLUMNS;
    const field = readField(text, i, delimiter, keep);
    fields += 1;
    if (keep) {
      if (field.value.length > TABLE_MAX_CELL_CHARS) {
        row.push(clipValue(field.value));
        clippedCells += 1;
      } else {
        row.push(field.value);
      }
      storedCells += 1;
    }
    i = field.end;
    if (i < n && text[i] === delimiter) {
      i += 1;
      continue;
    }

    rowCount += 1;
    if (fields > columnCount) {
      columnCount = fields;
    }
    if (storeRow) {
      rows.push(row);
    }
    if (i >= n) {
      break;
    }
    if (text[i] === '\r' && text[i + 1] === '\n') {
      i += 2;
    } else {
      i += 1;
    }
    if (i >= n) {
      break;
    }

    row = [];
    fields = 0;
    // Storing stops on the cell budget rather than on a row count of its own, so
    // `rows` always holds at least the rows `tableExtent` will ask for: a stored
    // row costs at most `columnCount` cells, so the budget cannot run out before
    // `TABLE_MAX_CELLS / columnCount` rows are in hand.
    storeRow = rows.length < TABLE_MAX_ROWS && storedCells < TABLE_MAX_CELLS;
  }

  return { rows, rowCount, columnCount, clippedCells };
}
