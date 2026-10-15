import { useEffect } from 'react';
import type { RefObject } from 'react';

import { useDocumentStore } from '../../lib/documents/document-store';
import { createSideBySidePreview, getEditorView, syncSideBySidePreview, syncSideBySideScroll } from '../../lib/editor/editor-session';

/** Creates the preview in the container, keeps its text in step with the document and its scroll in step with the editor. */
export function useSideBySidePreview(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    const editor = getEditorView();
    if (!container || !editor) return;
    const preview = createSideBySidePreview(container);
    let frame = 0;

    function scheduleScrollSync() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function syncScroll() {
        syncSideBySideScroll(preview);
      });
    }

    function handleDocumentChange() {
      syncSideBySidePreview(preview);
      scheduleScrollSync();
    }

    const unsubscribe = useDocumentStore.subscribe(function handleStoreChange(state, previousState) {
      if (state.revision !== previousState.revision) handleDocumentChange();
    });
    editor.scrollDOM.addEventListener('scroll', scheduleScrollSync, { passive: true });
    scheduleScrollSync();
    return function cleanUpPreview() {
      unsubscribe();
      editor.scrollDOM.removeEventListener('scroll', scheduleScrollSync);
      cancelAnimationFrame(frame);
      preview.destroy();
    };
  }, [containerRef]);
}
