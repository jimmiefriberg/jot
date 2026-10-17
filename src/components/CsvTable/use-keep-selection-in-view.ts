import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

/**
 * Scrolls the selected cell into view when the selection moves (arrow keys, the filter's ↩).
 * A row far outside the drawn rows is scrolled to first, so it gets drawn.
 */
export function useKeepSelectionInView(
  viewRef: RefObject<HTMLDivElement | null>,
  virtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>,
  row: number | null,
  column: number | null,
  /** Where the row is in the drawn list, or -1 for the header row (always drawn) and filtered-out rows. */
  rowPosition: number,
): void {
  useEffect(() => {
    const view = viewRef.current;
    if (!view || row === null) return;
    const selector = column === null ? `[data-row-header="${row}"]` : `[data-row="${row}"][data-column="${column}"]`;

    function revealCell() {
      view?.querySelector(selector)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    if (view.querySelector(selector) || rowPosition === -1) {
      revealCell();
      return;
    }
    virtualizer.scrollToIndex(rowPosition, { align: 'center' });
    const frame = requestAnimationFrame(revealCell);
    return function cancelReveal() {
      cancelAnimationFrame(frame);
    };
  }, [viewRef, virtualizer, row, column, rowPosition]);
}
