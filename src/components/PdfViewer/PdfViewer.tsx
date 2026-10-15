import { useRef } from 'react';

import 'pdfjs-dist/web/pdf_viewer.css';

import { useViewCommands } from '../../lib/commands/use-view-commands';
import { useDocumentStore } from '../../lib/documents/document-store';
import { localFileUrl, openInDefaultApp, showErrorMessage } from '../../lib/tauri/backend';
import { usePdfViewer } from './use-pdf-viewer';

async function handleOpenInDefaultApp() {
  const { path } = useDocumentStore.getState();
  if (!path) return;
  const result = await openInDefaultApp(path);
  if (!result.isOk) await showErrorMessage("Couldn't open the file", result.error);
}

interface PdfPagesProps {
  url: string;
}

/** A read-only PDF with zoom in the toolbar and on ⌘+ / ⌘− / ⌘0 (and trackpad pinch). */
function PdfPages({ url }: PdfPagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoomPercent, errorMessage, zoomIn, zoomOut, resetZoom } = usePdfViewer(containerRef, url);
  useViewCommands({ 'view.zoomIn': zoomIn, 'view.zoomOut': zoomOut, 'view.zoomReset': resetZoom });

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
