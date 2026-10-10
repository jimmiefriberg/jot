import { useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

const MINIMUM_COLUMN_WIDTH = 60;

interface ColumnResizeHandleProps {
  columnIndex: number;
  width: number;
  onResize: (columnIndex: number, width: number) => void;
  /** Double-click fits the column to its contents. */
  onAutoFit: (columnIndex: number) => void;
}

/** Drag handle on the right edge of a column header. */
export function ColumnResizeHandle({ columnIndex, width, onResize, onAutoFit }: ColumnResizeHandleProps) {
  const dragStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { pointerX: event.clientX, width };
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    const nextWidth = Math.max(MINIMUM_COLUMN_WIDTH, dragStart.width + event.clientX - dragStart.pointerX);
    onResize(columnIndex, nextWidth);
  }

  function handlePointerUp(event: PointerEvent<HTMLSpanElement>) {
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleDoubleClick(event: MouseEvent<HTMLSpanElement>) {
    event.stopPropagation();
    onAutoFit(columnIndex);
  }

  return (
    <span
      className="csv-resize-handle"
      title="Drag to resize, double-click to fit"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    />
  );
}
