import { getDirectoryName, getFileName } from '../documents/file-kind';
import { openFileInThisWindow } from '../documents/document-actions';
import { OPEN_PLACEMENT, createFile, createFolder, openPaths, renamePath, revealInFinder, showContextMenu, showErrorMessage } from '../tauri/backend';
import type { ContextMenuEntry, DirectoryEntry } from '../tauri/backend';
import { startCreatingEntry, startRenaming, stopCreatingEntry, stopRenaming, useFolderStore } from './folder-store';
import { refreshFolderListings } from './query-client';

/** A file or folder name: something to type, and no slashes (those would mean another folder). */
function validateName(name: string): string | null {
  if (name.length === 0) return null;
  if (name.includes('/')) return 'Names can’t contain “/”.';
  if (name === '.' || name === '..') return 'That name is reserved.';
  return null;
}

/** Creates the file or folder being named in the tree. A new file opens right away. */
export async function createPendingEntry(rawName: string): Promise<void> {
  const { pendingEntry } = useFolderStore.getState();
  stopCreatingEntry();
  const name = rawName.trim();
  if (!pendingEntry || name.length === 0) return;

  const problem = validateName(name);
  if (problem) {
    await showErrorMessage(`Couldn't create “${name}”`, problem);
    return;
  }
  const path = `${pendingEntry.directoryPath}/${name}`;
  const result = pendingEntry.isDirectory ? await createFolder(path) : await createFile(path);
  if (!result.isOk) {
    await showErrorMessage(`Couldn't create “${name}”`, result.error);
    return;
  }
  await refreshFolderListings();
  if (!pendingEntry.isDirectory) await openFileInThisWindow(path);
}

/** Renames a file or folder from the tree. Open windows follow the rename (see `handlePathRenamed`). */
export async function renameEntry(path: string, rawName: string): Promise<void> {
  stopRenaming();
  const name = rawName.trim();
  if (name.length === 0 || name === getFileName(path)) return;

  const problem = validateName(name);
  if (problem) {
    await showErrorMessage(`Couldn't rename “${getFileName(path)}”`, problem);
    return;
  }
  const result = await renamePath(path, `${getDirectoryName(path)}/${name}`);
  if (!result.isOk) {
    await showErrorMessage(`Couldn't rename “${getFileName(path)}”`, result.error);
    return;
  }
  await refreshFolderListings();
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
  } catch {
    // The clipboard can refuse access; there is nothing useful to do about it here.
  }
}

/** Right-click menu for a tree entry, or for the empty part of the tree (the folder itself) when `entry` is null. */
export function showEntryContextMenu(entry: DirectoryEntry | null): void {
  const { folderPath } = useFolderStore.getState();
  if (!folderPath) return;
  const targetPath = entry?.path ?? folderPath;
  const directoryForNewEntries = entry === null || entry.isDirectory ? targetPath : getDirectoryName(targetPath);

  function openInNewTab() {
    void openPaths([targetPath], folderPath, OPEN_PLACEMENT.tab);
  }

  function openInNewWindow() {
    void openPaths([targetPath], folderPath, OPEN_PLACEMENT.window);
  }

  function openToTheSide() {
    void openPaths([targetPath], folderPath, OPEN_PLACEMENT.split);
  }

  function createNewFile() {
    startCreatingEntry(directoryForNewEntries, false);
  }

  function createNewFolder() {
    startCreatingEntry(directoryForNewEntries, true);
  }

  function rename() {
    startRenaming(targetPath);
  }

  function reveal() {
    void revealInFinder(targetPath);
  }

  function copy() {
    void copyPath(targetPath);
  }

  const entries: ContextMenuEntry[] = [];
  if (entry && !entry.isDirectory) {
    entries.push(
      { label: 'Open to the Side', onSelect: openToTheSide },
      { label: 'Open in New Tab', onSelect: openInNewTab },
      { label: 'Open in New Window', onSelect: openInNewWindow },
      'separator',
    );
  }
  entries.push({ label: 'New File…', onSelect: createNewFile }, { label: 'New Folder…', onSelect: createNewFolder });
  if (entry) entries.push({ label: 'Rename…', onSelect: rename });
  entries.push('separator', { label: 'Reveal in Finder', onSelect: reveal }, { label: 'Copy Path', onSelect: copy });
  void showContextMenu(entries);
}
