import { useRef } from 'react';

/**
 * For in-place editors that can be left several ways (↩, ⎋, blur): only the first exit runs.
 * Blur also fires when the editor is removed after ↩ or ⎋, which would otherwise save twice.
 */
export function useExitOnce(): (exit: () => void) => void {
  const hasExitedRef = useRef(false);
  return function exitOnce(exit: () => void) {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    exit();
  };
}
