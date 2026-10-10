import { useEffect } from 'react';
import type { RefObject } from 'react';

import { FILE_KIND, VIEW_MODE } from '../../lib/documents/file-kind';
import { useDocumentStore, useIsLivePreview } from '../../lib/documents/document-store';
import {
  createEditor,
  destroyEditor,
  focusEditor,
  getEditorView,
  reconfigureEditor,
  replaceDocumentText,
} from '../../lib/editor/editor-session';
import type { EditorOptions } from '../../lib/editor/editor-session';
import { useSettingsStore } from '../../lib/settings/settings-store';
import { useIsWordWrapEnabled, useWindowViewStore } from '../../lib/window/window-view-store';

/** The editor options as they are right now, read outside React (for creating the editor). */
function currentEditorOptions(): EditorOptions {
  const { kind, viewMode } = useDocumentStore.getState();
  const { settings } = useSettingsStore.getState();
  const { wordWrapOverride } = useWindowViewStore.getState();
  return {
    kind,
    tabSize: settings.tabSize,
    isWordWrapEnabled: wordWrapOverride ?? settings.isWordWrapEnabled,
    showLineNumbers: settings.showLineNumbers,
    highlightActiveLine: settings.highlightActiveLine,
    showInvisibles: settings.showInvisibles,
    isTypewriterScrolling: settings.isTypewriterScrolling,
    isFocusMode: settings.isFocusMode,
    isLivePreview: kind === FILE_KIND.markdown && viewMode === VIEW_MODE.formatted,
  };
}

/** Creates the CodeMirror editor inside the container and keeps it configured from settings and the file kind. */
export function useCodeMirror(containerRef: RefObject<HTMLDivElement | null>, initialText: string, isVisible: boolean): void {
  const kind = useDocumentStore((state) => state.kind);
  const settings = useSettingsStore((state) => state.settings);
  const { tabSize, showLineNumbers, highlightActiveLine, showInvisibles, isTypewriterScrolling, isFocusMode } = settings;
  const isWordWrapEnabled = useIsWordWrapEnabled();
  const isLivePreview = useIsLivePreview();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { lineSeparator, pendingStartingText } = useDocumentStore.getState();
    createEditor(container, initialText, lineSeparator, currentEditorOptions());
    // A recovered draft or converted document goes on top of the file as an unsaved (undoable) change.
    if (pendingStartingText !== null) replaceDocumentText(pendingStartingText, 'input.recover');
    // Bumping the revision makes formatted views re-read the text from this new editor.
    useDocumentStore.setState((state) => ({ isEditorReady: true, revision: state.revision + 1 }));
    return function cleanUpEditor() {
      useDocumentStore.setState({ isEditorReady: false });
      destroyEditor();
    };
  }, [containerRef, initialText]);

  useEffect(() => {
    reconfigureEditor({
      kind,
      tabSize,
      isWordWrapEnabled,
      showLineNumbers,
      highlightActiveLine,
      showInvisibles,
      isTypewriterScrolling,
      isFocusMode,
      isLivePreview,
    });
  }, [kind, tabSize, isWordWrapEnabled, showLineNumbers, highlightActiveLine, showInvisibles, isTypewriterScrolling, isFocusMode, isLivePreview]);

  useEffect(() => {
    if (!isVisible) return;
    getEditorView()?.requestMeasure();
    focusEditor();
  }, [isVisible]);
}
