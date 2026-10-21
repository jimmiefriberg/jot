import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { useViewCommands } from '../../lib/commands/use-view-commands';
import { revealLineInSource, revealOffsetInSource } from '../../lib/documents/reveal-in-source';
import { getViewText } from '../../lib/editor/editor-session';
import type { TreeParseProblem } from '../../lib/tree/tree-model';
import { Icon } from '../Icon/Icon';
import { useScrollToActiveMatch } from './use-tree-search';

const COPIED_FEEDBACK_MS = 1200;

export interface TreeFilter {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  activeMatchPath: string | null;
  onGoToMatch: (step: 1 | -1) => void;
}

interface TreeShellProps {
  problems: TreeParseProblem[];
  isEmpty: boolean;
  filter: TreeFilter;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onTogglePath: (path: string) => void;
  /** Called when an editable part (marked with `data-edit-path` and `data-edit-field`) is double-clicked. */
  onEdit: (path: string, field: string) => void;
  /** Called when a row (marked with `data-node-path`) is clicked. */
  onSelectPath: (path: string) => void;
  /** The selected node's path written out for copying, like `settings.theme`; null hides the copy button. */
  selectedPathLabel: string | null;
  children: ReactNode;
}

interface WholeDocumentSelectionProps {
  onDeselect: () => void;
}

/**
 * While ⌘A has selected the whole document: a hidden field that keeps Copy enabled and copies the document's full text
 * (not just the rows on screen). Clicking elsewhere or ⎋ ends the selection.
 */
function WholeDocumentSelection({ onDeselect }: WholeDocumentSelectionProps) {
  function handleFocus(event: FocusEvent<HTMLTextAreaElement>) {
    event.currentTarget.select();
  }

  function handleCopy(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    event.clipboardData.setData('text/plain', getViewText());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onDeselect();
  }

  return (
    <textarea
      className="hidden-keyboard-field"
      data-view-keyboard
      value=" "
      readOnly
      autoFocus
      onFocus={handleFocus}
      onCopy={handleCopy}
      onBlur={onDeselect}
      onKeyDown={handleKeyDown}
      aria-label="Whole document selected"
    />
  );
}

function CopyPathButton({ pathLabel }: { pathLabel: string }) {
  const [hasCopied, setHasCopied] = useState(false);

  function handleResetCopied() {
    setHasCopied(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pathLabel);
      setHasCopied(true);
      setTimeout(handleResetCopied, COPIED_FEEDBACK_MS);
    } catch {
      // The clipboard can refuse access; the path is still visible to select by hand.
    }
  }

  return (
    <button className="tree-path" onClick={handleCopy} title="Copy path">
      <code>{pathLabel || '(root)'}</code>
      <Icon name={hasCopied ? 'check' : 'copy'} size={13} />
    </button>
  );
}

/**
 * Toolbar and click handling shared by the JSON, YAML and XML trees.
 * Rows mark toggles with `data-toggle-path`, editable parts with `data-edit-path`/`data-edit-field`,
 * themselves with `data-node-path`, and their source position with `data-offset`.
 * Double-click edits in place, or jumps to the source otherwise.
 */
export function TreeShell({
  problems,
  isEmpty,
  filter,
  onExpandAll,
  onCollapseAll,
  onTogglePath,
  onEdit,
  onSelectPath,
  selectedPathLabel,
  children,
}: TreeShellProps) {
  const filterInputRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [isWholeDocumentSelected, setIsWholeDocumentSelected] = useState(false);
  const firstProblem = problems[0];
  useScrollToActiveMatch(treeRef, filter.activeMatchPath);

  function focusFilter() {
    filterInputRef.current?.focus();
    filterInputRef.current?.select();
  }

  function goToNextMatch() {
    filter.onGoToMatch(1);
  }

  function goToPreviousMatch() {
    filter.onGoToMatch(-1);
  }

  function selectWholeDocument() {
    setIsWholeDocumentSelected(true);
  }

  function deselectWholeDocument() {
    setIsWholeDocumentSelected(false);
  }

  useViewCommands({
    'edit.selectAll': selectWholeDocument,
    'view.expandAll': onExpandAll,
    'view.collapseAll': onCollapseAll,
    'edit.find': focusFilter,
    'edit.findNext': goToNextMatch,
    'edit.findPrevious': goToPreviousMatch,
  });

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const togglePath = target.closest<HTMLElement>('[data-toggle-path]')?.dataset.togglePath;
    if (togglePath) {
      onTogglePath(togglePath);
      return;
    }
    const nodePath = target.closest<HTMLElement>('[data-node-path]')?.dataset.nodePath;
    if (nodePath) onSelectPath(nodePath);
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[data-toggle-path], button, input')) return;
    const editable = target.closest<HTMLElement>('[data-edit-path]');
    const { editPath, editField } = editable?.dataset ?? {};
    if (editPath !== undefined && editField !== undefined) {
      onEdit(editPath, editField);
      return;
    }
    const row = target.closest<HTMLElement>('[data-offset]');
    if (row) revealOffsetInSource(Number(row.dataset.offset));
  }

  function handleShowProblem() {
    if (firstProblem) revealLineInSource(firstProblem.line - 1);
  }

  function handleFilterChange(event: ChangeEvent<HTMLInputElement>) {
    filter.onQueryChange(event.target.value);
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      filter.onGoToMatch(event.shiftKey ? -1 : 1);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      filter.onQueryChange('');
      event.currentTarget.blur();
    }
  }

  return (
    <div className="formatted-view tree-view">
      <div className="view-toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={14} />
          <input
            ref={filterInputRef}
            value={filter.query}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            placeholder="Filter keys and values"
            spellCheck={false}
            aria-label="Filter keys and values"
          />
          {filter.query && (
            <span className="toolbar-search-count">{filter.matchCount === 0 ? 'No matches' : `${filter.matchCount} found`}</span>
          )}
          {filter.matchCount > 1 && (
            <>
              <button className="icon-button" onClick={goToPreviousMatch} title="Previous match (⇧↩)" aria-label="Previous match">
                <Icon name="chevronUp" size={14} />
              </button>
              <button className="icon-button" onClick={goToNextMatch} title="Next match (↩)" aria-label="Next match">
                <Icon name="chevronDown" size={14} />
              </button>
            </>
          )}
        </div>
        <div className="toolbar-group">
          <button onClick={onExpandAll}>Expand all</button>
          <button onClick={onCollapseAll}>Collapse all</button>
        </div>
        {selectedPathLabel !== null && <CopyPathButton pathLabel={selectedPathLabel} />}
      </div>
      {firstProblem && (
        <div className="tree-problem" role="status">
          <span>
            {problems.length === 1 ? '1 problem' : `${problems.length} problems`}: {firstProblem.message} at line {firstProblem.line}, column{' '}
            {firstProblem.column}
          </span>
          <button onClick={handleShowProblem}>Show in source</button>
        </div>
      )}
      {isWholeDocumentSelected && <WholeDocumentSelection onDeselect={deselectWholeDocument} />}
      <div
        ref={treeRef}
        className={`tree${isWholeDocumentSelected ? ' is-whole-document-selected' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isEmpty ? <p className="empty-state">This document is empty.</p> : children}
      </div>
    </div>
  );
}
