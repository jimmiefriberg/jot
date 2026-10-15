import { useRef } from 'react';

import { useSideBySidePreview } from './use-side-by-side-preview';

/** The formatted Markdown beside the plain editor (read-only; it follows the editor's text and scrolling). */
export function SideBySidePreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  useSideBySidePreview(containerRef);

  return <div ref={containerRef} className="side-by-side-preview" />;
}
