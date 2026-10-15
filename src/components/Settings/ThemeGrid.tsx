import type { CSSProperties } from 'react';

import type { Theme } from '../../lib/settings/theme-presets';
import { Icon } from '../Icon/Icon';
import { handleChoiceGroupKeyDown } from './choice-group-keys';

interface ThemeGridProps {
  themes: Theme[];
  selectedThemeId: string;
  /** The theme the windows show right now. */
  activeThemeId: string;
  onSelect: (themeId: string) => void;
}

/** A tiny picture of the theme: its background with a heading, some text, a key/value and a selection. */
function ThemeSwatch({ theme }: { theme: Theme }) {
  const { colors } = theme;
  const swatchStyle: CSSProperties = { backgroundColor: colors.background, borderColor: colors.border };
  return (
    <div className="theme-swatch" style={swatchStyle} aria-hidden="true">
      <span className="theme-swatch-line is-heading" style={{ backgroundColor: colors.heading }} />
      <span className="theme-swatch-line" style={{ backgroundColor: colors.foreground, opacity: 0.55 }} />
      <span className="theme-swatch-row">
        <span className="theme-swatch-line is-short" style={{ backgroundColor: colors.property }} />
        <span className="theme-swatch-line is-short" style={{ backgroundColor: colors.string }} />
      </span>
      <span className="theme-swatch-row">
        <span className="theme-swatch-line is-short" style={{ backgroundColor: colors.keyword }} />
        <span className="theme-swatch-line is-selection" style={{ backgroundColor: colors.selection }} />
      </span>
      <span className="theme-swatch-accent" style={{ backgroundColor: colors.accent }} />
    </div>
  );
}

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  isInUse: boolean;
  /** The one card the Tab key stops at; arrow keys reach the rest. */
  isFocusable: boolean;
  onSelect: (themeId: string) => void;
}

function ThemeCard({ theme, isSelected, isInUse, isFocusable, onSelect }: ThemeCardProps) {
  function handleClick() {
    onSelect(theme.id);
  }

  return (
    <button className={`theme-card${isSelected ? ' is-selected' : ''}`} onClick={handleClick} role="radio" aria-checked={isSelected} tabIndex={isFocusable ? 0 : -1}>
      <ThemeSwatch theme={theme} />
      <span className="theme-card-name">
        {theme.name}
        {isSelected && <Icon name="check" size={12} />}
        {isInUse && <span className="theme-card-tag">In use</span>}
      </span>
    </button>
  );
}

/** Theme picker: a card per theme with a small preview. */
export function ThemeGrid({ themes, selectedThemeId, activeThemeId, onSelect }: ThemeGridProps) {
  const hasSelection = themes.some((theme) => theme.id === selectedThemeId);
  return (
    <div className="theme-grid" role="radiogroup" onKeyDown={handleChoiceGroupKeyDown}>
      {themes.map((theme, index) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isSelected={theme.id === selectedThemeId}
          isInUse={theme.id === activeThemeId}
          isFocusable={hasSelection ? theme.id === selectedThemeId : index === 0}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
