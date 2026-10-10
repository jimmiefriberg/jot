import type { CSSProperties } from 'react';

import type { Theme } from '../../lib/settings/theme-presets';
import { Icon } from '../Icon/Icon';

interface ThemeGridProps {
  themes: Theme[];
  selectedThemeId: string;
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
  onSelect: (themeId: string) => void;
}

function ThemeCard({ theme, isSelected, onSelect }: ThemeCardProps) {
  function handleClick() {
    onSelect(theme.id);
  }

  return (
    <button className={`theme-card${isSelected ? ' is-selected' : ''}`} onClick={handleClick} role="radio" aria-checked={isSelected}>
      <ThemeSwatch theme={theme} />
      <span className="theme-card-name">
        {theme.name}
        {isSelected && <Icon name="check" size={12} />}
      </span>
    </button>
  );
}

/** Theme picker: a card per theme with a small preview. */
export function ThemeGrid({ themes, selectedThemeId, onSelect }: ThemeGridProps) {
  return (
    <div className="theme-grid" role="radiogroup">
      {themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} isSelected={theme.id === selectedThemeId} onSelect={onSelect} />
      ))}
    </div>
  );
}
