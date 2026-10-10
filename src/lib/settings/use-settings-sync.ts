import { useEffect } from 'react';

import { listenForSettingsChanges } from '../tauri/backend';
import { useZoomedFontSize } from '../window/window-view-store';
import { applyThemeToDocument } from './apply-theme';
import { receiveSettings, setSystemPrefersDark, subscribeToSystemAppearance, useActiveTheme, useSettingsStore } from './settings-store';

/** Keeps this window's settings in sync with other windows and the system appearance, and applies the theme. */
export function useSettingsSync(): void {
  const settings = useSettingsStore((state) => state.settings);
  const theme = useActiveTheme();
  const fontSize = useZoomedFontSize();

  useEffect(() => listenForSettingsChanges(receiveSettings), []);
  useEffect(() => subscribeToSystemAppearance(setSystemPrefersDark), []);
  useEffect(() => applyThemeToDocument(theme, settings, fontSize), [theme, settings, fontSize]);
}
