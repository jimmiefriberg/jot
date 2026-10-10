import {
  SAVE_CHOICE,
  askToOverwriteChangedFile,
  askToReloadChangedFile,
  askToSaveChanges,
  cancelQuit,
  claimDocumentPath,
  getDocumentContext,
  getFileModifiedTime,
  pickSavePath,
  readTextFile,
  showErrorMessage,
  writeTextFile,
} from '../tauri/backend';
import { applyTextChanges, getDocumentText, getViewText, markDocumentSaved, replaceDocumentText } from '../editor/editor-session';
import { openFolder, revealInSidebar } from '../folders/folder-store';
import { flushSettings, useSettingsStore } from '../settings/settings-store';
import type { FileContents, PathRenamed } from '../tauri/backend';
import { adoptRecoveredDraft, discardDraft } from './draft-autosave';
import { FILE_KIND, VIEW_MODE, detectFileKind, getFileName, hasFormattedView, isFileKind } from './file-kind';
import type { FileKind, ViewMode } from './file-kind';
import { useDocumentStore } from './document-store';
import { findMissingFinalNewline, findTrailingWhitespace } from './save-cleanup';

function defaultViewModeFor(kind: FileKind): ViewMode {
  if (!hasFormattedView(kind)) return VIEW_MODE.plain;
  return useSettingsStore.getState().settings.defaultViewMode[kind];
}

function detectLineSeparator(text: string): '\n' | '\r\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Shows the view the settings ask for when this kind of file opens. Run once settings are loaded. */
export function applyDefaultViewMode(): void {
  const { kind } = useDocumentStore.getState();
  useDocumentStore.setState({ viewMode: defaultViewModeFor(kind) });
}

/** Shows the document as another kind (from the status bar), without renaming the file. */
export function setDocumentKind(kind: FileKind): void {
  useDocumentStore.setState({ kind, viewMode: defaultViewModeFor(kind) });
}

/** Puts a freshly read file into the store. A new `documentId` makes the editor and views start over with it. */
function showLoadedDocument(path: string, file: FileContents): void {
  useDocumentStore.setState((state) => ({
    path,
    kind: detectFileKind(path),
    modifiedTime: file.modifiedTime,
    hasInvalidUtf8: file.hasInvalidUtf8,
    lineSeparator: detectLineSeparator(file.contents),
    initialText: file.contents,
    pendingStartingText: null,
    documentId: state.documentId + 1,
    isDirty: false,
    isEditorReady: false,
    isLoaded: true,
  }));
  revealInSidebar(path);
}

/**
 * Loads the file and folder this window was opened for. Run once, together with the settings.
 * A recovered draft or a converted document starts as an unsaved change on top of the file (or an empty document).
 */
export async function loadInitialDocument(): Promise<void> {
  const { path, folderPath, startingText } = await getDocumentContext();
  if (folderPath) openFolder(folderPath);
  if (startingText?.draftId) adoptRecoveredDraft(startingText.draftId);

  const result = path ? await readTextFile(path) : null;
  if (path && result?.isOk) {
    showLoadedDocument(path, result.value);
  } else {
    if (path && result && !result.isOk) await showErrorMessage(`Couldn't open “${getFileName(path)}”`, result.error);
    const kind = isFileKind(startingText?.kind) ? startingText.kind : FILE_KIND.text;
    useDocumentStore.setState({ kind, isLoaded: true });
  }
  if (startingText) useDocumentStore.setState({ pendingStartingText: startingText.text });
}

async function askToSaveBeforeLeaving(): Promise<boolean> {
  const { path, isDirty } = useDocumentStore.getState();
  if (!isDirty) return true;
  const choice = await askToSaveChanges(getFileName(path));
  if (choice === SAVE_CHOICE.cancel) return false;
  if (choice === SAVE_CHOICE.save) return saveDocument();
  await discardDraft();
  return true;
}

/**
 * Replaces this window's document with another file (from the folder sidebar or Quick Open).
 * Asks about unsaved changes first; if the file is open in another window, that window is focused instead.
 */
export async function openFileInThisWindow(path: string): Promise<void> {
  if (path === useDocumentStore.getState().path) return;
  if (!(await askToSaveBeforeLeaving())) return;

  const result = await readTextFile(path);
  if (!result.isOk) {
    await showErrorMessage(`Couldn't open “${getFileName(path)}”`, result.error);
    return;
  }
  const isClaimed = await claimDocumentPath(path);
  if (!isClaimed) return;
  showLoadedDocument(path, result.value);
  applyDefaultViewMode();
}

/** Tidies the text before saving, if Settings ask for it. CSV is left alone: spaces there are cell data. */
function applySaveCleanup() {
  const { trimTrailingWhitespace, insertFinalNewline } = useSettingsStore.getState().settings;
  const { kind } = useDocumentStore.getState();
  if (kind === FILE_KIND.csv || (!trimTrailingWhitespace && !insertFinalNewline)) return;

  const text = getViewText();
  const changes = trimTrailingWhitespace ? findTrailingWhitespace(text, kind === FILE_KIND.markdown) : [];
  const finalNewline = insertFinalNewline ? findMissingFinalNewline(text) : null;
  if (finalNewline) changes.push(finalNewline);
  applyTextChanges(changes, 'input.save-cleanup');
}

async function writeDocumentTo(path: string): Promise<boolean> {
  applySaveCleanup();
  const result = await writeTextFile(path, getDocumentText());
  if (!result.isOk) {
    await showErrorMessage(`Couldn't save “${getFileName(path)}”`, result.error);
    return false;
  }
  markDocumentSaved();
  useDocumentStore.setState({ modifiedTime: result.value, hasInvalidUtf8: false });
  await discardDraft();
  return true;
}

/** Whether another app changed the file since it was opened or last saved here. */
async function hasChangedOnDisk(path: string): Promise<boolean> {
  const { modifiedTime } = useDocumentStore.getState();
  if (modifiedTime === null) return false;
  const currentModifiedTime = await getFileModifiedTime(path);
  return currentModifiedTime !== null && currentModifiedTime !== modifiedTime;
}

/** Saves to the current path, or asks for one if the document is untitled. Returns whether it was saved. */
export async function saveDocument(): Promise<boolean> {
  const { path } = useDocumentStore.getState();
  if (!path) return saveDocumentAs();
  if ((await hasChangedOnDisk(path)) && !(await askToOverwriteChangedFile(getFileName(path)))) return false;
  return writeDocumentTo(path);
}

export async function saveDocumentAs(): Promise<boolean> {
  const { path, kind } = useDocumentStore.getState();
  const suggestedName = path ? getFileName(path) : 'Untitled.txt';
  const newPath = await pickSavePath(suggestedName);
  if (!newPath) return false;

  // Claim the path first: saving over a file that another window has open would leave that window stale.
  if (newPath !== path && !(await claimDocumentPath(newPath))) {
    await showErrorMessage(`Couldn't save “${getFileName(newPath)}”`, 'That file is open in another window. Close it there first.');
    return false;
  }
  const isSaved = await writeDocumentTo(newPath);
  if (!isSaved) {
    if (newPath !== path) await claimDocumentPath(path);
    return false;
  }

  const newKind = detectFileKind(newPath);
  useDocumentStore.setState({ path: newPath, kind: newKind });
  if (newKind !== kind) useDocumentStore.setState({ viewMode: defaultViewModeFor(newKind) });
  revealInSidebar(newPath);
  return true;
}

async function reloadFromDisk(path: string): Promise<void> {
  const result = await readTextFile(path);
  if (!result.isOk) {
    await showErrorMessage(`Couldn't reload “${getFileName(path)}”`, result.error);
    return;
  }
  replaceDocumentText(result.value.contents, 'reload');
  markDocumentSaved();
  await discardDraft();
  useDocumentStore.setState({ modifiedTime: result.value.modifiedTime, hasInvalidUtf8: result.value.hasInvalidUtf8 });
}

export async function revertDocument(): Promise<void> {
  const { path } = useDocumentStore.getState();
  if (path) await reloadFromDisk(path);
}

/** Decides whether the window may close, asking about unsaved changes first. */
export async function confirmClose(): Promise<boolean> {
  const canClose = await askToSaveBeforeLeaving();
  if (!canClose) {
    await cancelQuit();
    return false;
  }
  await Promise.all([discardDraft(), flushSettings()]);
  return true;
}

/** Reloads the file if another app changed it. Asks first when there are unsaved changes here. */
export async function checkForExternalChanges(): Promise<void> {
  const { path, modifiedTime, isDirty } = useDocumentStore.getState();
  if (!path || modifiedTime === null) return;

  const currentModifiedTime = await getFileModifiedTime(path);
  if (currentModifiedTime === null || currentModifiedTime === modifiedTime) return;

  // Remember the new time first, so declining the reload doesn't ask again on every focus.
  useDocumentStore.setState({ modifiedTime: currentModifiedTime });
  const shouldReload = !isDirty || (await askToReloadChangedFile(getFileName(path)));
  if (shouldReload) await reloadFromDisk(path);
}

/** Follows a rename made in the sidebar (in any window): this document's path changes if it was the file or inside the folder. */
export function handlePathRenamed({ from, to }: PathRenamed): void {
  const { path, kind } = useDocumentStore.getState();
  if (!path || (path !== from && !path.startsWith(`${from}/`))) return;
  const newPath = to + path.slice(from.length);
  const newKind = detectFileKind(newPath);
  useDocumentStore.setState({ path: newPath, kind: newKind });
  if (newKind !== kind) applyDefaultViewMode();
}
