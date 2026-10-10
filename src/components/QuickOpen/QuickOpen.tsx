import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { FOLDER_FILES_QUERY_KEY, RECENT_FILES_QUERY_KEY } from '../../lib/folders/query-client';
import { getDirectoryName, getFileName } from '../../lib/documents/file-kind';
import { openFileInThisWindow } from '../../lib/documents/document-actions';
import { focusEditor } from '../../lib/editor/editor-session';
import { useFolderStore } from '../../lib/folders/folder-store';
import { closeQuickOpen, useQuickOpenStore } from '../../lib/quick-open/quick-open-store';
import { rankPaths } from '../../lib/search/fuzzy-match';
import type { RankedPath } from '../../lib/search/fuzzy-match';
import { useSettingsStore } from '../../lib/settings/settings-store';
import { getRecentFiles, listFolderFiles, openPaths } from '../../lib/tauri/backend';
import { Icon } from '../Icon/Icon';

/** Recent files first, then the folder's files, each path once. */
function mergePaths(recentFiles: string[], folderFiles: string[]): string[] {
  return [...new Set([...recentFiles, ...folderFiles])];
}

function useCandidatePaths(folderPath: string | null) {
  const showHiddenFiles = useSettingsStore((state) => state.settings.showHiddenFiles);
  const folderFiles = useQuery({
    queryKey: [FOLDER_FILES_QUERY_KEY, folderPath, showHiddenFiles],
    queryFn: () => (folderPath ? listFolderFiles(folderPath, showHiddenFiles) : []),
  });
  const recentFiles = useQuery({ queryKey: [RECENT_FILES_QUERY_KEY], queryFn: getRecentFiles, staleTime: 0 });
  return mergePaths(recentFiles.data ?? [], folderFiles.data ?? []);
}

/** The label with the matched characters in bold. */
function HighlightedLabel({ result }: { result: RankedPath }) {
  const matched = new Set(result.matchedIndexes);
  const fileNameStart = result.label.length - getFileName(result.label).length;
  const fileName = Array.from(result.label.slice(fileNameStart), (character, offset) =>
    matched.has(fileNameStart + offset) ? <mark key={offset}>{character}</mark> : character,
  );
  const directory = fileNameStart > 0 ? getDirectoryName(result.label) : '';
  return (
    <>
      <span className="quick-open-name">{fileName}</span>
      {directory && <span className="quick-open-directory">{directory}</span>}
    </>
  );
}

interface QuickOpenListProps {
  folderPath: string | null;
}

function QuickOpenList({ folderPath }: QuickOpenListProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = rankPaths(query, useCandidatePaths(folderPath), folderPath);
  const activeResult = results[Math.min(activeIndex, results.length - 1)];

  function openResult(result: RankedPath | undefined, isNewWindow: boolean) {
    if (!result) return;
    closeQuickOpen();
    if (isNewWindow) void openPaths([result.path], folderPath);
    else void openFileInThisWindow(result.path);
  }

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      openResult(activeResult, event.metaKey || event.ctrlKey);
    }
  }

  function handleResultClick(event: MouseEvent<HTMLButtonElement>) {
    openResult(results[Number(event.currentTarget.dataset.index)], event.metaKey || event.ctrlKey);
  }

  function scrollIntoViewIfActive(element: HTMLButtonElement | null) {
    if (element?.classList.contains('is-active')) element.scrollIntoView({ block: 'nearest' });
  }

  return (
    <>
      <div className="quick-open-search">
        <Icon name="search" />
        <input
          autoFocus
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder={folderPath ? `Search files in ${getFileName(folderPath)}` : 'Search recent files'}
          spellCheck={false}
          aria-label="File name"
        />
      </div>
      <div className="quick-open-results" role="listbox">
        {results.length === 0 && (
          <p className="quick-open-empty">{query ? 'No matching files.' : 'Open a folder (⇧⌘O) to search its files.'}</p>
        )}
        {results.map((result, index) => (
          <button
            key={result.path}
            ref={scrollIntoViewIfActive}
            role="option"
            aria-selected={result === activeResult}
            className={result === activeResult ? 'quick-open-result is-active' : 'quick-open-result'}
            data-index={index}
            onClick={handleResultClick}
            title={result.path}
          >
            <HighlightedLabel result={result} />
          </button>
        ))}
      </div>
      <footer className="quick-open-hint">
        <span>
          <kbd>↩</kbd> open
        </span>
        <span>
          <kbd>⌘↩</kbd> new window
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </footer>
    </>
  );
}

function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
  if (event.target === event.currentTarget) closeQuickOpen();
}

function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  closeQuickOpen();
  focusEditor();
}

/** ⌘P: find a file by typing part of its name, in the open folder and among recent files. */
export function QuickOpen() {
  const isOpen = useQuickOpenStore((state) => state.isOpen);
  const folderPath = useFolderStore((state) => state.folderPath);
  if (!isOpen) return null;

  return (
    <div className="quick-open-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div className="quick-open" role="dialog" aria-label="Quick Open" onKeyDown={handleDialogKeyDown}>
        <QuickOpenList folderPath={folderPath} />
      </div>
    </div>
  );
}
