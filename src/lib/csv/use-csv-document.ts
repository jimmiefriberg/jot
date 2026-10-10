import { useMemo } from 'react';

import { useDocumentStore } from '../documents/document-store';
import { useDocumentText } from '../documents/use-document-text';
import { parseCsv } from './csv-model';
import type { CsvDocument } from './csv-model';

// One parse per document revision, shared by the table and the status bar.
let cachedParse: { revision: number; csv: CsvDocument } | null = null;

/** The document parsed as CSV, re-parsed only when the text changes. */
export function useCsvDocument(): CsvDocument {
  const text = useDocumentText();
  const revision = useDocumentStore((state) => state.revision);
  return useMemo(() => {
    if (cachedParse?.revision === revision) return cachedParse.csv;
    const csv = parseCsv(text);
    cachedParse = { revision, csv };
    return csv;
  }, [revision, text]);
}
