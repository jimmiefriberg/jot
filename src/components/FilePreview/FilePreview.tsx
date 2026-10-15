import { useDocumentStore } from '../../lib/documents/document-store';
import { localPageUrl, openInDefaultApp, showErrorMessage } from '../../lib/tauri/backend';

// Scripts run, but without `allow-same-origin` the page can't read other local files or reach the app.
const HTML_SANDBOX = 'allow-scripts allow-forms allow-modals';

async function handleOpenInDefaultApp() {
  const { path } = useDocumentStore.getState();
  if (!path) return;
  const result = await openInDefaultApp(path);
  if (!result.isOk) await showErrorMessage("Couldn't open the file", result.error);
}

/** The saved HTML file shown as a (sandboxed) page. It reloads when the file is saved or changes on disk. */
export function FilePreview() {
  const path = useDocumentStore((state) => state.path);
  const modifiedTime = useDocumentStore((state) => state.modifiedTime);
  const isDirty = useDocumentStore((state) => state.isDirty);

  return (
    <div className="formatted-view file-preview">
      <div className="view-toolbar">
        <span className="file-preview-note">{isDirty ? 'Showing the last saved version. Save (⌘S) to update.' : ''}</span>
        {path && (
          <div className="toolbar-group">
            <button onClick={handleOpenInDefaultApp}>Open in Browser</button>
          </div>
        )}
      </div>
      {path ? (
        <iframe
          key={modifiedTime}
          className="file-preview-frame"
          title="Preview"
          src={`${localPageUrl(path)}?modified=${modifiedTime ?? 0}`}
          sandbox={HTML_SANDBOX}
        />
      ) : (
        <p className="empty-state">Save this file to preview it.</p>
      )}
    </div>
  );
}
