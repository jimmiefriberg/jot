import { create } from 'zustand';

import { FILE_KIND } from '../documents/file-kind';
import { useDocumentStore } from '../documents/document-store';
import { SIDEBAR_PANEL, hideSidebar, showSidebarPanel, useSidebarStore } from '../sidebar/sidebar-store';
import { pickFolder, setWindowFolder } from '../tauri/backend';
import type { PathRenamed } from '../tauri/backend';

/** A new file or folder being named in the tree, before it exists on disk. */
export interface PendingEntry {
  directoryPath: string;
  isDirectory: boolean;
}

interface FolderState {
  folderPath: string | null;
  expandedDirectories: Set<string>;
  pendingEntry: PendingEntry | null;
  /** The file or folder whose name is being edited in the tree. */
  renamingPath: string | null;
}

export const useFolderStore = create<FolderState>(() => ({
  folderPath: null,
  expandedDirectories: new Set(),
  pendingEntry: null,
  renamingPath: null,
}));

/** Shows a folder in this window's sidebar. */
export function openFolder(folderPath: string): void {
  useFolderStore.setState({ folderPath, expandedDirectories: new Set(), pendingEntry: null, renamingPath: null });
  showSidebarPanel(SIDEBAR_PANEL.files);
  void setWindowFolder(folderPath);
}

export function closeFolder(): void {
  useFolderStore.setState({ folderPath: null, expandedDirectories: new Set(), pendingEntry: null, renamingPath: null });
  if (useDocumentStore.getState().kind !== FILE_KIND.markdown) hideSidebar();
  void setWindowFolder(null);
}

/** Shows or hides the sidebar. With nothing to show (no folder, not Markdown), asks for a folder. */
export async function toggleSidebar(): Promise<void> {
  const { isVisible } = useSidebarStore.getState();
  if (isVisible) {
    hideSidebar();
    return;
  }
  const hasFolder = useFolderStore.getState().folderPath !== null;
  const isMarkdown = useDocumentStore.getState().kind === FILE_KIND.markdown;
  if (hasFolder || isMarkdown) {
    useSidebarStore.setState({ isVisible: true });
    return;
  }
  const pickedFolder = await pickFolder();
  if (pickedFolder) openFolder(pickedFolder);
}

export function toggleDirectory(directoryPath: string): void {
  useFolderStore.setState((state) => {
    const expandedDirectories = new Set(state.expandedDirectories);
    if (expandedDirectories.has(directoryPath)) expandedDirectories.delete(directoryPath);
    else expandedDirectories.add(directoryPath);
    return { expandedDirectories };
  });
}

export function setDirectoryExpanded(directoryPath: string, isExpanded: boolean): void {
  const { expandedDirectories } = useFolderStore.getState();
  if (expandedDirectories.has(directoryPath) !== isExpanded) toggleDirectory(directoryPath);
}

/** Expands the folders between the sidebar's root and a file, so the file is visible. */
export function revealInSidebar(filePath: string | null): void {
  const { folderPath, expandedDirectories } = useFolderStore.getState();
  if (!folderPath || !filePath?.startsWith(`${folderPath}/`)) return;

  const nextExpanded = new Set(expandedDirectories);
  const relativeSegments = filePath.slice(folderPath.length + 1).split('/').slice(0, -1);
  let currentPath = folderPath;
  for (const segment of relativeSegments) {
    currentPath = `${currentPath}/${segment}`;
    nextExpanded.add(currentPath);
  }
  useFolderStore.setState({ expandedDirectories: nextExpanded });
}

/** Starts naming a new file or folder inside `directoryPath` (expanding it so the name field shows). */
export function startCreatingEntry(directoryPath: string, isDirectory: boolean): void {
  const { folderPath } = useFolderStore.getState();
  if (directoryPath !== folderPath) setDirectoryExpanded(directoryPath, true);
  useFolderStore.setState({ pendingEntry: { directoryPath, isDirectory }, renamingPath: null });
}

export function stopCreatingEntry(): void {
  useFolderStore.setState({ pendingEntry: null });
}

export function startRenaming(path: string): void {
  useFolderStore.setState({ renamingPath: path, pendingEntry: null });
}

export function stopRenaming(): void {
  useFolderStore.setState({ renamingPath: null });
}

/** `path` after a rename of `from` to `to`: the renamed entry itself, or something inside a renamed folder. */
export function renamedPath(path: string, { from, to }: PathRenamed): string {
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
}

/** Follows a rename: the open folder and expanded folders keep pointing at the same places. */
export function handleFolderPathRenamed(rename: PathRenamed): void {
  useFolderStore.setState((state) => ({
    folderPath: state.folderPath && renamedPath(state.folderPath, rename),
    expandedDirectories: new Set([...state.expandedDirectories].map((path) => renamedPath(path, rename))),
  }));
}
