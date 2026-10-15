import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { message, open, save } from '@tauri-apps/plugin-dialog';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';

import { err, ok } from '../result';
import type { Result } from '../result';
import {
  BROWSER_SAMPLE_FOLDER,
  BROWSER_SAMPLE_MENU_COMMANDS,
  getBrowserSampleDirectory,
  getBrowserSampleDocument,
  getBrowserSampleFiles,
} from './browser-samples';

export interface FileContents {
  contents: string;
  modifiedTime: number | null;
  hasInvalidUtf8: boolean;
}

/** Text a window starts with instead of (or on top of) its file: a recovered draft or a converted document. */
export interface StartingText {
  text: string;
  /** Set when the text is a draft recovered after a crash. */
  draftId: string | null;
  /** File kind for an untitled document, like "json" for a conversion. */
  kind: string | null;
}

export interface DocumentContext {
  /** The file this window shows, or null for an untitled document. */
  path: string | null;
  /** The folder in this window's sidebar, if any. */
  folderPath: string | null;
  startingText: StartingText | null;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface PathRenamed {
  from: string;
  to: string;
}

export interface Draft {
  id: string;
  path: string | null;
  text: string;
}

/** A native menu command whose shortcut can be changed in Settings. Shortcuts use Tauri's format, like "CmdOrCtrl+Shift+K". */
export interface MenuCommand {
  id: string;
  label: string;
  menu: string;
  defaultShortcut: string | null;
}

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

/** A context menu entry, or a separator line. */
export type ContextMenuEntry = ContextMenuItem | 'separator';

export interface DropPosition {
  x: number;
  y: number;
}

export const SAVE_CHOICE = { save: 'save', discard: 'discard', cancel: 'cancel' } as const;
export type SaveChoice = (typeof SAVE_CHOICE)[keyof typeof SAVE_CHOICE];

const SETTINGS_WINDOW_LABEL = 'settings';
const BROWSER_SETTINGS_KEY = 'jot-settings';
const IMAGE_PATH_HEADER = 'x-path';
const isRunningInTauri = isTauri();

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function invokeSafely<T>(command: string, argumentsObject?: Record<string, unknown>): Promise<Result<T>> {
  try {
    return ok(await invoke<T>(command, argumentsObject));
  } catch (error) {
    return err(describeError(error));
  }
}

/** Events sent to this page. In a split window each pane is its own web view, so events target the web view. */
function listenToWindow<T>(eventName: string, onEvent: (payload: T) => void): () => void {
  if (!isRunningInTauri) return () => {};
  const unlisten = getCurrentWebview().listen<T>(eventName, (event) => onEvent(event.payload));
  return () => void unlisten.then((stop) => stop());
}

function listenToApp<T>(eventName: string, onEvent: (payload: T) => void): () => void {
  if (!isRunningInTauri) return () => {};
  const unlisten = listen<T>(eventName, (event) => onEvent(event.payload));
  return () => void unlisten.then((stop) => stop());
}

export function isSettingsWindow(): boolean {
  if (!isRunningInTauri) return new URLSearchParams(window.location.search).has('settings');
  return getCurrentWindow().label === SETTINGS_WINDOW_LABEL;
}

export async function readTextFile(path: string): Promise<Result<FileContents>> {
  if (!isRunningInTauri) {
    const sample = getBrowserSampleDocument(path);
    if (sample === null) return err('Not found');
    return ok({ contents: sample, modifiedTime: null, hasInvalidUtf8: false });
  }
  return invokeSafely<FileContents>('read_text_file', { path });
}

/** Saves atomically and returns the file's new modified time. */
export async function writeTextFile(path: string, contents: string): Promise<Result<number | null>> {
  if (!isRunningInTauri) return ok(null);
  return invokeSafely<number | null>('write_text_file', { path, contents });
}

export async function getFileModifiedTime(path: string): Promise<number | null> {
  if (!isRunningInTauri) return null;
  return invoke<number | null>('file_modified_time', { path });
}

/** Saves image bytes to a new file. Fails when the file already exists. */
export async function saveImageFile(path: string, bytes: Uint8Array): Promise<Result<null>> {
  if (!isRunningInTauri) return err('Pasting images needs the app.');
  try {
    await invoke('save_image', bytes, { headers: { [IMAGE_PATH_HEADER]: encodeURIComponent(path) } });
    return ok(null);
  } catch (error) {
    return err(describeError(error));
  }
}

export async function loadStoredSettings(): Promise<unknown> {
  if (!isRunningInTauri) {
    try {
      const stored = localStorage.getItem(BROWSER_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  return invoke<unknown>('load_settings');
}

export async function storeSettings(settings: unknown): Promise<void> {
  if (!isRunningInTauri) {
    try {
      localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable in private windows; settings then only last for the session.
    }
    return;
  }
  await invoke('save_settings', { settings });
}

export function listenForSettingsChanges(onChange: (settings: unknown) => void): () => void {
  return listenToApp('settings-changed', onChange);
}

export async function getMenuCommands(): Promise<MenuCommand[]> {
  if (!isRunningInTauri) return BROWSER_SAMPLE_MENU_COMMANDS;
  return invoke<MenuCommand[]>('get_menu_commands');
}

export function listenForMenuActions(onAction: (actionId: string) => void): () => void {
  return listenToWindow('menu-action', onAction);
}

/** The file and folder this window was opened for, plus any text it should start with. */
export async function getDocumentContext(): Promise<DocumentContext> {
  if (!isRunningInTauri) {
    const parameters = new URLSearchParams(window.location.search);
    const sample = parameters.get('sample');
    return {
      path: sample ? `${BROWSER_SAMPLE_FOLDER}/example.${sample}` : null,
      folderPath: parameters.has('folder') ? BROWSER_SAMPLE_FOLDER : null,
      startingText: null,
    };
  }
  return invoke<DocumentContext>('get_document_context');
}

/**
 * Makes this window show `path` (null for untitled). Returns false when another window already has it open
 * (that window is focused instead).
 */
export async function claimDocumentPath(path: string | null): Promise<boolean> {
  if (!isRunningInTauri) return true;
  return invoke<boolean>('claim_document_path', { path });
}

export async function setWindowFolder(folder: string | null): Promise<void> {
  if (!isRunningInTauri) return;
  await invoke('set_window_folder', { folder });
}

/** Where a file opens: a new tab in the front window, a window of its own, or the pane beside this one. */
export const OPEN_PLACEMENT = { tab: 'tab', window: 'window', split: 'split' } as const;
export type OpenPlacement = (typeof OPEN_PLACEMENT)[keyof typeof OPEN_PLACEMENT];

/** Opens files in new tabs (or windows); `folder` keeps the sidebar folder in them too. */
export async function openPaths(paths: string[], folder: string | null = null, placement: OpenPlacement = OPEN_PLACEMENT.tab): Promise<void> {
  if (!isRunningInTauri || paths.length === 0) return;
  await invoke('open_paths', { paths, folder, placement });
}

/**
 * ⌘-click (Ctrl on Linux) opens in a new tab, ⇧⌘-click in a new window, ⌥-click beside this pane;
 * a plain click returns null (open here).
 */
export function placementForClick(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): OpenPlacement | null {
  if (event.altKey && !(event.metaKey || event.ctrlKey)) return OPEN_PLACEMENT.split;
  if (!(event.metaKey || event.ctrlKey)) return null;
  return event.shiftKey ? OPEN_PLACEMENT.window : OPEN_PLACEMENT.tab;
}

/** Opens a new untitled window holding `contents`, shown as the given file kind. */
export async function openNewDocument(contents: string, kind: string): Promise<void> {
  if (!isRunningInTauri) {
    console.info(`New ${kind} document:\n${contents}`);
    return;
  }
  await invoke('open_new_document', { contents, kind });
}

/** Dropped folders show in this window's sidebar; dropped files open in their own windows. */
export async function openDroppedPaths(paths: string[]): Promise<void> {
  if (!isRunningInTauri || paths.length === 0) return;
  await invoke('open_dropped_paths', { paths });
}

export async function readDirectory(path: string, includeHidden: boolean): Promise<DirectoryEntry[]> {
  if (!isRunningInTauri) return getBrowserSampleDirectory(path);
  return invoke<DirectoryEntry[]>('read_directory', { path, includeHidden });
}

/** Every file under a folder, for Quick Open. */
export async function listFolderFiles(path: string, includeHidden: boolean): Promise<string[]> {
  if (!isRunningInTauri) return getBrowserSampleFiles(path);
  return invoke<string[]>('list_folder_files', { path, includeHidden });
}

export async function getRecentFiles(): Promise<string[]> {
  if (!isRunningInTauri) return [];
  return invoke<string[]>('get_recent_files');
}

export async function createFile(path: string): Promise<Result<null>> {
  if (!isRunningInTauri) return err('Creating files needs the app.');
  return invokeSafely<null>('create_file', { path });
}

export async function createFolder(path: string): Promise<Result<null>> {
  if (!isRunningInTauri) return err('Creating folders needs the app.');
  return invokeSafely<null>('create_folder', { path });
}

export async function renamePath(from: string, to: string): Promise<Result<null>> {
  if (!isRunningInTauri) return err('Renaming needs the app.');
  return invokeSafely<null>('rename_path', { from, to });
}

/** A file or folder was renamed (from any window). */
export function listenForPathRenamed(onRename: (rename: PathRenamed) => void): () => void {
  return listenToApp('path-renamed', onRename);
}

export async function revealInFinder(path: string): Promise<void> {
  if (!isRunningInTauri) return;
  await revealItemInDir(path);
}

export async function writeDraft(draft: Draft): Promise<Result<null>> {
  if (!isRunningInTauri) return ok(null);
  return invokeSafely<null>('write_draft', { draft });
}

export async function deleteDraft(id: string): Promise<void> {
  if (!isRunningInTauri) return;
  await invoke('delete_draft', { id });
}

export async function pickFolder(): Promise<string | null> {
  if (!isRunningInTauri) return BROWSER_SAMPLE_FOLDER;
  return open({ directory: true, multiple: false });
}

export function listenForFolderOpened(onOpen: (folderPath: string) => void): () => void {
  return listenToWindow('folder-opened', onOpen);
}

export async function cancelQuit(): Promise<void> {
  if (!isRunningInTauri) return;
  await invoke('cancel_quit');
}

export async function showWindow(): Promise<void> {
  if (!isRunningInTauri) return;
  const currentWindow = getCurrentWindow();
  await currentWindow.show();
  await currentWindow.setFocus();
  await getCurrentWebview().setFocus();
}

/** Safety net for startup: shows the window if nothing else has, so it can never stay invisible. */
export async function showWindowIfHidden(): Promise<void> {
  if (!isRunningInTauri) return;
  if (!(await getCurrentWindow().isVisible())) await showWindow();
}

export async function setWindowTitle(title: string): Promise<void> {
  if (!isRunningInTauri) {
    document.title = title;
    return;
  }
  // The window shows the title of its active pane, which Rust keeps track of.
  await invoke('set_pane_title', { title });
}

/** Lets the window decide whether a close may go ahead. Returning false keeps the window open. */
/**
 * Asks `shouldClose` when this window or pane is about to close. Rust asks the panes of a window one at a time
 * and closes once every one agrees.
 */
export function handleCloseRequests(shouldClose: () => Promise<boolean>): () => void {
  if (!isRunningInTauri) return () => {};
  async function answerCloseRequest() {
    let isAllowed = false;
    try {
      isAllowed = await shouldClose();
    } finally {
      await invoke('answer_close_request', { isAllowed });
    }
  }
  const stopListening = listenToWindow('close-requested', () => void answerCloseRequest());
  void invoke('register_close_handler');
  return stopListening;
}

/** Where this pane sits in its window: alone, or the left or right half of a split. */
export const PANE_POSITION = { single: 'single', left: 'left', right: 'right' } as const;
export type PanePosition = (typeof PANE_POSITION)[keyof typeof PANE_POSITION];

export function listenForPaneLayout(onChange: (position: PanePosition) => void): () => void {
  return listenToWindow('pane-layout', onChange);
}

/** The other pane of a split asked this one to open a file (⌥-click, ⌥↩ in Quick Open). */
export function listenForOpenInPane(onOpen: (path: string) => void): () => void {
  return listenToWindow('open-in-pane', onOpen);
}

/** Tells Rust this pane has the focus, so menu actions come here and the window shows this pane's title. */
export async function notifyPaneFocused(): Promise<void> {
  if (!isRunningInTauri) return;
  await invoke('pane_focused');
}

/** Moves the split divider to a horizontal screen position, or back to the middle with null. */
export async function moveSplitDivider(screenX: number | null): Promise<void> {
  if (!isRunningInTauri) return;
  await invoke('move_split_divider', { screenX });
}

export function listenForWindowFocus(onFocus: () => void): () => void {
  if (!isRunningInTauri) return () => {};
  const unlisten = getCurrentWindow().onFocusChanged((event) => {
    if (event.payload) onFocus();
  });
  return () => void unlisten.then((stop) => stop());
}

/** Files dropped on the window, with the drop point in page (CSS pixel) coordinates. */
export function listenForFileDrops(onDrop: (paths: string[], position: DropPosition) => void): () => void {
  if (!isRunningInTauri) return () => {};
  const unlisten = getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop') return;
    const { x, y } = event.payload.position;
    onDrop(event.payload.paths, { x: x / window.devicePixelRatio, y: y / window.devicePixelRatio });
  });
  return () => void unlisten.then((stop) => stop());
}

/** Shows a native context menu at the mouse pointer. */
export async function showContextMenu(entries: ContextMenuEntry[]): Promise<void> {
  if (!isRunningInTauri) return;
  const items = await Promise.all(
    entries.map((entry) =>
      entry === 'separator'
        ? PredefinedMenuItem.new({ item: 'Separator' })
        : MenuItem.new({ text: entry.label, action: entry.onSelect }),
    ),
  );
  const menu = await Menu.new({ items });
  await menu.popup();
}

export async function askToSaveChanges(fileName: string): Promise<SaveChoice> {
  if (!isRunningInTauri) return SAVE_CHOICE.discard;
  const choice = await message(`Do you want to save the changes you made to “${fileName}”?`, {
    title: 'Unsaved changes',
    kind: 'warning',
    buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
  });
  if (choice === 'Save' || choice === 'Yes') return SAVE_CHOICE.save;
  if (choice === "Don't Save" || choice === 'No') return SAVE_CHOICE.discard;
  return SAVE_CHOICE.cancel;
}

export async function askToReloadChangedFile(fileName: string): Promise<boolean> {
  if (!isRunningInTauri) return false;
  const choice = await message(`“${fileName}” was changed by another app. Reload it and lose your unsaved changes?`, {
    title: 'File changed on disk',
    kind: 'warning',
    buttons: { ok: 'Reload', cancel: 'Keep Mine' },
  });
  return choice === 'Reload' || choice === 'Ok';
}

/** Asked before a save would overwrite changes another app made since the file was opened. */
export async function askToOverwriteChangedFile(fileName: string): Promise<boolean> {
  if (!isRunningInTauri) return true;
  const choice = await message(`“${fileName}” was changed by another app since you opened it. Save anyway and replace those changes?`, {
    title: 'File changed on disk',
    kind: 'warning',
    buttons: { ok: 'Save Anyway', cancel: 'Cancel' },
  });
  return choice === 'Save Anyway' || choice === 'Ok';
}

export async function showErrorMessage(title: string, details: string): Promise<void> {
  if (!isRunningInTauri) {
    console.error(title, details);
    return;
  }
  await message(details, { title, kind: 'error' });
}

export async function pickSavePath(suggestedName: string): Promise<string | null> {
  if (!isRunningInTauri) return null;
  return save({ defaultPath: suggestedName });
}

export async function openExternalLink(url: string): Promise<void> {
  if (!isRunningInTauri) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await openUrl(url);
}

/** Turns a local file path into a URL the web view is allowed to load (for Markdown images). */
export function localFileUrl(path: string): string {
  return isRunningInTauri ? convertFileSrc(path) : path;
}
