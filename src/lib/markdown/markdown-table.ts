// GitHub-style pipe tables as rows of cells, so they can be lined up and edited a row or column at a time.

export const COLUMN_ALIGNMENT = { none: 'none', left: 'left', center: 'center', right: 'right' } as const;
export type ColumnAlignment = (typeof COLUMN_ALIGNMENT)[keyof typeof COLUMN_ALIGNMENT];

export interface MarkdownTable {
  /** The header row first, then the body rows. Every row has one cell per column. */
  rows: string[][];
  alignments: ColumnAlignment[];
}

/** Where a position falls in a table's source: a row of the table (header is 0, the `---` line is skipped) and a column. */
export interface TableCellPosition {
  rowIndex: number;
  columnIndex: number;
}

const MINIMUM_DASHES = 3;

/** Splits a table line into cell texts, ignoring the outer pipes and keeping escaped `\|` inside cells. */
export function splitTableLine(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function readAlignment(cell: string): ColumnAlignment {
  const startsWithColon = cell.startsWith(':');
  const endsWithColon = cell.endsWith(':');
  if (startsWithColon && endsWithColon) return COLUMN_ALIGNMENT.center;
  if (endsWithColon) return COLUMN_ALIGNMENT.right;
  if (startsWithColon) return COLUMN_ALIGNMENT.left;
  return COLUMN_ALIGNMENT.none;
}

/** Reads a table's source (header, `---` line, body rows). Short rows are padded with empty cells. */
export function parseTable(source: string): MarkdownTable {
  const lines = source.split('\n').filter((line) => line.trim() !== '');
  const [headerLine = '', delimiterLine = '', ...bodyLines] = lines;
  const rows = [headerLine, ...bodyLines].map(splitTableLine);
  const columnCount = Math.max(...rows.map((row) => row.length));
  const delimiterCells = splitTableLine(delimiterLine);
  const alignments = Array.from({ length: columnCount }, (_, index) => readAlignment(delimiterCells[index] ?? ''));
  const paddedRows = rows.map((row) => [...row, ...Array<string>(columnCount - row.length).fill('')]);
  return { rows: paddedRows, alignments };
}

function delimiterCell(alignment: ColumnAlignment, width: number): string {
  const dashCount = Math.max(width, MINIMUM_DASHES);
  if (alignment === COLUMN_ALIGNMENT.center) return `:${'-'.repeat(dashCount - 2)}:`;
  if (alignment === COLUMN_ALIGNMENT.left) return `:${'-'.repeat(dashCount - 1)}`;
  if (alignment === COLUMN_ALIGNMENT.right) return `${'-'.repeat(dashCount - 1)}:`;
  return '-'.repeat(dashCount);
}

function padCell(text: string, width: number, alignment: ColumnAlignment): string {
  const space = width - text.length;
  if (alignment === COLUMN_ALIGNMENT.right) return ' '.repeat(space) + text;
  if (alignment === COLUMN_ALIGNMENT.center) {
    const before = Math.floor(space / 2);
    return ' '.repeat(before) + text + ' '.repeat(space - before);
  }
  return text + ' '.repeat(space);
}

// shortcut: widths count characters, so wide characters (CJK, emoji) leave columns slightly off; measure display width if that matters.
/** Writes a table with its columns lined up: `| a   | b |`. */
export function formatTable(table: MarkdownTable): string {
  const widths = table.alignments.map((_, columnIndex) =>
    Math.max(MINIMUM_DASHES, ...table.rows.map((row) => row[columnIndex].length)),
  );
  const formatRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const [header, ...body] = table.rows.map((row) => row.map((cell, columnIndex) => padCell(cell, widths[columnIndex], table.alignments[columnIndex])));
  const delimiter = table.alignments.map((alignment, columnIndex) => delimiterCell(alignment, widths[columnIndex]));
  return [formatRow(header), formatRow(delimiter), ...body.map(formatRow)].join('\n');
}

/** Adds an empty body row before `rowIndex` (the header always stays first). */
export function insertRow(table: MarkdownTable, rowIndex: number): MarkdownTable {
  const index = Math.min(Math.max(rowIndex, 1), table.rows.length);
  const emptyRow = table.alignments.map(() => '');
  return { ...table, rows: [...table.rows.slice(0, index), emptyRow, ...table.rows.slice(index)] };
}

/** Removes a body row. The header row can't be removed. */
export function deleteRow(table: MarkdownTable, rowIndex: number): MarkdownTable {
  if (rowIndex < 1 || rowIndex >= table.rows.length) return table;
  return { ...table, rows: table.rows.filter((_, index) => index !== rowIndex) };
}

/** Adds an empty column before `columnIndex`. */
export function insertColumn(table: MarkdownTable, columnIndex: number): MarkdownTable {
  const index = Math.min(Math.max(columnIndex, 0), table.alignments.length);
  const insertAt = <T,>(items: T[], item: T) => [...items.slice(0, index), item, ...items.slice(index)];
  return { rows: table.rows.map((row) => insertAt(row, '')), alignments: insertAt(table.alignments, COLUMN_ALIGNMENT.none) };
}

/** Removes a column, unless it's the only one. */
export function deleteColumn(table: MarkdownTable, columnIndex: number): MarkdownTable {
  if (table.alignments.length <= 1 || columnIndex < 0 || columnIndex >= table.alignments.length) return table;
  const removeAt = <T,>(items: T[]) => items.filter((_, index) => index !== columnIndex);
  return { rows: table.rows.map(removeAt), alignments: removeAt(table.alignments) };
}

/** The cell a position in the table's source is in. The `---` line counts as the header row. */
export function cellAtOffset(source: string, offset: number): TableCellPosition {
  const before = source.slice(0, offset);
  const lineIndex = before.split('\n').length - 1;
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineBefore = source.slice(lineStart, offset);
  const pipesBefore = (lineBefore.match(/(?<!\\)\|/g) ?? []).length;
  const startsWithPipe = lineBefore.trimStart().startsWith('|');
  const columnIndex = Math.max(0, pipesBefore - (startsWithPipe ? 1 : 0));
  return { rowIndex: Math.max(0, lineIndex - 1), columnIndex };
}

/** Where a cell's text starts in a table written by `formatTable`. */
export function offsetOfCell(formatted: string, cell: TableCellPosition): number {
  const lines = formatted.split('\n');
  const lineIndex = cell.rowIndex === 0 ? 0 : cell.rowIndex + 1;
  const line = lines[Math.min(lineIndex, lines.length - 1)];
  const lineStart = lines.slice(0, Math.min(lineIndex, lines.length - 1)).reduce((total, text) => total + text.length + 1, 0);
  let pipesSeen = 0;
  for (let index = 0; index < line.length; index++) {
    if (line[index] !== '|' || line[index - 1] === '\\') continue;
    if (pipesSeen === cell.columnIndex) return lineStart + index + 2;
    pipesSeen++;
  }
  return lineStart + line.length;
}
