import { create } from 'zustand';

import { loadStoredSettings, storeSettings } from '../tauri/backend';
import { DEFAULT_SETTINGS, SIDEBAR_SIDE, mergeSettings, resolveActiveTheme } from './settings-schema';
import type { Settings } from './settings-schema';
import type { Theme } from './theme-presets';

interface SettingsState {
  settings: Settings;
  systemPrefersDark: boolean;
}

/** Changes apply at once; saving (and telling other windows) waits until typing or dragging pauses. */
const SAVE_DELAY_MS = 300;

const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>(() => ({
  settings: DEFAULT_SETTINGS,
  systemPrefersDark: darkSchemeQuery.matches,
}));

export async function loadSettings(): Promise<void> {
  const stored = await loadStoredSettings();
  useSettingsStore.setState({ settings: mergeSettings(stored) });
}

/** Applies settings that another window saved. Ignored while this window has newer changes waiting to be saved. */
export function receiveSettings(stored: unknown): void {
  if (pendingSaveTimer !== null) return;
  useSettingsStore.setState({ settings: mergeSettings(stored) });
}

/** Saves any change that is still waiting. Run before a window closes. */
export async function flushSettings(): Promise<void> {
  if (pendingSaveTimer === null) return;
  clearTimeout(pendingSaveTimer);
  pendingSaveTimer = null;
  await storeSettings(useSettingsStore.getState().settings);
}

function handleSaveTimer() {
  void flushSettings();
}

/** Updates settings and applies them here right away. Saving (which updates every other window too) follows shortly. */
export function updateSettings(changes: Partial<Settings>): void {
  useSettingsStore.setState((state) => ({ settings: { ...state.settings, ...changes } }));
  if (pendingSaveTimer !== null) clearTimeout(pendingSaveTimer);
  pendingSaveTimer = setTimeout(handleSaveTimer, SAVE_DELAY_MS);
}

/** Flips a yes/no setting, like line numbers or invisible characters. */
export function toggleSetting(key: 'showLineNumbers' | 'showInvisibles' | 'isTypewriterScrolling' | 'isFocusMode'): void {
  const { settings } = useSettingsStore.getState();
  updateSettings({ [key]: !settings[key] });
}

/** Moves the folder sidebar to the other side of the window (in every window). */
export function swapSidebarSide(): void {
  const { sidebarSide } = useSettingsStore.getState().settings;
  updateSettings({ sidebarSide: sidebarSide === SIDEBAR_SIDE.left ? SIDEBAR_SIDE.right : SIDEBAR_SIDE.left });
}

export function setSystemPrefersDark(systemPrefersDark: boolean): void {
  useSettingsStore.setState({ systemPrefersDark });
}

export function subscribeToSystemAppearance(onChange: (prefersDark: boolean) => void): () => void {
  function handleChange(event: MediaQueryListEvent) {
    onChange(event.matches);
  }
  darkSchemeQuery.addEventListener('change', handleChange);
  return () => darkSchemeQuery.removeEventListener('change', handleChange);
}

export function useActiveTheme(): Theme {
  const settings = useSettingsStore((state) => state.settings);
  const systemPrefersDark = useSettingsStore((state) => state.systemPrefersDark);
  return resolveActiveTheme(settings, systemPrefersDark);
}
