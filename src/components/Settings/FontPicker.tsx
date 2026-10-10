import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { fontFamilyFor, getFontOptions, isKnownFont } from '../../lib/settings/fonts';
import type { FontRole } from '../../lib/settings/fonts';

const OTHER_FONT_VALUE = '__other__';

interface FontPickerProps {
  role: FontRole;
  label: string;
  fontName: string;
  onChange: (fontName: string) => void;
}

/** Picks a font by name from a short list, or any installed font by typing its name. */
export function FontPicker({ role, label, fontName, onChange }: FontPickerProps) {
  const isCustomFont = !isKnownFont(role, fontName);
  const [isTypingName, setIsTypingName] = useState(isCustomFont);

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    if (event.target.value === OTHER_FONT_VALUE) {
      setIsTypingName(true);
      return;
    }
    setIsTypingName(false);
    onChange(event.target.value);
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.value.trim();
    if (name) onChange(name);
  }

  const selectValue = isTypingName ? OTHER_FONT_VALUE : fontName;
  return (
    <div className="font-picker">
      <select value={selectValue} onChange={handleSelect} aria-label={label}>
        {getFontOptions(role).map((option) => (
          <option key={option.name} value={option.name}>
            {option.name}
          </option>
        ))}
        <option value={OTHER_FONT_VALUE}>Other…</option>
      </select>
      {isTypingName && (
        <input
          type="text"
          defaultValue={isCustomFont ? fontName : ''}
          placeholder="Installed font name"
          onChange={handleNameChange}
          aria-label={`${label} name`}
          spellCheck={false}
          autoFocus
        />
      )}
      <span className="font-picker-sample" style={{ fontFamily: fontFamilyFor(role, fontName) }}>
        The quick brown fox — 0123
      </span>
    </div>
  );
}
