import { useState } from 'react';

import {
  canMoveRange,
  deleteColumns,
  deleteRows,
  insertColumn,
  insertRow,
  moveColumns,
  moveRows,
  parseClipboardRegion,
  pasteRegion,
  serializeCsv,
  serializeRegion,
  setCell,
  sortRows,
} from '../../lib/csv/csv-model';
import type { CsvDocument, SortDirection } from '../../lib/csv/csv-model';
import { useCsvDocument } from '../../lib/csv/use-csv-document';
import { getSelectedColumnRange, getSelectedRowRange, shiftSelection } from '../../lib/csv/table-selection';
import type { TableSelection } from '../../lib/csv/table-selection';
import { replaceDocumentText } from '../../lib/editor/editor-session';

export interface EditingCell {
  row: number;
  column: number;
  initialValue: string;
}

/** Writes the edited table back into the document as one undoable change. */
function commit(csv: CsvDocument) {
  replaceDocumentText(serializeCsv(csv), 'input.table');
}

/** Table state (selection, editing) and every table operation. All edits go through the document text. */
export function useCsvTable(isFirstRowHeader: boolean) {
  const csv = useCsvDocument();
  const [selection, setSelection] = useState<TableSelection>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const rowCount = csv.rows.length;
  const columnCount = Math.max(csv.columnCount, 1);
  const firstMovableRow = isFirstRowHeader ? 1 : 0;

  function moveSelectedRows(offset: number) {
    const range = getSelectedRowRange(selection);
    if (!range || !canMoveRange(range, offset, rowCount, firstMovableRow)) return;
    commit(moveRows(csv, range, offset));
    setSelection(shiftSelection(selection, 'rows', offset));
  }

  function moveSelectedColumns(offset: number) {
    const range = getSelectedColumnRange(selection);
    if (!range || !canMoveRange(range, offset, csv.columnCount)) return;
    commit(moveColumns(csv, range, offset));
    setSelection(shiftSelection(selection, 'columns', offset));
  }

  function insertRowNextToSelection(position: 'above' | 'below') {
    const range = getSelectedRowRange(selection);
    const index = range ? (position === 'above' ? range.start : range.end + 1) : rowCount;
    commit(insertRow(csv, index));
    const column = selection?.kind === 'cell' ? selection.column : 0;
    setSelection({ kind: 'cell', row: index, column });
  }

  function insertColumnNextToSelection(position: 'left' | 'right') {
    const range = getSelectedColumnRange(selection);
    const index = range ? (position === 'left' ? range.start : range.end + 1) : csv.columnCount;
    commit(insertColumn(csv, index));
    const row = selection?.kind === 'cell' ? selection.row : 0;
    setSelection({ kind: 'cell', row, column: index });
  }

  function deleteSelectedRows() {
    const range = getSelectedRowRange(selection);
    if (!range) return;
    commit(deleteRows(csv, range));
    setSelection(null);
  }

  function deleteSelectedColumns() {
    const range = getSelectedColumnRange(selection);
    if (!range) return;
    commit(deleteColumns(csv, range));
    setSelection(null);
  }

  /** Sorts the rows below the header by the selected column. */
  function sortBySelectedColumn(direction: SortDirection) {
    const range = getSelectedColumnRange(selection);
    if (!range) return;
    commit(sortRows(csv, range.start, direction, firstMovableRow));
  }

  function setCellValue(row: number, column: number, value: string) {
    const currentValue = csv.rows[row]?.[column] ?? '';
    if (value !== currentValue) commit(setCell(csv, row, column, value));
  }

  /** Clears the selected cell, or removes the selected rows/columns (used by ⌫ and Cut). */
  function removeSelection() {
    if (selection?.kind === 'cell') setCellValue(selection.row, selection.column, '');
    if (selection?.kind === 'rows') deleteSelectedRows();
    if (selection?.kind === 'columns') deleteSelectedColumns();
  }

  function pasteText(clipboardText: string) {
    const region = parseClipboardRegion(clipboardText, csv.delimiter);
    const startRow = getSelectedRowRange(selection)?.start ?? rowCount;
    const startColumn = getSelectedColumnRange(selection)?.start ?? 0;
    if (region.length === 0) return;
    commit(pasteRegion(csv, startRow, startColumn, region));
  }

  /** The selection as delimited text, ready for the clipboard. */
  function getSelectionText(): string {
    const rows = selection?.kind === 'columns' ? { start: 0, end: rowCount - 1 } : getSelectedRowRange(selection);
    const columns = selection?.kind === 'rows' ? { start: 0, end: columnCount - 1 } : getSelectedColumnRange(selection);
    if (!rows || !columns || rowCount === 0) return '';
    return serializeRegion(csv, rows, columns);
  }

  return {
    csv,
    rowCount,
    columnCount,
    selection,
    setSelection,
    editingCell,
    setEditingCell,
    moveSelectedRows,
    moveSelectedColumns,
    insertRowNextToSelection,
    insertColumnNextToSelection,
    deleteSelectedRows,
    deleteSelectedColumns,
    sortBySelectedColumn,
    setCellValue,
    removeSelection,
    pasteText,
    getSelectionText,
  };
}
