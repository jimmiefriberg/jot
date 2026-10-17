import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * The table takes keyboard and clipboard input through a hidden textarea. It holds a placeholder kept selected, so the
 * native Copy and Cut menu items stay enabled; the copy handlers fill in the real cells only when they're used.
 */
export function useKeyboardSink(sinkRef: RefObject<HTMLTextAreaElement | null>, selection: unknown, isActive: boolean): void {
  useEffect(() => {
    const sink = sinkRef.current;
    if (!sink || !isActive) return;
    if (document.activeElement !== sink) sink.focus({ preventScroll: true });
    sink.select();
  }, [sinkRef, selection, isActive]);
}
