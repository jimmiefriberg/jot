import { useMemo } from 'react';
import type { ChangeEvent } from 'react';

import { FILE_KIND, FILE_KINDS, FILE_KIND_LABEL, VIEW_MODE, hasFormattedView, isFileKind } from '../../lib/documents/file-kind';
import { setDocumentKind } from '../../lib/documents/document-actions';
import { setViewMode, useDocumentStore, useShowsSeparateFormattedView } from '../../lib/documents/document-store';
import { useCsvDocument } from '../../lib/csv/use-csv-document';
import { getDocumentLength, getViewText } from '../../lib/editor/editor-session';
import { toggleSidebar, useFolderStore } from '../../lib/folders/folder-store';
import { useSettingsStore } from '../../lib/settings/settings-store';
import { SIDEBAR_PANEL, hideSidebar, showSidebarPanel, useSidebarStore } from '../../lib/sidebar/sidebar-store';
import { resetZoom, useWindowViewStore, useZoomedFontSize } from '../../lib/window/window-view-store';
import { Icon } from '../Icon/Icon';

const WORD_COUNT_LIMIT = 2_000_000;

function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function showFormatted() {
  setViewMode(VIEW_MODE.formatted);
}

function showPlain() {
  setViewMode(VIEW_MODE.plain);
}

function showSideBySide() {
  setViewMode(VIEW_MODE.sideBySide);
}

function handleToggleSidebar() {
  void toggleSidebar();
}

function handleToggleOutline() {
  const { isVisible, panel } = useSidebarStore.getState();
  if (isVisible && panel === SIDEBAR_PANEL.outline) hideSidebar();
  else showSidebarPanel(SIDEBAR_PANEL.outline);
}

function handleKindChange(event: ChangeEvent<HTMLSelectElement>) {
  if (isFileKind(event.target.value)) setDocumentKind(event.target.value);
}

function WordCount() {
  const revision = useDocumentStore((state) => state.revision);
  const isEditorReady = useDocumentStore((state) => state.isEditorReady);
  // Recounted per change; skipped for very large documents to keep typing instant.
  const wordCount = useMemo(
    () => (getDocumentLength() > WORD_COUNT_LIMIT ? null : countWords(getViewText())),
    [revision, isEditorReady],
  );
  if (wordCount === null) return null;
  return <span>{pluralize(wordCount, 'word', 'words')}</span>;
}

function TableSize() {
  const csv = useCsvDocument();
  const isFirstRowHeader = useSettingsStore((state) => state.settings.csvFirstRowIsHeader);
  const rowCount = Math.max(csv.rows.length - (isFirstRowHeader ? 1 : 0), 0);
  return (
    <span>
      {pluralize(rowCount, 'row', 'rows')} × {pluralize(csv.columnCount, 'column', 'columns')}
    </span>
  );
}

function CursorPosition() {
  const cursor = useDocumentStore((state) => state.cursor);
  return (
    <span>
      Ln {cursor.line}, Col {cursor.column}
      {cursor.selectionCount > 1 && ` · ${cursor.selectionCount} cursors`}
      {cursor.selectedCharacters > 0 && ` · ${cursor.selectedCharacters.toLocaleString()} selected`}
    </span>
  );
}

/** Font size badge, shown only while this window is zoomed in or out. Click to reset. */
function ZoomBadge() {
  const zoomStep = useWindowViewStore((state) => state.zoomStep);
  const fontSize = useZoomedFontSize();
  if (zoomStep === 0) return null;
  return (
    <button className="status-button" onClick={resetZoom} title="Actual size (⌘0)">
      {fontSize} pt
    </button>
  );
}

export function StatusBar() {
  const kind = useDocumentStore((state) => state.kind);
  const viewMode = useDocumentStore((state) => state.viewMode);
  const lineSeparator = useDocumentStore((state) => state.lineSeparator);
  const hasInvalidUtf8 = useDocumentStore((state) => state.hasInvalidUtf8);
  const hasFolder = useFolderStore((state) => state.folderPath !== null);
  const isSidebarVisible = useSidebarStore((state) => state.isVisible);
  const sidebarPanel = useSidebarStore((state) => state.panel);
  const isPlain = viewMode === VIEW_MODE.plain;
  const isEditorVisible = !useShowsSeparateFormattedView();
  const isMarkdown = kind === FILE_KIND.markdown;
  const isOutlineVisible = isSidebarVisible && sidebarPanel === SIDEBAR_PANEL.outline && isMarkdown;
  const isFilesVisible = isSidebarVisible && hasFolder && !isOutlineVisible;

  return (
    <footer className="status-bar">
      <div className="status-group">
        {hasFolder && (
          <button
            className={`status-icon-button${isFilesVisible ? ' is-active' : ''}`}
            onClick={handleToggleSidebar}
            title="Toggle sidebar (⌘\)"
            aria-label="Toggle sidebar"
          >
            <Icon name="sidebar" size={14} />
          </button>
        )}
        <label className="status-kind" title="Show this document as another kind">
          {FILE_KIND_LABEL[kind]}
          <select value={kind} onChange={handleKindChange} aria-label="Document kind">
            {FILE_KINDS.map((fileKind) => (
              <option key={fileKind} value={fileKind}>
                {FILE_KIND_LABEL[fileKind]}
              </option>
            ))}
          </select>
          <Icon name="chevronDown" size={10} />
        </label>
        {isEditorVisible && <CursorPosition />}
        {(kind === FILE_KIND.text || isMarkdown) && <WordCount />}
        {kind === FILE_KIND.csv && <TableSize />}
      </div>
      <div className="status-group">
        {hasInvalidUtf8 && (
          <span className="status-warning" title="Some bytes weren't valid UTF-8 and show as �. Saving writes UTF-8.">
            Not UTF-8
          </span>
        )}
        <ZoomBadge />
        <span title="Line endings">{lineSeparator === '\r\n' ? 'CRLF' : 'LF'}</span>
        {isMarkdown && (
          <button
            className={`status-icon-button${isOutlineVisible ? ' is-active' : ''}`}
            onClick={handleToggleOutline}
            title="Outline (⌥⌘O)"
            aria-label="Toggle outline"
          >
            <Icon name="outline" size={14} />
          </button>
        )}
        {hasFormattedView(kind) && (
          <div className="segmented-control" role="group" aria-label="View">
            <button className={viewMode === VIEW_MODE.formatted ? 'is-active' : undefined} onClick={showFormatted} title="Formatted (⌘E)">
              Formatted
            </button>
            <button className={isPlain ? 'is-active' : undefined} onClick={showPlain} title="Plain (⌘E)">
              Plain
            </button>
            {isMarkdown && (
              <button
                className={viewMode === VIEW_MODE.sideBySide ? 'is-active' : undefined}
                onClick={showSideBySide}
                title="Side by Side (⌥⌘E)"
              >
                Side by Side
              </button>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
