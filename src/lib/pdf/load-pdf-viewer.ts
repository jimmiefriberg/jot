import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

async function* readStream<Chunk>(this: ReadableStream<Chunk>) {
  const reader = this.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** pdf.js reads page text with `for await` over a stream, which WebKit doesn't support yet (search needs it). */
function addStreamIteration() {
  if (Symbol.asyncIterator in ReadableStream.prototype) return;
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: readStream, configurable: true, writable: true });
}

/** Loads pdf.js and its page viewer the first time a PDF opens, since they're large. */
export async function loadPdfViewer() {
  addStreamIteration();
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // The viewer module reads the core library from this global.
  Object.assign(globalThis, { pdfjsLib: pdfjs });
  const viewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
  return { pdfjs, viewer };
}
