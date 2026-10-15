import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';

import { SORT_DIRECTION, columnLabel, detectNumericColumns, filterRowIndexes } from '../../lib/csv/csv-model';
import { getSelectedColumnRange, isColumnHeaderSelected, isRowHeaderSelected } from '../../lib/csv/table-selection';
import type { TableSelection } from '../../lib/csv/table-selection';
import { useViewCommands } from '../../lib/commands/use-view-commands';
import { useSettingsStore } from '../../lib/settings/settings-store';
import { Icon } from '../Icon/Icon';
import { CellEditor } from './CellEditor';
import type { CellExit } from './CellEditor';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import { CsvRow } from './CsvRow';
import { measureColumnWidth } from './measure-column';
import { useColumnWidths } from './use-column-widths';
import { useCsvTable } from './use-csv-table';
import { useKeyboardSink } from './use-keyboard-sink';

const ROW_NUMBER_WIDTH = 52;
const ROWS_PAGE_SIZE = 2000;

const ARROW_OFFSETS: Record<string, { rows: number; columns: number }> = {
  ArrowUp: { rows: -1, columns: 0 },
  ArrowDown: { rows: 1, columns: 0 },
  ArrowLeft: { rows: 0, columns: -1 },
  ArrowRight: { rows: 0, columns: 1 },
};

function readIndex(element: Element | null, attribute: string): number | null {
  const value = element?.getAttribute(attribute);
  return value === null || value === undefined ? null : Number(value);
}

/** Simple CSV table: resizable columns, wrapped cells, row/column selection, ⌥+arrow moves, sorting and a filter. */
export function CsvTable() {
  const isFirstRowHeader = useSettingsStore((state) => state.settings.csvFirstRowIsHeader);
  const table = useCsvTable(isFirstRowHeader);
  const { csv, rowCount, columnCount, selection, setSelection, editingCell, setEditingCell } = table;
  const { getColumnWidth, setColumnWidth } = useColumnWidths();
  const [visibleRowLimit, setVisibleRowLimit] = useState(ROWS_PAGE_SIZE);
  const [filterQuery, setFilterQuery] = useState('');
  const sinkRef = useRef<HTMLTextAreaElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const hasHeaderRow = isFirstRowHeader && rowCount > 0;
  const firstBodyRow = hasHeaderRow ? 1 : 0;
  // Both walk every row, so they're only redone when the table or the filter changes.
  const matchingRowIndexes = useMemo(() => filterRowIndexes(csv, filterQuery, firstBodyRow), [csv, filterQuery, firstBodyRow]);
  const numericColumns = useMemo(() => detectNumericColumns(csv, firstBodyRow), [csv, firstBodyRow]);
  const bodyRowCount = rowCount - firstBodyRow;
  const isFiltering = filterQuery.trim().length > 0;
  const selectedColumn = getSelectedColumnRange(selection)?.start ?? null;

  const selectionText = table.getSelectionText();
  useKeyboardSink(sinkRef, selectionText, editingCell === null);

  function moveRowsUp() {
    table.moveSelectedRows(-1);
  }

  function moveRowsDown() {
    table.moveSelectedRows(1);
  }

  function moveColumnsLeft() {
    table.moveSelectedColumns(-1);
  }

  function moveColumnsRight() {
    table.moveSelectedColumns(1);
  }

  function insertRowAbove() {
    table.insertRowNextToSelection('above');
  }

  function insertRowBelow() {
    table.insertRowNextToSelection('below');
  }

  function insertColumnLeft() {
    table.insertColumnNextToSelection('left');
  }

  function insertColumnRight() {
    table.insertColumnNextToSelection('right');
  }

  function sortAscending() {
    table.sortBySelectedColumn(SORT_DIRECTION.ascending);
  }

  function sortDescending() {
    table.sortBySelectedColumn(SORT_DIRECTION.descending);
  }

  function focusFilter() {
    filterInputRef.current?.focus();
    filterInputRef.current?.select();
  }

  useViewCommands({
    'selection.moveLineUp': moveRowsUp,
    'selection.moveLineDown': moveRowsDown,
    'selection.insertLineAbove': insertRowAbove,
    'selection.insertLineBelow': insertRowBelow,
    'table.insertRowAbove': insertRowAbove,
    'table.insertRowBelow': insertRowBelow,
    'selection.deleteLine': table.deleteSelectedRows,
    'table.deleteRows': table.deleteSelectedRows,
    'table.deleteColumns': table.deleteSelectedColumns,
    'table.insertColumnLeft': insertColumnLeft,
    'table.insertColumnRight': insertColumnRight,
    'table.moveColumnLeft': moveColumnsLeft,
    'table.moveColumnRight': moveColumnsRight,
    'table.sortAscending': sortAscending,
    'table.sortDescending': sortDescending,
    'table.filter': focusFilter,
    'edit.find': focusFilter,
  });

  function handleAutoFit(columnIndex: number) {
    const width = measureColumnWidth(csv, columnIndex, tableRef.current);
    if (width !== null) setColumnWidth(columnIndex, width);
  }

  function focusTable() {
    sinkRef.current?.focus({ preventScroll: true });
  }

  function selectCell(row: number, column: number) {
    const clampedRow = Math.min(Math.max(row, 0), Math.max(rowCount - 1, 0));
    const clampedColumn = Math.min(Math.max(column, 0), columnCount - 1);
    setSelection({ kind: 'cell', row: clampedRow, column: clampedColumn });
  }

  /** The row `step` rows above or below, skipping rows the filter hides. */
  function stepRow(row: number, step: number): number {
    const navigableRows = hasHeaderRow ? [0, ...matchingRowIndexes] : matchingRowIndexes;
    const position = navigableRows.indexOf(row);
    if (position === -1) return navigableRows[0] ?? 0;
    return navigableRows[Math.min(Math.max(position + step, 0), navigableRows.length - 1)];
  }

  function startEditing(row: number, column: number, initialValue?: string) {
    setSelection({ kind: 'cell', row, column });
    setEditingCell({ row, column, initialValue: initialValue ?? csv.rows[row]?.[column] ?? '' });
  }

  function handleCommitCell(value: string, exit: CellExit) {
    if (!editingCell) return;
    table.setCellValue(editingCell.row, editingCell.column, value);
    setEditingCell(null);
    if (exit === 'down') selectCell(stepRow(editingCell.row, 1), editingCell.column);
    if (exit === 'right') selectCell(editingCell.row, editingCell.column + 1);
    focusTable();
  }

  function handleCancelEdit() {
    setEditingCell(null);
    focusTable();
  }

  function selectHeader(kind: 'rows' | 'columns', index: number, isExtending: boolean) {
    const anchor = isExtending && selection?.kind === kind ? selection.anchor : index;
    setSelection({ kind, anchor, focus: index });
  }

  // Clicking cells must not move focus away from the keyboard sink (or an open cell editor).
  function handleTableMouseDown(event: MouseEvent<HTMLTableElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest('.csv-cell-editor')) return;
    event.preventDefault();
  }

  function handleTableClick(event: MouseEvent<HTMLTableElement>) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.csv-resize-handle, .csv-cell-editor')) return;

    const columnHeader = readIndex(target.closest('[data-column-header]'), 'data-column-header');
    const rowHeader = readIndex(target.closest('[data-row-header]'), 'data-row-header');
    const cell = target.closest('[data-row][data-column]');
    if (columnHeader !== null) selectHeader('columns', columnHeader, event.shiftKey);
    else if (rowHeader !== null) selectHeader('rows', rowHeader, event.shiftKey);
    else if (cell) selectCell(readIndex(cell, 'data-row') ?? 0, readIndex(cell, 'data-column') ?? 0);
    if (!editingCell) focusTable();
  }

  function handleTableDoubleClick(event: MouseEvent<HTMLTableElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest('[data-row][data-column]');
    if (!cell || target.closest('.csv-cell-editor')) return;
    startEditing(readIndex(cell, 'data-row') ?? 0, readIndex(cell, 'data-column') ?? 0);
  }

  function moveSelectionWithArrow(key: string, isExtending: boolean) {
    const offset = ARROW_OFFSETS[key];
    if (!selection) {
      selectCell(stepRow(-1, 0), 0);
      return;
    }
    if (selection.kind === 'cell') {
      const row = offset.rows === 0 ? selection.row : stepRow(selection.row, offset.rows);
      selectCell(row, selection.column + offset.columns);
      return;
    }
    const step = selection.kind === 'rows' ? offset.rows : offset.columns;
    const limit = selection.kind === 'rows' ? rowCount : columnCount;
    const focus = Math.min(Math.max(selection.focus + step, 0), limit - 1);
    if (isExtending) setSelection({ ...selection, focus });
    else if (selection.kind === 'rows') selectCell(focus, 0);
    else selectCell(0, focus);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.metaKey || event.ctrlKey) return;
    const { key } = event;

    if (event.altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault();
      if (key === 'ArrowLeft') moveColumnsLeft();
      else moveColumnsRight();
      return;
    }
    if (key in ARROW_OFFSETS && !event.altKey) {
      event.preventDefault();
      moveSelectionWithArrow(key, event.shiftKey);
      return;
    }
    if (key === 'Tab' && selection?.kind === 'cell') {
      event.preventDefault();
      selectCell(selection.row, selection.column + (event.shiftKey ? -1 : 1));
      return;
    }
    if ((key === 'Enter' || key === 'F2') && selection?.kind === 'cell') {
      event.preventDefault();
      startEditing(selection.row, selection.column);
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      setSelection(null);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      table.removeSelection();
      return;
    }
    // Typing on a selected cell starts editing it, like a spreadsheet.
    if (key.length === 1 && selection?.kind === 'cell') {
      event.preventDefault();
      startEditing(selection.row, selection.column, key);
    }
  }

  function handleCut() {
    // The browser copies the sink's selected text first; then the selection is removed.
    requestAnimationFrame(table.removeSelection);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    table.pasteText(event.clipboardData.getData('text/plain'));
  }

  /** The "+" under the table: adds a row at the end and starts editing its first cell. */
  function handleAddRow() {
    const newRowIndex = table.appendRow();
    setFilterQuery('');
    setVisibleRowLimit((limit) => Math.max(limit, bodyRowCount + 1));
    startEditing(newRowIndex, 0, '');
  }

  function handleShowMoreRows() {
    setVisibleRowLimit((limit) => limit + ROWS_PAGE_SIZE);
  }

  function handleFilterChange(event: ChangeEvent<HTMLInputElement>) {
    setFilterQuery(event.target.value);
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setFilterQuery('');
      focusTable();
    }
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      const firstMatch = matchingRowIndexes[0];
      if (firstMatch !== undefined) selectCell(firstMatch, selectedColumn ?? 0);
      focusTable();
    }
  }

  function renderRow(rowIndex: number, isHeader: boolean) {
    const isEditingRow = editingCell?.row === rowIndex;
    const highlighted = getHighlightedColumns(selection, rowIndex, columnCount);
    return (
      <CsvRow
        key={rowIndex}
        rowIndex={rowIndex}
        cells={csv.rows[rowIndex]}
        columnCount={columnCount}
        isHeader={isHeader}
        isRowSelected={isRowHeaderSelected(selection, rowIndex)}
        selectedFrom={highlighted.from}
        selectedTo={highlighted.to}
        editingColumn={isEditingRow ? editingCell.column : -1}
        numericColumns={numericColumns}
        editor={
          isEditingRow ? (
            <CellEditor initialValue={editingCell.initialValue} onCommit={handleCommitCell} onCancel={handleCancelEdit} />
          ) : null
        }
      />
    );
  }

  const shownRowIndexes = matchingRowIndexes.slice(0, visibleRowLimit);
  const hiddenRowCount = matchingRowIndexes.length - shownRowIndexes.length;
  const columnIndexes = Array.from({ length: columnCount }, (_, columnIndex) => columnIndex);
  const tableWidth = ROW_NUMBER_WIDTH + columnIndexes.reduce((total, columnIndex) => total + getColumnWidth(columnIndex), 0);

  return (
    <div className="formatted-view csv-view">
      <textarea
        ref={sinkRef}
        className="csv-keyboard-sink"
        value={selectionText}
        onChange={ignoreChange}
        onKeyDown={handleKeyDown}
        onCut={handleCut}
        onPaste={handlePaste}
        aria-label="Table keyboard input"
        autoFocus
      />
      <div className="view-toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={14} />
          <input
            ref={filterInputRef}
            value={filterQuery}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            placeholder="Filter rows"
            spellCheck={false}
            aria-label="Filter rows"
          />
          {isFiltering && (
            <span className="toolbar-search-count">
              {matchingRowIndexes.length.toLocaleString()} of {bodyRowCount.toLocaleString()}
            </span>
          )}
        </div>
        <div className="toolbar-group">
          <button
            className="icon-button"
            onClick={sortAscending}
            disabled={selectedColumn === null}
            title={selectedColumn === null ? 'Select a column to sort by' : `Sort by column ${columnLabel(selectedColumn)}, A→Z`}
            aria-label="Sort ascending"
          >
            <Icon name="sortAscending" />
          </button>
          <button
            className="icon-button"
            onClick={sortDescending}
            disabled={selectedColumn === null}
            title={selectedColumn === null ? 'Select a column to sort by' : `Sort by column ${columnLabel(selectedColumn)}, Z→A`}
            aria-label="Sort descending"
          >
            <Icon name="sortDescending" />
          </button>
        </div>
      </div>
      {rowCount === 0 ? (
        <div className="empty-state">
          <p>This table is empty.</p>
          <button onClick={insertRowBelow}>Add row</button>
        </div>
      ) : (
        <table
          ref={tableRef}
          className="csv-table"
          style={{ width: tableWidth }}
          onMouseDown={handleTableMouseDown}
          onClick={handleTableClick}
          onDoubleClick={handleTableDoubleClick}
        >
          <colgroup>
            <col style={{ width: ROW_NUMBER_WIDTH }} />
            {columnIndexes.map((columnIndex) => (
              <col key={columnIndex} style={{ width: getColumnWidth(columnIndex) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="csv-letters-row">
              <th className="csv-corner" />
              {columnIndexes.map((columnIndex) => (
                <th
                  key={columnIndex}
                  className={isColumnHeaderSelected(selection, columnIndex) ? 'is-selected' : undefined}
                  data-column-header={columnIndex}
                >
                  {columnLabel(columnIndex)}
                  <ColumnResizeHandle
                    columnIndex={columnIndex}
                    width={getColumnWidth(columnIndex)}
                    onResize={setColumnWidth}
                    onAutoFit={handleAutoFit}
                  />
                </th>
              ))}
            </tr>
            {hasHeaderRow && renderRow(0, true)}
          </thead>
          <tbody>{shownRowIndexes.map((rowIndex) => renderRow(rowIndex, false))}</tbody>
        </table>
      )}
      {isFiltering && matchingRowIndexes.length === 0 && rowCount > 0 && <p className="empty-state">No rows match “{filterQuery}”.</p>}
      {hiddenRowCount > 0 && (
        <button className="show-more-button" onClick={handleShowMoreRows}>
          Show {Math.min(hiddenRowCount, ROWS_PAGE_SIZE).toLocaleString()} more rows of {hiddenRowCount.toLocaleString()}
        </button>
      )}
      {rowCount > 0 && hiddenRowCount === 0 && (
        <button className="csv-add-row" style={{ width: tableWidth }} onClick={handleAddRow} title="Add a row at the end">
          <Icon name="plus" size={14} />
          Add row
        </button>
      )}
    </div>
  );
}

function ignoreChange() {
  // The sink only carries keyboard and clipboard events; its text always mirrors the selection.
}

function getHighlightedColumns(selection: TableSelection, rowIndex: number, columnCount: number) {
  const none = { from: -1, to: -1 };
  if (!selection) return none;
  if (selection.kind === 'rows') {
    return isRowHeaderSelected(selection, rowIndex) ? { from: 0, to: columnCount - 1 } : none;
  }
  if (selection.kind === 'cell' && selection.row !== rowIndex) return none;
  const range = getSelectedColumnRange(selection);
  return range ? { from: range.start, to: range.end } : none;
}
