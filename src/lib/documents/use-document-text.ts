import { useMemo } from 'react';

import { getViewText } from '../editor/editor-session';
import { useDocumentStore } from './document-store';

/** The current document text (LF line breaks, offsets matching the editor), re-read only when the document changes. */
export function useDocumentText(): string {
  const revision = useDocumentStore((state) => state.revision);
  // The revision is the cache key: the text lives in the editor, not in React state.
  return useMemo(() => getViewText(), [revision]);
}
