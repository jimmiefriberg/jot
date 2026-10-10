import { create } from 'zustand';

import { FILE_KIND, VIEW_MODE, hasFormattedView, hasSeparateFormattedView } from './file-kind';
import type { FileKind, ViewMode } from './file-kind';

export interface CursorPosition {
  line: number;
  column: number;
  selectedCharacters: number;
  selectionCount: number;
}

interface DocumentState {
  path: string | null;
  kind: FileKind;
  viewMode: ViewMode;
  isLoaded: boolean;
  /** Changes whenever a different file is loaded into this window, so the editor and views start fresh. */
  documentId: number;
  /** The text the editor starts with for the current document (what's on disk). */
  initialText: string;
  /** Unsaved text to put on top of `initialText` once the editor exists (a recovered draft or a conversion). */
  pendingStartingText: string | null;
  /** Names this window's crash-recovery draft file. */
  draftId: string;
  /** True once the editor holds the document, so formatted views can read it. */
  isEditorReady: boolean;
  isDirty: boolean;
  /** Increments on every document change, so formatted views know when to re-read the text. */
  revision: number;
  modifiedTime: number | null;
  hasInvalidUtf8: boolean;
  lineSeparator: '\n' | '\r\n';
  cursor: CursorPosition;
}

export const useDocumentStore = create<DocumentState>(() => ({
  path: null,
  kind: FILE_KIND.text,
  viewMode: VIEW_MODE.plain,
  isLoaded: false,
  documentId: 0,
  initialText: '',
  pendingStartingText: null,
  draftId: crypto.randomUUID(),
  isEditorReady: false,
  isDirty: false,
  revision: 0,
  modifiedTime: null,
  hasInvalidUtf8: false,
  lineSeparator: '\n',
  cursor: { line: 1, column: 1, selectedCharacters: 0, selectionCount: 1 },
}));

export function setViewMode(viewMode: ViewMode): void {
  const { kind } = useDocumentStore.getState();
  useDocumentStore.setState({ viewMode: hasFormattedView(kind) ? viewMode : VIEW_MODE.plain });
}

export function toggleViewMode(): void {
  const { viewMode } = useDocumentStore.getState();
  setViewMode(viewMode === VIEW_MODE.formatted ? VIEW_MODE.plain : VIEW_MODE.formatted);
}

/** True when a tree or table replaces the editor on screen; Markdown's formatted view is the editor itself. */
export function useShowsSeparateFormattedView(): boolean {
  return useDocumentStore((state) => state.viewMode === VIEW_MODE.formatted && hasSeparateFormattedView(state.kind));
}

export function useIsLivePreview(): boolean {
  return useDocumentStore((state) => state.viewMode === VIEW_MODE.formatted && state.kind === FILE_KIND.markdown);
}
