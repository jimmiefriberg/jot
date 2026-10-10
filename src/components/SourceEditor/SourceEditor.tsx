import { useRef } from 'react';

import { useCodeMirror } from './use-code-mirror';

interface SourceEditorProps {
  initialText: string;
  isVisible: boolean;
}

/** The plain-text editor. It stays mounted while hidden because its document backs every other view. */
export function SourceEditor({ initialText, isVisible }: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useCodeMirror(containerRef, initialText, isVisible);

  return <div ref={containerRef} className="source-editor" hidden={!isVisible} />;
}
