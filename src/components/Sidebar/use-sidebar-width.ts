import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { SIDEBAR_SIDE } from '../../lib/settings/settings-schema';
import type { SidebarSide } from '../../lib/settings/settings-schema';

const STORAGE_KEY = 'folder-sidebar-width';
const DEFAULT_WIDTH = 260;
const MINIMUM_WIDTH = 180;
const MAXIMUM_WIDTH = 520;

function clampWidth(width: number): number {
  return Math.min(MAXIMUM_WIDTH, Math.max(MINIMUM_WIDTH, width));
}

function readStoredWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored ? clampWidth(stored) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function storeWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Storage can be unavailable; the width then only lasts for this window.
  }
}

/** Sidebar width, resizable by dragging its inner edge (the one facing the document), remembered between windows. */
export function useSidebarWidth(side: SidebarSide) {
  const [width, setWidth] = useState(readStoredWidth);
  const dragStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { pointerX: event.clientX, width };
  }

  // A right-hand sidebar grows when dragged left; a left-hand one when dragged right.
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    const distance = event.clientX - dragStart.pointerX;
    setWidth(clampWidth(dragStart.width + (side === SIDEBAR_SIDE.left ? distance : -distance)));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    storeWidth(width);
  }

  return { width, resizeHandleProps: { onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp } };
}
