import { create } from 'zustand';

import { FILE_KIND } from '../documents/file-kind';
import { useDocumentStore } from '../documents/document-store';

export const SIDEBAR_PANEL = { files: 'files', outline: 'outline' } as const;
export type SidebarPanel = (typeof SIDEBAR_PANEL)[keyof typeof SIDEBAR_PANEL];

interface SidebarState {
  isVisible: boolean;
  /** The panel the user picked last. If it has nothing to show, the other one is shown. */
  panel: SidebarPanel;
}

export const useSidebarStore = create<SidebarState>(() => ({
  isVisible: false,
  panel: SIDEBAR_PANEL.files,
}));

export function showSidebarPanel(panel: SidebarPanel): void {
  useSidebarStore.setState({ isVisible: true, panel });
}

export function hideSidebar(): void {
  useSidebarStore.setState({ isVisible: false });
}

export function setSidebarVisible(isVisible: boolean): void {
  useSidebarStore.setState({ isVisible });
}

export function showOutline(): void {
  if (useDocumentStore.getState().kind === FILE_KIND.markdown) showSidebarPanel(SIDEBAR_PANEL.outline);
}

/** Which panels have something to show: Files needs an open folder, Outline needs a Markdown document. */
export function getAvailablePanels(hasFolder: boolean, isMarkdown: boolean): SidebarPanel[] {
  const panels: SidebarPanel[] = [];
  if (hasFolder) panels.push(SIDEBAR_PANEL.files);
  if (isMarkdown) panels.push(SIDEBAR_PANEL.outline);
  return panels;
}

/** The panel to show: the chosen one when it's available, otherwise the first available one. */
export function resolveSidebarPanel(chosenPanel: SidebarPanel, availablePanels: SidebarPanel[]): SidebarPanel | null {
  if (availablePanels.includes(chosenPanel)) return chosenPanel;
  return availablePanels[0] ?? null;
}
