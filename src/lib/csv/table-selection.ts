import type { IndexRange } from './csv-model';

export type TableSelection =
  | { kind: 'cell'; row: number; column: number }
  | { kind: 'rows'; anchor: number; focus: number }
  | { kind: 'columns'; anchor: number; focus: number }
  | null;

function rangeBetween(anchor: number, focus: number): IndexRange {
  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

/** The rows a command should act on: the selected rows, or the row of the selected cell. */
export function getSelectedRowRange(selection: TableSelection): IndexRange | null {
  if (selection?.kind === 'cell') return { start: selection.row, end: selection.row };
  if (selection?.kind === 'rows') return rangeBetween(selection.anchor, selection.focus);
  return null;
}

/** The columns a command should act on: the selected columns, or the column of the selected cell. */
export function getSelectedColumnRange(selection: TableSelection): IndexRange | null {
  if (selection?.kind === 'cell') return { start: selection.column, end: selection.column };
  if (selection?.kind === 'columns') return rangeBetween(selection.anchor, selection.focus);
  return null;
}

/** Moves the selection along with rows or columns that were just moved by `offset`. */
export function shiftSelection(selection: TableSelection, axis: 'rows' | 'columns', offset: number): TableSelection {
  if (!selection) return selection;
  if (selection.kind === 'cell') {
    return axis === 'rows'
      ? { ...selection, row: selection.row + offset }
      : { ...selection, column: selection.column + offset };
  }
  if (selection.kind !== axis) return selection;
  return { ...selection, anchor: selection.anchor + offset, focus: selection.focus + offset };
}

/** Whether a cell is highlighted by the current selection. */
export function isCellSelected(selection: TableSelection, row: number, column: number): boolean {
  if (!selection) return false;
  if (selection.kind === 'cell') return selection.row === row && selection.column === column;
  const range = rangeBetween(selection.anchor, selection.focus);
  const index = selection.kind === 'rows' ? row : column;
  return index >= range.start && index <= range.end;
}

function isInRange(range: IndexRange | null, index: number): boolean {
  return range !== null && index >= range.start && index <= range.end;
}

export function isRowHeaderSelected(selection: TableSelection, row: number): boolean {
  return selection?.kind === 'rows' && isInRange(getSelectedRowRange(selection), row);
}

export function isColumnHeaderSelected(selection: TableSelection, column: number): boolean {
  return selection?.kind === 'columns' && isInRange(getSelectedColumnRange(selection), column);
}
