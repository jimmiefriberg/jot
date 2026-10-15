import { expect, test } from 'bun:test';

import { DEFAULT_SETTINGS, deleteCustomTheme, mergeSettings, resolveActiveTheme, saveCustomTheme } from './settings-schema';

test('falls back to defaults for missing or invalid values', () => {
  const settings = mergeSettings({ fontSize: 200, appearance: 'neon', tabSize: 4, defaultViewMode: { csv: 'plain' } });
  expect(settings.fontSize).toBe(40);
  expect(settings.appearance).toBe(DEFAULT_SETTINGS.appearance);
  expect(settings.tabSize).toBe(4);
  expect(settings.defaultViewMode).toEqual({ ...DEFAULT_SETTINGS.defaultViewMode, csv: 'plain' });
  expect(mergeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  expect(settings.sidebarSide).toBe('left');
  expect(mergeSettings({ sidebarSide: 'right' }).sidebarSide).toBe('right');
  expect(mergeSettings({ sidebarSide: 'top' }).sidebarSide).toBe('left');
});

test('keeps valid custom themes and fills in missing colours', () => {
  const settings = mergeSettings({
    customThemes: [{ id: 'mine', name: 'Mine', isDark: true, colors: { background: '#000000' } }, { id: 1 }],
    darkThemeId: 'mine',
  });
  expect(settings.customThemes).toHaveLength(1);
  const theme = resolveActiveTheme({ ...settings, appearance: 'dark' }, false);
  expect(theme.id).toBe('mine');
  expect(theme.colors.background).toBe('#000000');
  expect(theme.colors.foreground).toBe('#dadde2');
});

test('follows the system appearance and recovers from a deleted theme', () => {
  const settings = mergeSettings({ lightThemeId: 'deleted' });
  expect(resolveActiveTheme(settings, true).id).toBe('ink');
  expect(resolveActiveTheme(settings, false).id).toBe('paper');
});

test('migrates the full font stacks older versions stored to font names', () => {
  const settings = mergeSettings({ editorFontFamily: '"JetBrains Mono"', previewFontFamily: 'ui-serif, Georgia, serif' });
  expect(settings.editorFont).toBe('JetBrains Mono');
  expect(settings.previewFont).toBe('New York');
  expect(mergeSettings({ editorFontFamily: 'ui-monospace' }).editorFont).toBe('SF Mono');
  expect(mergeSettings({ editorFont: 'Berkeley Mono', editorFontFamily: 'Menlo' }).editorFont).toBe('Berkeley Mono');
});

const customTheme = { ...resolveActiveTheme(DEFAULT_SETTINGS, false), id: 'mine', name: 'Mine' };

test('moving a theme between light and dark keeps both slots valid', () => {
  const settings = { ...DEFAULT_SETTINGS, customThemes: [customTheme], lightThemeId: 'mine' };
  const changes = saveCustomTheme(settings, { ...customTheme, isDark: true });
  expect(changes.lightThemeId).toBe('paper');
  expect(changes.darkThemeId).toBe('mine');
  expect(changes.customThemes?.[0].isDark).toBe(true);
});

test('deleting the active theme falls back to the default', () => {
  const settings = { ...DEFAULT_SETTINGS, customThemes: [customTheme], lightThemeId: 'mine' };
  const changes = deleteCustomTheme(settings, 'mine');
  expect(changes.customThemes).toEqual([]);
  expect(changes.lightThemeId).toBe('paper');
  expect(changes.darkThemeId).toBeUndefined();
});
