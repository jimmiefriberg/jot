import type { PointerEvent } from 'react';

import { moveSplitDivider } from '../../lib/tauri/backend';

let pendingScreenX: number | null = null;

// Sends at most one move per frame while dragging.
function sendPendingMove() {
  if (pendingScreenX === null) return;
  void moveSplitDivider(pendingScreenX);
  pendingScreenX = null;
}

function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
  if (pendingScreenX === null) requestAnimationFrame(sendPendingMove);
  pendingScreenX = event.screenX;
}

function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.releasePointerCapture(event.pointerId);
}

function handleDoubleClick() {
  void moveSplitDivider(null);
}

/** The handle on the left pane's right edge of a split: drag to resize the panes, double-click to even them out. */
export function PaneDivider() {
  return (
    <div
      className="pane-divider"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    />
  );
}
