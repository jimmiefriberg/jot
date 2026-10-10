import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

import { FILE_KIND, detectFileKind } from '../../lib/documents/file-kind';
import type { FileKind } from '../../lib/documents/file-kind';
import { openFileInThisWindow } from '../../lib/documents/document-actions';
import { useDocumentStore } from '../../lib/documents/document-store';
import { createPendingEntry, renameEntry, showEntryContextMenu } from '../../lib/folders/folder-actions';
import { setDirectoryExpanded, stopCreatingEntry, stopRenaming, toggleDirectory, useFolderStore } from '../../lib/folders/folder-store';
import { openPaths } from '../../lib/tauri/backend';
import type { DirectoryEntry } from '../../lib/tauri/backend';
import { Icon } from '../Icon/Icon';
import type { IconName } from '../Icon/Icon';
import { NameInput } from './NameInput';
import { useDirectoryEntries } from './use-directory-entries';

const INDENT_PER_LEVEL = 14;
const ROW_SELECTOR = '.folder-tree-row';

const ICON_BY_KIND: Record<FileKind, IconName> = {
  [FILE_KIND.text]: 'file',
  [FILE_KIND.markdown]: 'fileText',
  [FILE_KIND.json]: 'braces',
  [FILE_KIND.csv]: 'table',
  [FILE_KIND.yaml]: 'code',
  [FILE_KIND.xml]: 'code',
};

function indentStyle(depth: number): CSSProperties {
  return { paddingLeft: 8 + depth * INDENT_PER_LEVEL };
}

interface PendingEntryRowProps {
  isDirectory: boolean;
  depth: number;
}

function PendingEntryRow({ isDirectory, depth }: PendingEntryRowProps) {
  function handleCommit(name: string) {
    void createPendingEntry(name);
  }

  return (
    <div className="folder-tree-row is-editing" style={indentStyle(depth)}>
      <span className="folder-tree-chevron" />
      <Icon name={isDirectory ? 'folder' : 'file'} className="folder-tree-icon" />
      <NameInput initialValue="" placeholder={isDirectory ? 'Folder name' : 'File name'} onCommit={handleCommit} onCancel={stopCreatingEntry} />
    </div>
  );
}

interface DirectoryChildrenProps {
  directoryPath: string;
  depth: number;
}

function DirectoryChildren({ directoryPath, depth }: DirectoryChildrenProps) {
  const { data: entries, error, isPending } = useDirectoryEntries(directoryPath);
  const pendingEntry = useFolderStore((state) => (state.pendingEntry?.directoryPath === directoryPath ? state.pendingEntry : null));
  if (isPending) return null;
  if (error) return <p className="sidebar-message">Couldn't read this folder.</p>;

  return (
    <div role="group">
      {pendingEntry && <PendingEntryRow isDirectory={pendingEntry.isDirectory} depth={depth} />}
      {entries.length === 0 && depth === 0 && !pendingEntry && <p className="sidebar-message">This folder is empty.</p>}
      {entries.map((entry) => (
        <FolderTreeItem key={entry.path} entry={entry} depth={depth} parentPath={directoryPath} />
      ))}
    </div>
  );
}

interface FolderTreeItemProps {
  entry: DirectoryEntry;
  depth: number;
  parentPath: string;
}

function FolderTreeItem({ entry, depth, parentPath }: FolderTreeItemProps) {
  const isExpanded = useFolderStore((state) => state.expandedDirectories.has(entry.path));
  const isRenaming = useFolderStore((state) => state.renamingPath === entry.path);
  const isCurrentFile = useDocumentStore((state) => state.path === entry.path);

  // Click opens a file here; ⌘-click opens it in a new window that shows the same folder.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (entry.isDirectory) {
      toggleDirectory(entry.path);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      void openPaths([entry.path], useFolderStore.getState().folderPath);
      return;
    }
    void openFileInThisWindow(entry.path);
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    showEntryContextMenu(entry);
  }

  function handleRename(name: string) {
    void renameEntry(entry.path, name);
  }

  const iconName: IconName = entry.isDirectory ? 'folder' : ICON_BY_KIND[detectFileKind(entry.name)];
  const isHidden = entry.name.startsWith('.');
  const className = ['folder-tree-row', isCurrentFile && 'is-current', entry.isDirectory && 'is-directory', isHidden && 'is-hidden']
    .filter(Boolean)
    .join(' ');
  const chevron = entry.isDirectory ? <Icon name="chevronRight" size={12} className={isExpanded ? 'is-expanded' : undefined} /> : null;

  return (
    <div role="treeitem" aria-expanded={entry.isDirectory ? isExpanded : undefined} aria-selected={isCurrentFile}>
      {isRenaming ? (
        <div className={`${className} is-editing`} style={indentStyle(depth)}>
          <span className="folder-tree-chevron">{chevron}</span>
          <Icon name={iconName} className="folder-tree-icon" />
          <NameInput initialValue={entry.name} onCommit={handleRename} onCancel={stopRenaming} />
        </div>
      ) : (
        <button
          className={className}
          style={indentStyle(depth)}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          title={entry.path}
          data-path={entry.path}
          data-parent-path={parentPath}
          data-is-directory={entry.isDirectory || undefined}
          data-is-expanded={isExpanded || undefined}
        >
          <span className="folder-tree-chevron">{chevron}</span>
          <Icon name={iconName} className="folder-tree-icon" />
          <span className="folder-tree-name">{entry.name}</span>
        </button>
      )}
      {entry.isDirectory && isExpanded && <DirectoryChildren directoryPath={entry.path} depth={depth + 1} />}
    </div>
  );
}

function focusRow(row: Element | undefined) {
  if (row instanceof HTMLElement) row.focus();
}

/** Arrow keys move through the tree like Finder's list view: ↑/↓ between rows, →/← to open, close or go to the parent. */
function handleTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const row = event.target;
  if (!(row instanceof HTMLElement) || !row.matches(ROW_SELECTOR)) return;
  const rows = Array.from(event.currentTarget.querySelectorAll(ROW_SELECTOR));
  const index = rows.indexOf(row);
  const { path, parentPath, isDirectory, isExpanded } = row.dataset;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusRow(rows[index + (event.key === 'ArrowDown' ? 1 : -1)]);
    return;
  }
  if (event.key === 'ArrowRight' && isDirectory && path) {
    event.preventDefault();
    if (isExpanded) focusRow(rows[index + 1]);
    else setDirectoryExpanded(path, true);
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (isDirectory && isExpanded && path) {
      setDirectoryExpanded(path, false);
      return;
    }
    focusRow(rows.find((candidate) => candidate instanceof HTMLElement && candidate.dataset.path === parentPath));
  }
}

function handleBackgroundContextMenu(event: MouseEvent<HTMLDivElement>) {
  event.preventDefault();
  showEntryContextMenu(null);
}

/** File tree of the open folder. Folders load when expanded. */
export function FolderTree({ folderPath }: { folderPath: string }) {
  return (
    <div className="folder-tree" role="tree" onKeyDown={handleTreeKeyDown} onContextMenu={handleBackgroundContextMenu}>
      <DirectoryChildren directoryPath={folderPath} depth={0} />
    </div>
  );
}
