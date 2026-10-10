import { FILE_KIND, getFileName } from '../../lib/documents/file-kind';
import { useDocumentStore } from '../../lib/documents/document-store';
import { closeFolder, startCreatingEntry, useFolderStore } from '../../lib/folders/folder-store';
import { refreshFolderListings } from '../../lib/folders/query-client';
import { SIDEBAR_SIDE } from '../../lib/settings/settings-schema';
import { swapSidebarSide, useSettingsStore } from '../../lib/settings/settings-store';
import { SIDEBAR_PANEL, getAvailablePanels, hideSidebar, resolveSidebarPanel, showSidebarPanel, useSidebarStore } from '../../lib/sidebar/sidebar-store';
import type { SidebarPanel } from '../../lib/sidebar/sidebar-store';
import { Icon } from '../Icon/Icon';
import { FolderTree } from './FolderTree';
import { OutlinePanel } from './OutlinePanel';
import { useSidebarWidth } from './use-sidebar-width';

const PANEL_LABELS: Record<SidebarPanel, string> = {
  files: 'Files',
  outline: 'Outline',
};

function handleRefresh() {
  void refreshFolderListings();
}

function handleNewFile() {
  const { folderPath } = useFolderStore.getState();
  if (folderPath) startCreatingEntry(folderPath, false);
}

function handleShowFiles() {
  showSidebarPanel(SIDEBAR_PANEL.files);
}

function handleShowOutline() {
  showSidebarPanel(SIDEBAR_PANEL.outline);
}

const PANEL_HANDLERS: Record<SidebarPanel, () => void> = {
  files: handleShowFiles,
  outline: handleShowOutline,
};

interface PanelTabsProps {
  panels: SidebarPanel[];
  activePanel: SidebarPanel;
  folderPath: string | null;
}

/** Tabs when both panels have something to show; otherwise just the panel's title. */
function PanelTabs({ panels, activePanel, folderPath }: PanelTabsProps) {
  if (panels.length === 1) {
    const title = activePanel === SIDEBAR_PANEL.files && folderPath ? getFileName(folderPath) : PANEL_LABELS[activePanel];
    return (
      <span className="sidebar-title" title={folderPath ?? undefined}>
        {title}
      </span>
    );
  }
  return (
    <div className="sidebar-tabs" role="tablist">
      {panels.map((panel) => (
        <button key={panel} role="tab" aria-selected={panel === activePanel} className={panel === activePanel ? 'is-active' : undefined} onClick={PANEL_HANDLERS[panel]}>
          {PANEL_LABELS[panel]}
        </button>
      ))}
    </div>
  );
}

/** The sidebar: the open folder's files and, for Markdown, the outline. Resizable, on either side of the window. */
export function Sidebar() {
  const folderPath = useFolderStore((state) => state.folderPath);
  const isMarkdown = useDocumentStore((state) => state.kind === FILE_KIND.markdown);
  const isVisible = useSidebarStore((state) => state.isVisible);
  const chosenPanel = useSidebarStore((state) => state.panel);
  const side = useSettingsStore((state) => state.settings.sidebarSide);
  const { width, resizeHandleProps } = useSidebarWidth(side);

  const panels = getAvailablePanels(folderPath !== null, isMarkdown);
  const activePanel = resolveSidebarPanel(chosenPanel, panels);
  if (!isVisible || !activePanel) return null;
  const isFilesPanel = activePanel === SIDEBAR_PANEL.files;

  return (
    <aside className={`sidebar is-${side}`} style={{ width }} aria-label="Sidebar">
      <div className="sidebar-resize-handle" {...resizeHandleProps} />
      <header className="sidebar-header">
        <PanelTabs panels={panels} activePanel={activePanel} folderPath={folderPath} />
        <div className="sidebar-actions">
          {isFilesPanel && (
            <>
              <button className="icon-button" onClick={handleNewFile} title="New file" aria-label="New file">
                <Icon name="plus" />
              </button>
              <button className="icon-button" onClick={handleRefresh} title="Refresh" aria-label="Refresh">
                <Icon name="refresh" />
              </button>
            </>
          )}
          <button
            className="icon-button"
            onClick={swapSidebarSide}
            title={side === SIDEBAR_SIDE.left ? 'Move to the right' : 'Move to the left'}
            aria-label="Move sidebar to the other side"
          >
            <Icon name="swap" />
          </button>
          <button
            className="icon-button"
            onClick={isFilesPanel ? closeFolder : hideSidebar}
            title={isFilesPanel ? 'Close folder' : 'Hide sidebar'}
            aria-label={isFilesPanel ? 'Close folder' : 'Hide sidebar'}
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="sidebar-body">{isFilesPanel && folderPath ? <FolderTree folderPath={folderPath} /> : <OutlinePanel />}</div>
    </aside>
  );
}
