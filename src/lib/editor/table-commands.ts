import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { Command } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

import {
  cellAtOffset,
  deleteColumn,
  deleteRow,
  formatTable,
  insertColumn,
  insertRow,
  offsetOfCell,
  parseTable,
} from '../markdown/markdown-table';
import type { MarkdownTable, TableCellPosition } from '../markdown/markdown-table';

interface TableEdit {
  table: MarkdownTable;
  /** The cell the cursor goes to afterwards. */
  cell: TableCellPosition;
}

interface DocumentRange {
  from: number;
  to: number;
}

/** The Markdown table around a position, if there is one. */
function findTableAt(state: EditorState, position: number): DocumentRange | null {
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, side); node; node = node.parent) {
      if (node.name === 'Table') return { from: node.from, to: node.to };
    }
  }
  return null;
}

/** Applies an edit to the table at the cursor, lines its columns up and puts the cursor in the edit's cell. */
function editTableAtCursor(edit: (table: MarkdownTable, cell: TableCellPosition) => TableEdit): Command {
  return (view) => {
    const { state } = view;
    const head = state.selection.main.head;
    const range = findTableAt(state, head);
    if (!range) return false;
    const source = state.doc.sliceString(range.from, range.to);
    const result = edit(parseTable(source), cellAtOffset(source, head - range.from));
    const formatted = formatTable(result.table);
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: formatted },
      selection: { anchor: range.from + offsetOfCell(formatted, result.cell) },
      scrollIntoView: true,
      userEvent: 'input',
    });
    return true;
  };
}

function lastRowIndex(table: MarkdownTable): number {
  return table.rows.length - 1;
}

function lastColumnIndex(table: MarkdownTable): number {
  return table.alignments.length - 1;
}

/** Tab: the next cell, or a new row after the last cell. */
export const nextTableCell = editTableAtCursor((table, cell) => {
  if (cell.columnIndex < lastColumnIndex(table)) return { table, cell: { ...cell, columnIndex: cell.columnIndex + 1 } };
  if (cell.rowIndex < lastRowIndex(table)) return { table, cell: { rowIndex: cell.rowIndex + 1, columnIndex: 0 } };
  return { table: insertRow(table, table.rows.length), cell: { rowIndex: table.rows.length, columnIndex: 0 } };
});

/** ⇧Tab: the previous cell. */
export const previousTableCell = editTableAtCursor((table, cell) => {
  if (cell.columnIndex > 0) return { table, cell: { ...cell, columnIndex: cell.columnIndex - 1 } };
  if (cell.rowIndex > 0) return { table, cell: { rowIndex: cell.rowIndex - 1, columnIndex: lastColumnIndex(table) } };
  return { table, cell };
});

export const insertTableRowAbove = editTableAtCursor((table, cell) => {
  const rowIndex = Math.max(cell.rowIndex, 1);
  return { table: insertRow(table, rowIndex), cell: { ...cell, rowIndex } };
});

export const insertTableRowBelow = editTableAtCursor((table, cell) => ({
  table: insertRow(table, cell.rowIndex + 1),
  cell: { ...cell, rowIndex: cell.rowIndex + 1 },
}));

export const insertTableColumnLeft = editTableAtCursor((table, cell) => ({ table: insertColumn(table, cell.columnIndex), cell }));

export const insertTableColumnRight = editTableAtCursor((table, cell) => ({
  table: insertColumn(table, cell.columnIndex + 1),
  cell: { ...cell, columnIndex: cell.columnIndex + 1 },
}));

export const deleteTableRow = editTableAtCursor((table, cell) => {
  const nextTable = deleteRow(table, cell.rowIndex);
  return { table: nextTable, cell: { ...cell, rowIndex: Math.min(cell.rowIndex, lastRowIndex(nextTable)) } };
});

export const deleteTableColumn = editTableAtCursor((table, cell) => {
  const nextTable = deleteColumn(table, cell.columnIndex);
  return { table: nextTable, cell: { ...cell, columnIndex: Math.min(cell.columnIndex, lastColumnIndex(nextTable)) } };
});

/** Lines up the columns of every table in the document (Format Document in Markdown). */
export const formatAllTables: Command = (view) => {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return;
      const source = state.doc.sliceString(node.from, node.to);
      const formatted = formatTable(parseTable(source));
      if (formatted !== source) changes.push({ from: node.from, to: node.to, insert: formatted });
      return false;
    },
  });
  if (changes.length > 0) view.dispatch({ changes, userEvent: 'input.format' });
  return true;
};
