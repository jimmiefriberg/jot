import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import 'pdfjs-dist/web/pdf_viewer.css';

import { useViewCommands } from '../../lib/commands/use-view-commands';
import { useDocumentStore } from '../../lib/documents/document-store';
import { localFileUrl, openInDefaultApp, showErrorMessage } from '../../lib/tauri/backend';
import { usePdfViewer } from './use-pdf-viewer';
import type { PdfMatchCount } from './use-pdf-viewer';
import { Icon } from '../Icon/Icon';

async function handleOpenInDefaultApp() {
  const { path } = useDocumentStore.getState();
  if (!path) return;
  const result = await openInDefaultApp(path);
  if (!result.isOk) await showErrorMessage("Couldn't open the file", result.error);
}

function describeMatches(matchCount: PdfMatchCount | null): string {
  if (!matchCount) return '';
  if (matchCount.total === 0) return 'No matches';
  return `${matchCount.current} of ${matchCount.total}`;
}

interface PdfPagesProps {
  url: string;
}

/** A read-only PDF with search (⌘F) and zoom in the toolbar and on ⌘+ / ⌘− / ⌘0 (and trackpad pinch). */
function PdfPages({ url }: PdfPagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const { zoomPercent, errorMessage, matchCount, findText, zoomIn, zoomOut, resetZoom } = usePdfViewer(containerRef, url);

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }

  function findNext() {
    findText(query, false, true);
  }

  function findPrevious() {
    findText(query, true, true);
  }

  useViewCommands({
    'view.zoomIn': zoomIn,
    'view.zoomOut': zoomOut,
    'view.zoomReset': resetZoom,
    'edit.find': focusSearch,
    'edit.findNext': findNext,
    'edit.findPrevious': findPrevious,
  });

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    findText(event.target.value, false, false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      findText(query, event.shiftKey, true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery('');
      findText('', false, false);
      event.currentTarget.blur();
    }
  }

  return (
    <>
      <div className="view-toolbar">
        <div className="toolbar-group">
          <button onClick={zoomOut} title="Zoom out (⌘−)" aria-label="Zoom out">
            −
          </button>
          <button className="pdf-zoom-level" onClick={resetZoom} title="Fit to window (⌘0)">
            {zoomPercent === null ? '…' : `${zoomPercent}%`}
          </button>
          <button onClick={zoomIn} title="Zoom in (⌘+)" aria-label="Zoom in">
            +
          </button>
        </div>
        <div className="toolbar-search">
          <Icon name="search" size={14} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search (⌘F)"
            spellCheck={false}
            aria-label="Search the PDF"
          />
          {query && <span className="toolbar-search-count">{describeMatches(matchCount)}</span>}
        </div>
        <span className="file-preview-note" />
        <div className="toolbar-group">
          <button onClick={handleOpenInDefaultApp}>Open in Default App</button>
        </div>
      </div>
      {errorMessage && <p className="empty-state">Couldn't show this PDF: {errorMessage}</p>}
      <div className="pdf-pages-area">
        {/* pdf.js needs an absolutely positioned scroll container with a `.pdfViewer` element inside. */}
        <div ref={containerRef} className="pdf-pages">
          <div className="pdfViewer" />
        </div>
      </div>
    </>
  );
}

export function PdfViewer() {
  const path = useDocumentStore((state) => state.path);
  const modifiedTime = useDocumentStore((state) => state.modifiedTime);
  if (!path) return null;
  // Keyed by the modified time, so a PDF changed on disk is shown afresh.
  return (
    <div className="formatted-view file-preview">
      <PdfPages key={modifiedTime} url={localFileUrl(path)} />
    </div>
  );
}
