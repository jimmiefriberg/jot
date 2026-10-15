import Papa from 'papaparse';

export interface CsvDocument {
  rows: string[][];
  columnCount: number;
  delimiter: string;
  newline: string;
  hasTrailingNewline: boolean;
}

export interface IndexRange {
  start: number;
  end: number;
}

/** Parses CSV/TSV text, detecting the delimiter and line endings so they can be kept on save. */
export function parseCsv(text: string): CsvDocument {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const hasTrailingNewline = text.endsWith(newline);
  const body = hasTrailingNewline ? text.slice(0, -newline.length) : text;

  if (body.length === 0) {
    return { rows: [], columnCount: 0, delimiter: ',', newline, hasTrailingNewline };
  }

  const result = Papa.parse<string[]>(body, { newline, skipEmptyLines: false });
  const rows = result.data;
  const columnCount = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  return { rows, columnCount, delimiter: result.meta.delimiter || ',', newline, hasTrailingNewline };
}

/** Turns a CSV document back into text using its original delimiter and line endings. */
export function serializeCsv(csv: CsvDocument): string {
  if (csv.rows.length === 0) return '';
  const text = Papa.unparse(csv.rows, { delimiter: csv.delimiter, newline: csv.newline });
  return csv.hasTrailingNewline ? text + csv.newline : text;
}

/** Pads ragged rows so every row has `columnCount` cells. */
function normalizeRows(csv: CsvDocument): string[][] {
  return csv.rows.map((row) => {
    if (row.length >= csv.columnCount) return [...row];
    return [...row, ...new Array<string>(csv.columnCount - row.length).fill('')];
  });
}

function withRows(csv: CsvDocument, rows: string[][]): CsvDocument {
  const columnCount = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  return { ...csv, rows, columnCount };
}

function moveRange<T>(items: T[], range: IndexRange, offset: number): T[] {
  const moved = items.slice(range.start, range.end + 1);
  const remaining = [...items.slice(0, range.start), ...items.slice(range.end + 1)];
  const insertAt = range.start + offset;
  return [...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)];
}

/** Whether a range can shift by `offset` without leaving the `[minimum, count)` bounds. */
export function canMoveRange(range: IndexRange, offset: number, count: number, minimum = 0): boolean {
  return range.start + offset >= minimum && range.end + offset < count;
}

/** Moves a block of rows up (negative offset) or down (positive offset). */
export function moveRows(csv: CsvDocument, range: IndexRange, offset: number): CsvDocument {
  return withRows(csv, moveRange(normalizeRows(csv), range, offset));
}

/** Moves a block of columns left (negative offset) or right (positive offset). */
export function moveColumns(csv: CsvDocument, range: IndexRange, offset: number): CsvDocument {
  const rows = normalizeRows(csv).map((row) => moveRange(row, range, offset));
  return withRows(csv, rows);
}

export function insertRow(csv: CsvDocument, index: number): CsvDocument {
  const rows = normalizeRows(csv);
  const emptyRow = new Array<string>(Math.max(csv.columnCount, 1)).fill('');
  rows.splice(index, 0, emptyRow);
  return withRows(csv, rows);
}

export function insertColumn(csv: CsvDocument, index: number): CsvDocument {
  const sourceRows = csv.rows.length === 0 ? [[]] : normalizeRows(csv);
  const rows = sourceRows.map((row) => [...row.slice(0, index), '', ...row.slice(index)]);
  return withRows(csv, rows);
}

export function deleteRows(csv: CsvDocument, range: IndexRange): CsvDocument {
  const rows = csv.rows.filter((_, rowIndex) => rowIndex < range.start || rowIndex > range.end);
  return withRows(csv, rows);
}

export function deleteColumns(csv: CsvDocument, range: IndexRange): CsvDocument {
  const rows = normalizeRows(csv).map((row) =>
    row.filter((_, columnIndex) => columnIndex < range.start || columnIndex > range.end),
  );
  return withRows(csv, rows);
}

/** Changes one cell. Only that row grows if it's short, so the other rows are written back exactly as they were. */
export function setCell(csv: CsvDocument, rowIndex: number, columnIndex: number, value: string): CsvDocument {
  const rows = csv.rows.map((row) => [...row]);
  while (rows.length <= rowIndex) rows.push(new Array<string>(csv.columnCount).fill(''));
  const row = rows[rowIndex];
  while (row.length <= columnIndex) row.push('');
  row[columnIndex] = value;
  return withRows(csv, rows);
}

/** Column label like a spreadsheet: A, B, … Z, AA, AB … */
export function columnLabel(columnIndex: number): string {
  let label = '';
  let remaining = columnIndex + 1;
  while (remaining > 0) {
    const letterIndex = (remaining - 1) % 26;
    label = String.fromCharCode(65 + letterIndex) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return label;
}

/** Serializes a rectangular part of the table as delimited text, for the clipboard. */
export function serializeRegion(csv: CsvDocument, rows: IndexRange, columns: IndexRange): string {
  const region = normalizeRows(csv)
    .slice(rows.start, rows.end + 1)
    .map((row) => row.slice(columns.start, columns.end + 1));
  return Papa.unparse(region, { delimiter: csv.delimiter, newline: '\n' });
}

/** Pastes a block of cells (for example copied from a spreadsheet) with its top-left corner at the given cell. */
export function pasteRegion(csv: CsvDocument, rowIndex: number, columnIndex: number, region: string[][]): CsvDocument {
  let result = csv;
  region.forEach((regionRow, rowOffset) => {
    regionRow.forEach((value, columnOffset) => {
      result = setCell(result, rowIndex + rowOffset, columnIndex + columnOffset, value);
    });
  });
  // A paste that adds columns widens every row, like inserting a column does.
  return result.columnCount > csv.columnCount ? withRows(result, normalizeRows(result)) : result;
}

/** Parses clipboard text into cells: tab-separated when it has tabs (spreadsheets), otherwise with the table's delimiter. */
export function parseClipboardRegion(text: string, delimiter: string): string[][] {
  const trimmed = text.replace(/\r?\n$/, '');
  const result = Papa.parse<string[]>(trimmed, { delimiter: trimmed.includes('\t') ? '\t' : delimiter });
  return result.data;
}

export const SORT_DIRECTION = { ascending: 'ascending', descending: 'descending' } as const;
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

const cellCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const NUMBER_PATTERN = /^[-+]?[$€£¥]?\s?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?%?$/;

/** Whether a cell holds a number like `42`, `-3.5`, `1,250`, `$9.99` or `12%`. */
export function isNumericCell(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /\d/.test(trimmed) && NUMBER_PATTERN.test(trimmed);
}

/**
 * Sorts the rows from `firstRow` on (the header stays put) by one column. Numbers sort by value, text alphabetically,
 * and empty cells always go last.
 */
export function sortRows(csv: CsvDocument, columnIndex: number, direction: SortDirection, firstRow = 0): CsvDocument {
  const rows = normalizeRows(csv);
  const fixedRows = rows.slice(0, firstRow);
  const sortedRows = rows.slice(firstRow).sort((first, second) => {
    const firstValue = first[columnIndex] ?? '';
    const secondValue = second[columnIndex] ?? '';
    if (firstValue === '' || secondValue === '') return Number(firstValue === '') - Number(secondValue === '');
    const order = cellCollator.compare(firstValue, secondValue);
    return direction === SORT_DIRECTION.ascending ? order : -order;
  });
  return withRows(csv, [...fixedRows, ...sortedRows]);
}

/** The rows (from `firstRow` on) with a cell that contains the query, ignoring case. All rows when the query is empty. */
export function filterRowIndexes(csv: CsvDocument, query: string, firstRow = 0): number[] {
  const indexes: number[] = [];
  const needle = query.trim().toLowerCase();
  for (let rowIndex = firstRow; rowIndex < csv.rows.length; rowIndex++) {
    if (!needle || csv.rows[rowIndex].some((cell) => cell.toLowerCase().includes(needle))) indexes.push(rowIndex);
  }
  return indexes;
}

/** Columns whose filled cells are (almost) all numbers. Those are right-aligned so digits line up. */
export function detectNumericColumns(csv: CsvDocument, firstRow = 0, sampleSize = 500): Set<number> {
  const numericColumns = new Set<number>();
  const sampleRows = csv.rows.slice(firstRow, firstRow + sampleSize);
  for (let columnIndex = 0; columnIndex < csv.columnCount; columnIndex++) {
    const filledCells = sampleRows.map((row) => row[columnIndex] ?? '').filter((cell) => cell.trim() !== '');
    const numericCount = filledCells.filter(isNumericCell).length;
    if (filledCells.length > 0 && numericCount / filledCells.length >= 0.9) numericColumns.add(columnIndex);
  }
  return numericColumns;
}
