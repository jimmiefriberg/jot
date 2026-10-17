import { memo } from 'react';
import type { ReactNode } from 'react';

interface CsvRowProps {
  rowIndex: number;
  cells: string[];
  columnCount: number;
  isHeader: boolean;
  isRowSelected: boolean;
  /** First and last highlighted column in this row, or -1 when none is. */
  selectedFrom: number;
  selectedTo: number;
  editingColumn: number;
  editor: ReactNode;
  /** Columns of numbers, right-aligned so digits line up. */
  numericColumns: Set<number>;
  /** For body rows: the row's place in the drawn list, and the callback that measures its height. */
  virtualIndex?: number;
  measureRef?: (element: HTMLTableRowElement | null) => void;
}

function cellClassName(isSelected: boolean, isNumeric: boolean): string | undefined {
  const classNames = [isSelected && 'is-selected', isNumeric && 'is-numeric'].filter(Boolean);
  return classNames.length > 0 ? classNames.join(' ') : undefined;
}

/** One table row. Memoised because big tables re-render on every selection change, but only a few rows change. */
export const CsvRow = memo(function CsvRow({
  rowIndex,
  cells,
  columnCount,
  isHeader,
  isRowSelected,
  selectedFrom,
  selectedTo,
  editingColumn,
  editor,
  numericColumns,
  virtualIndex,
  measureRef,
}: CsvRowProps) {
  const CellTag = isHeader ? 'th' : 'td';
  const columnIndexes = Array.from({ length: columnCount }, (_, columnIndex) => columnIndex);

  return (
    <tr ref={measureRef} data-index={virtualIndex} className={isHeader ? 'csv-header-row' : undefined}>
      <th className={`csv-row-number${isRowSelected ? ' is-selected' : ''}`} data-row-header={rowIndex}>
        {rowIndex + 1}
      </th>
      {columnIndexes.map((columnIndex) => (
        <CellTag
          key={columnIndex}
          className={cellClassName(columnIndex >= selectedFrom && columnIndex <= selectedTo, !isHeader && numericColumns.has(columnIndex))}
          data-row={rowIndex}
          data-column={columnIndex}
        >
          {columnIndex === editingColumn ? editor : cells[columnIndex]}
        </CellTag>
      ))}
    </tr>
  );
});
