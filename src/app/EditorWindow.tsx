import { FILE_KIND } from '../lib/documents/file-kind';
import { useDocumentStore, useShowsSeparateFormattedView, useShowsSideBySide } from '../lib/documents/document-store';
import { useSettingsSync } from '../lib/settings/use-settings-sync';
import { PANE_POSITION } from '../lib/tauri/backend';
import { usePanePosition } from '../lib/window/use-pane-position';
import { useDocumentBootstrap, useShowWindowWhenReady, useWindowIntegration } from './use-editor-window';
import { CsvTable } from '../components/CsvTable/CsvTable';
import { JsonLinesTree, JsonTree, YamlTree } from '../components/DataTree/DataTree';
import { FilePreview } from '../components/FilePreview/FilePreview';
import { PaneDivider } from '../components/PaneDivider/PaneDivider';
import { QuickOpen } from '../components/QuickOpen/QuickOpen';
import { SideBySidePreview } from '../components/SideBySidePreview/SideBySidePreview';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { SourceEditor } from '../components/SourceEditor/SourceEditor';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { XmlTree } from '../components/XmlTree/XmlTree';

const SEPARATE_FORMATTED_VIEWS = {
  [FILE_KIND.json]: JsonTree,
  [FILE_KIND.jsonLines]: JsonLinesTree,
  [FILE_KIND.html]: FilePreview,
  [FILE_KIND.csv]: CsvTable,
  [FILE_KIND.yaml]: YamlTree,
  [FILE_KIND.xml]: XmlTree,
};

function FormattedView() {
  const kind = useDocumentStore((state) => state.kind);
  const isEditorReady = useDocumentStore((state) => state.isEditorReady);
  if (kind === FILE_KIND.text || kind === FILE_KIND.markdown || kind === FILE_KIND.pdf || !isEditorReady) return null;
  const View = SEPARATE_FORMATTED_VIEWS[kind];
  // Keyed by kind, so switching the kind from the status bar starts the new view fresh.
  return <View key={kind} />;
}

export function EditorWindow() {
  useSettingsSync();
  useWindowIntegration();
  const isLoaded = useDocumentBootstrap();
  const showsSeparateView = useShowsSeparateFormattedView();
  const showsSideBySide = useShowsSideBySide();
  const isEditorReady = useDocumentStore((state) => state.isEditorReady);
  const isPdf = useDocumentStore((state) => state.kind === FILE_KIND.pdf);
  const documentId = useDocumentStore((state) => state.documentId);
  const initialText = useDocumentStore((state) => state.initialText);
  const panePosition = usePanePosition();
  useShowWindowWhenReady(isLoaded);

  if (!isLoaded) return null;

  // Keyed by document, so opening another file from the sidebar starts a fresh editor and view.
  return (
    <div className="editor-window" data-pane={panePosition}>
      <div className="window-body">
        <main className="document-area" data-side-by-side={showsSideBySide || undefined}>
          <SourceEditor key={`editor-${documentId}`} initialText={initialText} isVisible={!showsSeparateView && !isPdf} />
          {isPdf && <FilePreview key={`pdf-${documentId}`} />}
          {showsSeparateView && <FormattedView key={`view-${documentId}`} />}
          {showsSideBySide && isEditorReady && <SideBySidePreview key={`preview-${documentId}`} />}
        </main>
        <Sidebar />
      </div>
      <StatusBar />
      <QuickOpen />
      {panePosition === PANE_POSITION.left && <PaneDivider />}
    </div>
  );
}
