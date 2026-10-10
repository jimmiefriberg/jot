import { create } from 'zustand';

import { MAXIMUM_FONT_SIZE, MINIMUM_FONT_SIZE } from '../settings/settings-schema';
import { useSettingsStore } from '../settings/settings-store';

/** View choices that belong to one window only, like TextEdit: zoom and word wrap don't change other windows. */
interface WindowViewState {
  /** Points added to (or taken from) the font size from Settings. */
  zoomStep: number;
  /** Word wrap chosen in this window, or null to follow Settings. */
  wordWrapOverride: boolean | null;
}

export const useWindowViewStore = create<WindowViewState>(() => ({
  zoomStep: 0,
  wordWrapOverride: null,
}));

function clampFontSize(fontSize: number): number {
  return Math.min(MAXIMUM_FONT_SIZE, Math.max(MINIMUM_FONT_SIZE, fontSize));
}

function changeZoom(step: number) {
  const { fontSize } = useSettingsStore.getState().settings;
  useWindowViewStore.setState((state) => {
    const zoomedFontSize = clampFontSize(fontSize + state.zoomStep + step);
    return { zoomStep: zoomedFontSize - fontSize };
  });
}

export function zoomIn(): void {
  changeZoom(1);
}

export function zoomOut(): void {
  changeZoom(-1);
}

export function resetZoom(): void {
  useWindowViewStore.setState({ zoomStep: 0 });
}

export function toggleWordWrap(): void {
  const { isWordWrapEnabled } = useSettingsStore.getState().settings;
  useWindowViewStore.setState((state) => ({ wordWrapOverride: !(state.wordWrapOverride ?? isWordWrapEnabled) }));
}

/** The font size this window shows: the setting plus this window's zoom. */
export function useZoomedFontSize(): number {
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const zoomStep = useWindowViewStore((state) => state.zoomStep);
  return clampFontSize(fontSize + zoomStep);
}

export function useIsWordWrapEnabled(): boolean {
  const isWordWrapEnabled = useSettingsStore((state) => state.settings.isWordWrapEnabled);
  const wordWrapOverride = useWindowViewStore((state) => state.wordWrapOverride);
  return wordWrapOverride ?? isWordWrapEnabled;
}
