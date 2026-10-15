import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { deleteCustomTheme, getAllThemes, isBuiltInTheme, saveCustomTheme } from '../../lib/settings/settings-schema';
import { updateSettings, useSettingsStore } from '../../lib/settings/settings-store';
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, THEME_COLOR_LABELS } from '../../lib/settings/theme-presets';
import type { Theme, ThemeColors } from '../../lib/settings/theme-presets';

interface ThemeEditorProps {
  themeId: string;
  onSelectTheme: (themeId: string) => void;
}

function isThemeColorKey(key: string): key is keyof ThemeColors {
  return key in THEME_COLOR_LABELS;
}

function createThemeId(): string {
  return `custom-${Date.now().toString(36)}`;
}

/** A deleted theme and the picks it was used for, so Undo can put everything back. */
interface DeletedTheme {
  theme: Theme;
  lightThemeId: string;
  darkThemeId: string;
}

function themePreviewStyle(theme: Theme) {
  return {
    backgroundColor: theme.colors.background,
    color: theme.colors.foreground,
    borderColor: theme.colors.border,
  };
}

/** Lists every theme and edits the colours of custom ones. Built-in themes can be duplicated, not changed. */
export function ThemeEditor({ themeId, onSelectTheme }: ThemeEditorProps) {
  const settings = useSettingsStore((state) => state.settings);
  const themes = getAllThemes(settings);
  const theme = themes.find((candidate) => candidate.id === themeId) ?? themes[0];
  const isEditable = !isBuiltInTheme(theme.id);
  const [deletedTheme, setDeletedTheme] = useState<DeletedTheme | null>(null);

  function saveTheme(updatedTheme: Theme) {
    updateSettings(saveCustomTheme(settings, updatedTheme));
  }

  function handleSelectTheme(event: ChangeEvent<HTMLSelectElement>) {
    setDeletedTheme(null);
    onSelectTheme(event.target.value);
  }

  function handleDuplicate() {
    const copy: Theme = { ...theme, id: createThemeId(), name: `${theme.name} copy`, colors: { ...theme.colors } };
    const appearanceKey = copy.isDark ? 'darkThemeId' : 'lightThemeId';
    updateSettings({ customThemes: [...settings.customThemes, copy], [appearanceKey]: copy.id });
    setDeletedTheme(null);
    onSelectTheme(copy.id);
  }

  function handleDelete() {
    setDeletedTheme({ theme, lightThemeId: settings.lightThemeId, darkThemeId: settings.darkThemeId });
    updateSettings(deleteCustomTheme(settings, theme.id));
    onSelectTheme(theme.isDark ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID);
  }

  function handleUndoDelete() {
    if (!deletedTheme) return;
    const { lightThemeId, darkThemeId } = deletedTheme;
    updateSettings({ customThemes: [...settings.customThemes, deletedTheme.theme], lightThemeId, darkThemeId });
    onSelectTheme(deletedTheme.theme.id);
    setDeletedTheme(null);
  }

  function handleRename(event: ChangeEvent<HTMLInputElement>) {
    saveTheme({ ...theme, name: event.target.value });
  }

  function handleDarkChange(event: ChangeEvent<HTMLInputElement>) {
    saveTheme({ ...theme, isDark: event.target.checked });
  }

  function handleColorChange(event: ChangeEvent<HTMLInputElement>) {
    const colorKey = event.target.name;
    if (!isThemeColorKey(colorKey)) return;
    saveTheme({ ...theme, colors: { ...theme.colors, [colorKey]: event.target.value } });
  }

  return (
    <div className="theme-editor">
      {deletedTheme && (
        <div className="theme-editor-undo">
          <span>Deleted “{deletedTheme.theme.name}”.</span>
          <button onClick={handleUndoDelete}>Undo</button>
        </div>
      )}
      <div className="theme-editor-header">
        <select value={theme.id} onChange={handleSelectTheme} aria-label="Theme to edit">
          {themes.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
              {isBuiltInTheme(candidate.id) ? ' (built-in)' : ''}
            </option>
          ))}
        </select>
        <button onClick={handleDuplicate}>Duplicate</button>
        {isEditable && (
          <button className="danger-button" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>

      {isEditable ? (
        <div className="theme-editor-meta">
          <label>
            Name
            <input type="text" value={theme.name} onChange={handleRename} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" role="switch" className="switch" checked={theme.isDark} onChange={handleDarkChange} />
            Dark theme
          </label>
        </div>
      ) : (
        <p className="settings-hint">Built-in themes can't be changed. Duplicate one to make your own.</p>
      )}

      <div className={`color-grid${isEditable ? '' : ' is-read-only'}`}>
        {Object.entries(THEME_COLOR_LABELS).map(([colorKey, label]) => (
          <label key={colorKey} className="color-field">
            <input
              type="color"
              name={colorKey}
              value={isThemeColorKey(colorKey) ? theme.colors[colorKey] : '#000000'}
              onChange={handleColorChange}
              disabled={!isEditable}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="theme-preview" style={themePreviewStyle(theme)}>
        <span style={{ color: theme.colors.heading, fontWeight: 700 }}># Preview</span>
        <span>
          <span style={{ color: theme.colors.property }}>"key"</span>
          <span style={{ color: theme.colors.punctuation }}>: </span>
          <span style={{ color: theme.colors.string }}>"value"</span>
          <span style={{ color: theme.colors.punctuation }}>, </span>
          <span style={{ color: theme.colors.number }}>42</span>
          <span style={{ color: theme.colors.punctuation }}>, </span>
          <span style={{ color: theme.colors.keyword }}>true</span>
        </span>
        <span style={{ color: theme.colors.comment, fontStyle: 'italic' }}>// a comment</span>
        <span>
          Some text with a <span style={{ color: theme.colors.link }}>link</span> and{' '}
          <span style={{ backgroundColor: theme.colors.selection }}>a selection</span>.
        </span>
      </div>
    </div>
  );
}
