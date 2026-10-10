import { useState } from 'react';

import { useDocumentStore } from '../../lib/documents/document-store';

const STORAGE_KEY_PREFIX = 'csv-column-widths:';
export const DEFAULT_COLUMN_WIDTH = 180;

function storageKey(path: string | null): string | null {
  return path ? `${STORAGE_KEY_PREFIX}${path}` : null;
}

function readStoredWidths(path: string | null): number[] {
  const key = storageKey(path);
  if (!key) return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.map((width) => (typeof width === 'number' ? width : DEFAULT_COLUMN_WIDTH)) : [];
  } catch {
    return [];
  }
}

function storeWidths(path: string | null, widths: number[]) {
  const key = storageKey(path);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(widths));
  } catch {
    // Storage can be unavailable; widths then only last while the window is open.
  }
}

/** Column widths of the table, remembered per file. */
export function useColumnWidths() {
  const path = useDocumentStore((state) => state.path);
  const [columnWidths, setColumnWidths] = useState<number[]>(() => readStoredWidths(path));

  function getColumnWidth(columnIndex: number): number {
    return columnWidths[columnIndex] ?? DEFAULT_COLUMN_WIDTH;
  }

  function setColumnWidth(columnIndex: number, width: number) {
    setColumnWidths((current) => {
      const next = Array.from({ length: Math.max(current.length, columnIndex + 1) }, (_, index) => current[index] ?? DEFAULT_COLUMN_WIDTH);
      next[columnIndex] = Math.round(width);
      storeWidths(path, next);
      return next;
    });
  }

  return { getColumnWidth, setColumnWidth };
}
