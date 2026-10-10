import { VIEW_MODE } from './file-kind';
import { setViewMode } from './document-store';
import { revealLine, revealOffset } from '../editor/editor-session';

/** Switches to the plain editor and puts the cursor on a (zero-based) line. */
export function revealLineInSource(lineIndex: number): void {
  setViewMode(VIEW_MODE.plain);
  requestAnimationFrame(() => revealLine(lineIndex));
}

/** Switches to the plain editor and puts the cursor at a character offset. */
export function revealOffsetInSource(offset: number): void {
  setViewMode(VIEW_MODE.plain);
  requestAnimationFrame(() => revealOffset(offset));
}
