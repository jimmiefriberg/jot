import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * The table takes keyboard and clipboard input through a hidden textarea that holds the selection as text.
 * Keeping that text selected lets the native Copy/Cut menu items work without custom clipboard code.
 */
export function useKeyboardSink(sinkRef: RefObject<HTMLTextAreaElement | null>, selectionText: string, isActive: boolean): void {
  useEffect(() => {
    const sink = sinkRef.current;
    if (!sink || !isActive) return;
    if (document.activeElement !== sink) sink.focus({ preventScroll: true });
    sink.select();
  }, [sinkRef, selectionText, isActive]);
}
