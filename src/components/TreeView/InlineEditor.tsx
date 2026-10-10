import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { useExitOnce } from '../../lib/hooks/use-exit-once';

interface InlineEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function focusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

/** One-line editor for a tree value, key or attribute. ↩ or clicking away saves, ⎋ cancels. */
export function InlineEditor({ initialValue, onCommit, onCancel }: InlineEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const exitOnce = useExitOnce();

  function commitDraft() {
    onCommit(draft);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      exitOnce(commitDraft);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      exitOnce(onCancel);
    }
  }

  function handleBlur() {
    exitOnce(commitDraft);
  }

  return (
    <input
      ref={focusAndSelect}
      className="tree-inline-editor"
      value={draft}
      size={Math.max(draft.length + 1, 4)}
      spellCheck={false}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}
