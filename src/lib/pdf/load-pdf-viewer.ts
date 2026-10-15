import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Loads pdf.js and its page viewer the first time a PDF opens, since they're large. */
export async function loadPdfViewer() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // The viewer module reads the core library from this global.
  Object.assign(globalThis, { pdfjsLib: pdfjs });
  const viewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
  return { pdfjs, viewer };
}
