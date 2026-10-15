import type { KeyboardEvent } from 'react';

const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const VERTICAL_KEYS = new Set(['ArrowUp', 'ArrowDown']);

/** How far ↑/↓ move: one row in a grid of cards, one button in a single row. */
function verticalStep(buttons: HTMLButtonElement[]): number {
  const columnCount = buttons.filter((button) => button.offsetTop === buttons[0].offsetTop).length;
  return columnCount < buttons.length ? columnCount : 1;
}

function findTargetIndex(key: string, currentIndex: number, buttons: HTMLButtonElement[]): number | null {
  const lastIndex = buttons.length - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return lastIndex;
  const step = VERTICAL_KEYS.has(key) ? verticalStep(buttons) : 1;
  if (NEXT_KEYS.has(key)) return Math.min(lastIndex, currentIndex + step);
  if (PREVIOUS_KEYS.has(key)) return Math.max(0, currentIndex - step);
  return null;
}

/**
 * Arrow keys, Home and End move between the buttons of a group (tabs, a segmented control, theme cards)
 * and choose the one they land on, so a group is one Tab stop instead of one per button.
 */
export function handleChoiceGroupKeyDown(event: KeyboardEvent<HTMLElement>): void {
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > button'));
  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  if (currentIndex === -1) return;
  const targetIndex = findTargetIndex(event.key, currentIndex, buttons);
  if (targetIndex === null) return;
  event.preventDefault();
  buttons[targetIndex].focus();
  buttons[targetIndex].click();
}
