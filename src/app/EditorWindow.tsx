import { FILE_KIND } from '../lib/documents/file-kind';
import { useDocumentStore, useShowsSeparateFormattedView } from '../lib/documents/document-store';
import { useSettingsSync } from '../lib/settings/use-settings-sync';
import { useDocumentBootstrap, useShowWindowWhenReady, useWindowIntegration } from './use-editor-window';
import { CsvTable } from '../components/CsvTable/CsvTable';
import { JsonTree, YamlTree } from '../components/DataTree/DataTree';
import { QuickOpen } from '../components/QuickOpen/QuickOpen';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { SourceEditor } from '../components/SourceEditor/SourceEditor';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { XmlTree } from '../components/XmlTree/XmlTree';

const SEPARATE_FORMATTED_VIEWS = {
  [FILE_KIND.json]: JsonTree,
  [FILE_KIND.csv]: CsvTable,
  [FILE_KIND.yaml]: YamlTree,
  [FILE_KIND.xml]: XmlTree,
};

function FormattedView() {
  const kind = useDocumentStore((state) => state.kind);
  const isEditorReady = useDocumentStore((state) => state.isEditorReady);
  if (kind === FILE_KIND.text || kind === FILE_KIND.markdown || !isEditorReady) return null;
  const View = SEPARATE_FORMATTED_VIEWS[kind];
  // Keyed by kind, so switching the kind from the status bar starts the new view fresh.
  return <View key={kind} />;
}

export function EditorWindow() {
  useSettingsSync();
  useWindowIntegration();
  const isLoaded = useDocumentBootstrap();
  const showsSeparateView = useShowsSeparateFormattedView();
  const documentId = useDocumentStore((state) => state.documentId);
  const initialText = useDocumentStore((state) => state.initialText);
  useShowWindowWhenReady(isLoaded);

  if (!isLoaded) return null;

  // Keyed by document, so opening another file from the sidebar starts a fresh editor and view.
  return (
    <div className="editor-window">
      <div className="window-body">
        <main className="document-area">
          <SourceEditor key={`editor-${documentId}`} initialText={initialText} isVisible={!showsSeparateView} />
          {showsSeparateView && <FormattedView key={`view-${documentId}`} />}
        </main>
        <Sidebar />
      </div>
      <StatusBar />
      <QuickOpen />
    </div>
  );
}
