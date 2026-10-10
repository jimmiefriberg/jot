import { FILE_KIND_LABEL } from '../documents/file-kind';
import { useDocumentStore } from '../documents/document-store';
import { getViewText } from '../editor/editor-session';
import { useSettingsStore } from '../settings/settings-store';
import { openNewDocument, showErrorMessage } from '../tauri/backend';
import { convertDocument, isConvertibleKind } from './convert-document';
import type { ConvertibleKind } from './convert-document';

/** Converts this window's JSON, YAML or CSV document and opens the result in a new untitled window. */
export async function convertCurrentDocument(toKind: ConvertibleKind): Promise<void> {
  const { kind } = useDocumentStore.getState();
  const targetLabel = FILE_KIND_LABEL[toKind];
  if (!isConvertibleKind(kind)) {
    await showErrorMessage(`Couldn't convert to ${targetLabel}`, 'Only JSON, YAML and CSV documents can be converted.');
    return;
  }
  if (kind === toKind) return;

  const { tabSize, csvFirstRowIsHeader } = useSettingsStore.getState().settings;
  const result = convertDocument(getViewText(), kind, toKind, { tabSize, isFirstRowHeader: csvFirstRowIsHeader });
  if (!result.isOk) {
    await showErrorMessage(`Couldn't convert to ${targetLabel}`, result.error);
    return;
  }
  await openNewDocument(result.value, toKind);
}
