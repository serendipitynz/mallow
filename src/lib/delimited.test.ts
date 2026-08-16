import { describe, expect, it } from 'vitest';
import {
  delimiterFor,
  parseDelimited,
  TABLE_MAX_CELL_CHARS,
  TABLE_MAX_CELLS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  tableExtent,
} from './delimited';

const csv = (text: string) => parseDelimited(text, ',');

describe('delimiterFor', () => {
  it('reads the delimiter off the extension', () => {
    expect(delimiterFor('data.csv')).toBe(',');
    expect(delimiterFor('data.tsv')).toBe('\t');
    expect(delimiterFor('DATA.TSV')).toBe('\t');
  });

  it('falls back to a comma for anything else', () => {
    expect(delimiterFor('data')).toBe(',');
    expect(delimiterFor('data.txt')).toBe(',');
  });
});

describe('parseDelimited', () => {
  it('splits plain records', () => {
    expect(csv('a,b,c\n1,2,3').rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('reports an empty file as no records at all', () => {
    expect(csv('')).toEqual({ rows: [], rowCount: 0, columnCount: 0, clippedCells: 0 });
  });

  it('does not open a record after a trailing newline', () => {
    expect(csv('a,b\n').rowCount).toBe(1);
    expect(csv('a,b\r\n').rowCount).toBe(1);
    expect(csv('a,b\n\n').rowCount).toBe(2);
  });

  it('keeps a delimiter inside a quoted field', () => {
    expect(csv('a,"b,c",d').rows).toEqual([['a', 'b,c', 'd']]);
    expect(parseDelimited('a\t"b\tc"\td', '\t').rows).toEqual([['a', 'b\tc', 'd']]);
  });

  it('keeps a newline inside a quoted field', () => {
    const table = csv('a,"line 1\nline 2",c\nx,y,z');
    expect(table.rowCount).toBe(2);
    expect(table.rows[0]).toEqual(['a', 'line 1\nline 2', 'c']);
  });

  it('unescapes a doubled quote into one', () => {
    expect(csv('"say ""hi""",b').rows).toEqual([['say "hi"', 'b']]);
    expect(csv('"""",b').rows).toEqual([['"', 'b']]);
  });

  it('accepts CRLF, LF and a lone CR as record separators', () => {
    expect(csv('a,b\r\nc,d').rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(csv('a,b\rc,d').rowCount).toBe(2);
    expect(csv('a,b\r\nc,d\ne,f').rowCount).toBe(3);
  });

  it('leaves ragged records ragged and reports the widest', () => {
    const table = csv('a,b,c\n1\n2,3');
    expect(table.rows).toEqual([['a', 'b', 'c'], ['1'], ['2', '3']]);
    expect(table.columnCount).toBe(3);
  });

  it('counts an empty field per delimiter', () => {
    expect(csv('a,,c').rows).toEqual([['a', '', 'c']]);
    expect(csv(',').rows).toEqual([['', '']]);
  });

  it('takes an unterminated quote as running to the end of the file', () => {
    expect(csv('a,"b,c').rows).toEqual([['a', 'b,c']]);
  });

  it('clips a cell that would render more text than the per-cell cap', () => {
    const long = 'x'.repeat(TABLE_MAX_CELL_CHARS * 3);
    const table = csv(`a,${long}`);
    expect(table.rows[0][1]).toBe(`${'x'.repeat(TABLE_MAX_CELL_CHARS)}…`);
    expect(table.clippedCells).toBe(1);
    // The record itself is unaffected: clipping is about what one cell renders.
    expect(table.columnCount).toBe(2);
  });

  it('clips an unterminated quote that swallows the rest of the file', () => {
    // The shape that passes every other cap: one record, one field, no notice
    // unless the clip is counted.
    const table = csv(`"${'y'.repeat(TABLE_MAX_CELL_CHARS * 100)}`);
    expect(table.rowCount).toBe(1);
    expect(table.columnCount).toBe(1);
    expect(table.rows[0][0].length).toBe(TABLE_MAX_CELL_CHARS + 1);
    expect(table.clippedCells).toBe(1);
  });

  it('leaves a cell exactly at the cap alone', () => {
    const table = csv('x'.repeat(TABLE_MAX_CELL_CHARS));
    expect(table.rows[0][0].length).toBe(TABLE_MAX_CELL_CHARS);
    expect(table.clippedCells).toBe(0);
  });

  it('takes characters trailing a closing quote literally', () => {
    expect(csv('"a"b,c').rows).toEqual([['ab', 'c']]);
  });
});

describe('parseDelimited caps', () => {
  it('counts every record but builds no more than the cell budget needs', () => {
    const table = csv('a,b\n'.repeat(TABLE_MAX_ROWS * 3));
    expect(table.rowCount).toBe(TABLE_MAX_ROWS * 3);
    expect(table.rows.length).toBe(TABLE_MAX_ROWS);
  });

  it('counts every field of a very wide record but builds no more than the column cap', () => {
    const wide = Array.from({ length: TABLE_MAX_COLUMNS * 10 }, (_, i) => String(i)).join(',');
    const table = csv(wide);
    expect(table.columnCount).toBe(TABLE_MAX_COLUMNS * 10);
    expect(table.rows[0].length).toBe(TABLE_MAX_COLUMNS);
  });

  it('always builds at least the rows tableExtent asks for', () => {
    const wideRow = `${Array.from({ length: TABLE_MAX_COLUMNS }, (_, i) => String(i)).join(',')}\n`;
    const table = csv(wideRow.repeat(TABLE_MAX_ROWS));
    expect(table.rows.length).toBeGreaterThanOrEqual(tableExtent(table).rows);
  });

  it('builds enough rows even when the widest record comes last', () => {
    const narrow = 'a\n'.repeat(300);
    const wide = Array.from({ length: TABLE_MAX_COLUMNS }, (_, i) => String(i)).join(',');
    const table = csv(narrow + wide);
    expect(table.columnCount).toBe(TABLE_MAX_COLUMNS);
    expect(table.rows.length).toBeGreaterThanOrEqual(tableExtent(table).rows);
  });
});

describe('tableExtent', () => {
  it('renders a small table whole', () => {
    expect(tableExtent(csv('a,b\n1,2'))).toEqual({ rows: 2, columns: 2 });
  });

  it('caps the rows of a narrow file at the row cap', () => {
    const table = { rows: [], rowCount: TABLE_MAX_ROWS * 2, columnCount: 2, clippedCells: 0 };
    expect(tableExtent(table).rows).toBe(TABLE_MAX_ROWS);
  });

  it('caps the columns of a wide file at the column cap', () => {
    const table = { rows: [], rowCount: 3, columnCount: TABLE_MAX_COLUMNS * 100, clippedCells: 0 };
    expect(tableExtent(table)).toEqual({ rows: 3, columns: TABLE_MAX_COLUMNS });
  });

  it('lowers the row count as the table widens, so cells stay within the budget', () => {
    const table = { rows: [], rowCount: TABLE_MAX_ROWS, columnCount: TABLE_MAX_COLUMNS, clippedCells: 0 };
    const extent = tableExtent(table);
    expect(extent.rows).toBeLessThan(TABLE_MAX_ROWS);
    expect(extent.rows * extent.columns).toBeLessThanOrEqual(TABLE_MAX_CELLS);
  });

  it('never exceeds the cell budget, at any shape', () => {
    for (const columnCount of [1, 2, 7, 40, 99, 100, 1000, 5_000_000]) {
      const extent = tableExtent({ rows: [], rowCount: 10_000_000, columnCount, clippedCells: 0 });
      expect(extent.rows * extent.columns).toBeLessThanOrEqual(TABLE_MAX_CELLS);
      expect(extent.rows).toBeLessThanOrEqual(TABLE_MAX_ROWS);
      expect(extent.columns).toBeLessThanOrEqual(TABLE_MAX_COLUMNS);
    }
  });
});
