import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';

import { loadPdfViewer } from '../../lib/pdf/load-pdf-viewer';
import { openExternalLink } from '../../lib/tauri/backend';

// Fits the page width, or the whole page when it's a wide slide.
const DEFAULT_SCALE = 'auto';
// How strongly a trackpad pinch (a ⌃-wheel event) zooms.
const PINCH_SENSITIVITY = 100;

/** Which match is selected (1-based) out of how many; 0 of 0 when nothing matches. */
export interface PdfMatchCount {
  current: number;
  total: number;
}

export interface PdfViewerControls {
  zoomPercent: number | null;
  errorMessage: string | null;
  matchCount: PdfMatchCount | null;
  /** Searches for `query` (highlighting every match); `isAgain` steps to the next or previous match of the same text. */
  findText: (query: string, isBackward: boolean, isAgain: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

/** Shows the PDF at `url` in the container: pages render as they scroll into view, with selectable text. */
export function usePdfViewer(containerRef: RefObject<HTMLDivElement | null>, url: string): PdfViewerControls {
  const viewerRef = useRef<PDFViewer | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const [matchCount, setMatchCount] = useState<PdfMatchCount | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isCancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      viewerRef.current?.updateScale({ scaleFactor: Math.exp(-event.deltaY / PINCH_SENSITIVITY), origin: [event.clientX, event.clientY] });
    }

    // Web links open in the browser instead of replacing the app; links within the PDF are handled by pdf.js.
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const href = event.target.closest('a[href]')?.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      event.preventDefault();
      void openExternalLink(href);
    }

    async function showDocument(element: HTMLDivElement) {
      const { pdfjs, viewer } = await loadPdfViewer();
      if (isCancelled) return;
      const eventBus = new viewer.EventBus();
      const linkService = new viewer.PDFLinkService({ eventBus });
      const findController = new viewer.PDFFindController({ eventBus, linkService });
      const pdfViewer = new viewer.PDFViewer({ container: element, eventBus, linkService, findController });
      linkService.setViewer(pdfViewer);
      viewerRef.current = pdfViewer;
      eventBusRef.current = eventBus;
      function showMatchCount({ matchesCount }: { matchesCount: PdfMatchCount }) {
        setMatchCount(matchesCount);
      }
      eventBus.on('updatefindmatchescount', showMatchCount);
      eventBus.on('updatefindcontrolstate', showMatchCount);
      eventBus.on('pagesinit', function fitPages() {
        pdfViewer.currentScaleValue = DEFAULT_SCALE;
      });
      eventBus.on('scalechanging', function showScale({ scale }: { scale: number }) {
        setZoomPercent(Math.round(scale * 100));
      });
      loadingTask = pdfjs.getDocument({ url });
      const pdfDocument = await loadingTask.promise;
      if (isCancelled) return;
      pdfViewer.setDocument(pdfDocument);
      linkService.setDocument(pdfDocument);
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('click', handleClick);
    showDocument(container).catch(function showError(error: unknown) {
      if (!isCancelled) setErrorMessage(error instanceof Error ? error.message : String(error));
    });
    return function cleanUpViewer() {
      isCancelled = true;
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('click', handleClick);
      viewerRef.current = null;
      eventBusRef.current = null;
      void loadingTask?.destroy();
    };
  }, [containerRef, url]);

  function zoomIn() {
    viewerRef.current?.increaseScale();
  }

  function zoomOut() {
    viewerRef.current?.decreaseScale();
  }

  function resetZoom() {
    if (viewerRef.current) viewerRef.current.currentScaleValue = DEFAULT_SCALE;
  }

  function findText(query: string, isBackward: boolean, isAgain: boolean) {
    const eventBus = eventBusRef.current;
    if (!eventBus) return;
    if (query === '') {
      eventBus.dispatch('findbarclose', { source: null });
      setMatchCount(null);
      return;
    }
    eventBus.dispatch('find', {
      source: null,
      type: isAgain ? 'again' : '',
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: isBackward,
      matchDiacritics: false,
    });
  }

  return { zoomPercent, errorMessage, matchCount, findText, zoomIn, zoomOut, resetZoom };
}
