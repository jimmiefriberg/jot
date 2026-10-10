import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { useExitOnce } from '../../lib/hooks/use-exit-once';

interface NameInputProps {
  initialValue: string;
  placeholder?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/** Focuses the field and selects the name without its extension, like Finder does when renaming. */
function focusAndSelectBaseName(input: HTMLInputElement | null) {
  if (!input || document.activeElement === input) return;
  input.focus();
  const extensionStart = input.value.lastIndexOf('.');
  input.setSelectionRange(0, extensionStart > 0 ? extensionStart : input.value.length);
}

/** In-place field for naming a new file or folder, or renaming one. ↩ or clicking away saves, ⎋ cancels. */
export function NameInput({ initialValue, placeholder, onCommit, onCancel }: NameInputProps) {
  const [name, setName] = useState(initialValue);
  const exitOnce = useExitOnce();

  function commitName() {
    onCommit(name);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      exitOnce(commitName);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      exitOnce(onCancel);
    }
  }

  function handleBlur() {
    exitOnce(commitName);
  }

  return (
    <input
      ref={focusAndSelectBaseName}
      className="sidebar-name-input"
      value={name}
      placeholder={placeholder}
      spellCheck={false}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}
