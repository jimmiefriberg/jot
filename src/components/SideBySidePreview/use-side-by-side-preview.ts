import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';

import { useDocumentStore } from '../../lib/documents/document-store';
import { alignScroll, createSideBySidePreview, getEditorView, syncSideBySidePreview } from '../../lib/editor/editor-session';

// What counts as working in one side, which makes it the side the other one follows.
const LEADING_EVENTS = ['wheel', 'pointerdown', 'keydown', 'focusin'] as const;

/**
 * Creates the preview in the container and keeps its text in step with the document. Scrolling either side scrolls the
 * other: the side last scrolled, clicked or typed in leads, so the two never chase each other.
 */
export function useSideBySidePreview(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    const editorView = getEditorView();
    if (!container || !editorView) return;
    const editor: EditorView = editorView;
    const preview = createSideBySidePreview(container);
    let leader: EditorView = editor;
    let frame = 0;

    function scheduleScrollSync() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function syncScroll() {
        alignScroll(leader, leader === editor ? preview : editor);
      });
    }

    function handleEditorScroll() {
      if (leader === editor) scheduleScrollSync();
    }

    function handlePreviewScroll() {
      if (leader === preview) scheduleScrollSync();
    }

    function leadWithEditor() {
      leader = editor;
    }

    function leadWithPreview() {
      leader = preview;
    }

    function handleDocumentChange() {
      syncSideBySidePreview(preview);
      leader = editor;
      scheduleScrollSync();
    }

    const unsubscribe = useDocumentStore.subscribe(function handleStoreChange(state, previousState) {
      if (state.revision !== previousState.revision) handleDocumentChange();
    });
    for (const eventName of LEADING_EVENTS) {
      editor.dom.addEventListener(eventName, leadWithEditor, { passive: true });
      preview.dom.addEventListener(eventName, leadWithPreview, { passive: true });
    }
    editor.scrollDOM.addEventListener('scroll', handleEditorScroll, { passive: true });
    preview.scrollDOM.addEventListener('scroll', handlePreviewScroll, { passive: true });
    scheduleScrollSync();
    return function cleanUpPreview() {
      unsubscribe();
      for (const eventName of LEADING_EVENTS) {
        editor.dom.removeEventListener(eventName, leadWithEditor);
        preview.dom.removeEventListener(eventName, leadWithPreview);
      }
      editor.scrollDOM.removeEventListener('scroll', handleEditorScroll);
      preview.scrollDOM.removeEventListener('scroll', handlePreviewScroll);
      cancelAnimationFrame(frame);
      preview.destroy();
    };
  }, [containerRef]);
}
