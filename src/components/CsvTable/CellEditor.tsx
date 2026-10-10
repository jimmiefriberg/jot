import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { useExitOnce } from '../../lib/hooks/use-exit-once';

export type CellExit = 'down' | 'right' | 'stay';

interface CellEditorProps {
  initialValue: string;
  onCommit: (value: string, exit: CellExit) => void;
  onCancel: () => void;
}

function fitToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function placeCaretAtEnd(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  fitToContent(textarea);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

/** In-place editor for one cell. ↩ saves and moves down, ⇥ saves and moves right, ⌥↩ adds a line break, ⎋ cancels. */
export function CellEditor({ initialValue, onCommit, onCancel }: CellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const exitOnce = useExitOnce();

  function exit(value: string | null, direction: CellExit) {
    exitOnce(function leaveCell() {
      if (value === null) onCancel();
      else onCommit(value, direction);
    });
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
    fitToContent(event.target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      exit(null, 'stay');
      return;
    }
    if (event.key === 'Enter' && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      exit(draft, 'down');
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      exit(draft, 'right');
    }
  }

  function handleBlur() {
    exit(draft, 'stay');
  }

  return (
    <textarea
      ref={placeCaretAtEnd}
      className="csv-cell-editor"
      value={draft}
      rows={1}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}
