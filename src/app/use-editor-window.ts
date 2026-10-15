import { useEffect } from 'react';

import { getFileName } from '../lib/documents/file-kind';
import {
  applyDefaultViewMode,
  checkForExternalChanges,
  confirmClose,
  handlePathRenamed,
  loadInitialDocument,
  openFileInThisWindow,
} from '../lib/documents/document-actions';
import { useDocumentStore } from '../lib/documents/document-store';
import { startDraftAutosave } from '../lib/documents/draft-autosave';
import { getEditorView } from '../lib/editor/editor-session';
import { insertDroppedImages } from '../lib/editor/markdown-images';
import { handleMenuAction } from '../lib/commands/menu-actions';
import { handleFolderPathRenamed, openFolder } from '../lib/folders/folder-store';
import { refreshFolderListings } from '../lib/folders/query-client';
import { loadSettings } from '../lib/settings/settings-store';
import { useOptionKeyShortcuts } from '../lib/shortcuts/use-option-key-shortcuts';
import {
  handleCloseRequests,
  listenForFileDrops,
  listenForFolderOpened,
  listenForMenuActions,
  listenForOpenInPane,
  notifyPaneFocused,
  listenForPathRenamed,
  listenForWindowFocus,
  openDroppedPaths,
  setWindowTitle,
  showWindow,
} from '../lib/tauri/backend';
import type { DropPosition, PathRenamed } from '../lib/tauri/backend';

/** Loads settings and the document in parallel. Returns true once both are ready. */
export function useDocumentBootstrap(): boolean {
  const isLoaded = useDocumentStore((state) => state.isLoaded);

  useEffect(() => {
    async function bootstrap() {
      try {
        await Promise.all([loadSettings(), loadInitialDocument()]);
      } finally {
        // Even if loading failed, show the window (with an empty document) rather than nothing.
        useDocumentStore.setState({ isLoaded: true });
      }
      applyDefaultViewMode();
    }
    void bootstrap();
  }, []);

  return isLoaded;
}

/**
 * Windows open hidden; show this one once its content and theme are in the DOM, so there's no flash of an empty window.
 * (Not via requestAnimationFrame: WebKit doesn't run frames for hidden windows.)
 */
export function useShowWindowWhenReady(isReady: boolean): void {
  useEffect(() => {
    if (isReady) void showWindow();
  }, [isReady]);
}

function handleMenuActionEvent(actionId: string) {
  void handleMenuAction(actionId);
}

function handleWindowFocus() {
  void checkForExternalChanges();
  void refreshFolderListings();
}

/** Images dropped on a Markdown note are linked into it; anything else opens (files) or shows in the sidebar (folders). */
function handleFileDrop(paths: string[], position: DropPosition) {
  if (insertDroppedImages(getEditorView(), paths, position)) return;
  void openDroppedPaths(paths);
}

function handleOpenInPane(path: string) {
  void openFileInThisWindow(path);
}

// In a split window, the pane with the keyboard focus gets the menu actions and shows its title.
function handlePageFocus() {
  void notifyPaneFocused();
}

function listenForPageFocus(): () => void {
  window.addEventListener('focus', handlePageFocus);
  return () => window.removeEventListener('focus', handlePageFocus);
}

function handleRename(rename: PathRenamed) {
  handlePathRenamed(rename);
  handleFolderPathRenamed(rename);
  void refreshFolderListings();
}

/** Connects the window to the native side: menu actions (and ⌥ shortcuts), close prompts, focus checks, file drops, renames and the title. */
export function useWindowIntegration(): void {
  const path = useDocumentStore((state) => state.path);
  const isDirty = useDocumentStore((state) => state.isDirty);
  useOptionKeyShortcuts();

  useEffect(() => listenForMenuActions(handleMenuActionEvent), []);
  useEffect(() => handleCloseRequests(confirmClose), []);
  useEffect(() => listenForWindowFocus(handleWindowFocus), []);
  useEffect(() => listenForFileDrops(handleFileDrop), []);
  useEffect(() => listenForFolderOpened(openFolder), []);
  useEffect(() => listenForPathRenamed(handleRename), []);
  useEffect(() => listenForOpenInPane(handleOpenInPane), []);
  useEffect(() => listenForPageFocus(), []);
  useEffect(() => startDraftAutosave(), []);
  useEffect(() => {
    void setWindowTitle(`${getFileName(path)}${isDirty ? ' — Edited' : ''}`);
  }, [path, isDirty]);
}
