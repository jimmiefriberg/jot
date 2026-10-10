import { useMemo } from 'react';

import { useDocumentStore } from '../../lib/documents/document-store';
import { useDocumentText } from '../../lib/documents/use-document-text';
import { revealLine } from '../../lib/editor/editor-session';
import { extractOutline, findCurrentHeading } from '../../lib/markdown/outline';
import type { OutlineHeading } from '../../lib/markdown/outline';

const INDENT_PER_LEVEL = 12;

interface OutlineItemProps {
  heading: OutlineHeading;
  /** The level of the document's biggest heading, so the outline starts at the left edge. */
  topLevel: number;
  isCurrent: boolean;
}

function OutlineItem({ heading, topLevel, isCurrent }: OutlineItemProps) {
  function handleClick() {
    revealLine(heading.lineIndex);
  }

  return (
    <button
      className={`outline-item level-${heading.level}${isCurrent ? ' is-current' : ''}`}
      style={{ paddingLeft: 12 + (heading.level - topLevel) * INDENT_PER_LEVEL }}
      onClick={handleClick}
      title={heading.text}
    >
      {heading.text}
    </button>
  );
}

/** The headings of the Markdown document. Click one to jump to it; the one you're in is highlighted. */
export function OutlinePanel() {
  const text = useDocumentText();
  const cursorLine = useDocumentStore((state) => state.cursor.line);
  const headings = useMemo(() => extractOutline(text), [text]);
  const currentHeading = findCurrentHeading(headings, cursorLine - 1);
  const topLevel = Math.min(...headings.map((heading) => heading.level));

  if (headings.length === 0) return <p className="sidebar-message">Headings you add (like “# Title”) show up here.</p>;

  return (
    <nav className="outline" aria-label="Outline">
      {headings.map((heading) => (
        <OutlineItem key={`${heading.lineIndex}-${heading.slug}`} heading={heading} topLevel={topLevel} isCurrent={heading === currentHeading} />
      ))}
    </nav>
  );
}
