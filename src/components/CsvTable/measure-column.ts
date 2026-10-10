import type { CsvDocument } from '../../lib/csv/csv-model';

const MINIMUM_FIT_WIDTH = 60;
const MAXIMUM_FIT_WIDTH = 480;
const MEASURED_ROW_LIMIT = 500;
// Cell padding (9px each side) plus the border.
const CELL_CHROME_WIDTH = 20;

let measuringContext: CanvasRenderingContext2D | null = null;

function getMeasuringContext(): CanvasRenderingContext2D | null {
  measuringContext ??= document.createElement('canvas').getContext('2d');
  return measuringContext;
}

/** The width that fits the widest line in a column (from the first rows), within sensible limits. */
export function measureColumnWidth(csv: CsvDocument, columnIndex: number, table: HTMLTableElement | null): number | null {
  const context = getMeasuringContext();
  const sampleCell = table?.querySelector('td');
  if (!context || !sampleCell) return null;

  context.font = getComputedStyle(sampleCell).font;
  let widestLine = 0;
  for (const row of csv.rows.slice(0, MEASURED_ROW_LIMIT)) {
    for (const line of (row[columnIndex] ?? '').split('\n')) {
      widestLine = Math.max(widestLine, context.measureText(line).width);
    }
  }
  return Math.min(MAXIMUM_FIT_WIDTH, Math.max(MINIMUM_FIT_WIDTH, Math.ceil(widestLine + CELL_CHROME_WIDTH)));
}
