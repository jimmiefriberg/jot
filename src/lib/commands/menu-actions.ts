import { selectAll as selectAllText } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';

import { FILE_KIND, VIEW_MODE, hasSeparateFormattedView } from '../documents/file-kind';
import type { FileKind } from '../documents/file-kind';
import { revertDocument, saveDocument, saveDocumentAs } from '../documents/document-actions';
import { setViewMode, toggleSideBySide, toggleViewMode, useDocumentStore } from '../documents/document-store';
import { convertCurrentDocument } from '../convert/convert-actions';
import { focusEditor, getViewText, redoDocument, replaceDocumentText, runEditorCommand, undoDocument } from '../editor/editor-session';
import { formatJson } from '../json/json-tree';
import { toggleSidebar } from '../folders/folder-store';
import { openQuickOpen } from '../quick-open/quick-open-store';
import { swapSidebarSide, toggleSetting, useSettingsStore } from '../settings/settings-store';
import { showOutline } from '../sidebar/sidebar-store';
import { resetZoom, toggleWordWrap, zoomIn, zoomOut } from '../window/window-view-store';
import { runViewCommand } from './command-bus';

/** A search box or other text field the user is typing in; a view's hidden keyboard field (`data-view-keyboard`) isn't one. */
function isTypingInField(element: Element | null): boolean {
  const isField = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  return isField && !element.hasAttribute('data-view-keyboard');
}

/**
 * ⌘A: the whole document in an editor (the browser's own Select All only covers the lines the editor has drawn),
 * the focused field's text, or everything in a formatted view (the whole tree, every CSV row).
 */
function selectAll() {
  const focused = document.activeElement;
  const editorElement = focused?.closest('.cm-editor');
  const view = editorElement instanceof HTMLElement ? EditorView.findFromDOM(editorElement) : null;
  if (view) {
    selectAllText(view);
    return;
  }
  if (!isTypingInField(focused) && runViewCommand('edit.selectAll')) return;
  document.execCommand('selectAll');
}

/** Format Document lines up Markdown tables and pretty-prints JSON; other kinds have nothing to format. */
export function canFormatDocument(kind: FileKind): boolean {
  return kind === FILE_KIND.markdown || kind === FILE_KIND.json;
}

function formatDocument() {
  const { kind } = useDocumentStore.getState();
  if (kind === FILE_KIND.markdown) runEditorCommand('format.tables');
  if (kind !== FILE_KIND.json) return;
  const text = getViewText();
  const formatted = formatJson(text, useSettingsStore.getState().settings.tabSize);
  if (formatted !== text) replaceDocumentText(formatted, 'input.format');
}

function toggleLineNumbers() {
  toggleSetting('showLineNumbers');
}

function toggleInvisibles() {
  toggleSetting('showInvisibles');
}

function toggleTypewriterScrolling() {
  toggleSetting('isTypewriterScrolling');
}

function toggleFocusMode() {
  toggleSetting('isFocusMode');
}

function convertToJson() {
  return convertCurrentDocument(FILE_KIND.json);
}

function convertToYaml() {
  return convertCurrentDocument(FILE_KIND.yaml);
}

function convertToCsv() {
  return convertCurrentDocument(FILE_KIND.csv);
}

/** Commands that act on the whole document or window, whichever view is showing. */
const DOCUMENT_COMMANDS: Record<string, () => unknown> = {
  'file.save': saveDocument,
  'file.saveAs': saveDocumentAs,
  'file.revert': revertDocument,
  'file.quickOpen': openQuickOpen,
  'edit.undo': undoDocument,
  'edit.redo': redoDocument,
  'edit.selectAll': selectAll,
  'view.toggleFormatted': toggleViewMode,
  'view.sideBySide': toggleSideBySide,
  'view.toggleSidebar': toggleSidebar,
  'view.showOutline': showOutline,
  'view.swapSidebarSide': swapSidebarSide,
  'view.wordWrap': toggleWordWrap,
  'view.lineNumbers': toggleLineNumbers,
  'view.showInvisibles': toggleInvisibles,
  'view.typewriter': toggleTypewriterScrolling,
  'view.focusMode': toggleFocusMode,
  'view.formatDocument': formatDocument,
  'view.zoomIn': zoomIn,
  'view.zoomOut': zoomOut,
  'view.zoomReset': resetZoom,
  'format.convertToJson': convertToJson,
  'format.convertToYaml': convertToYaml,
  'format.convertToCsv': convertToCsv,
};

const SEARCH_ACTIONS = new Set(['edit.find', 'edit.replace', 'edit.findNext', 'edit.findPrevious', 'edit.gotoLine']);

/** Search lives in the plain editor, so formatted views switch to it first (unless they handle it themselves). */
function runInPlainView(actionId: string) {
  setViewMode(VIEW_MODE.plain);
  requestAnimationFrame(() => {
    focusEditor();
    runEditorCommand(actionId);
  });
}

/** Routes a native menu action to the document, the active formatted view, or the plain editor. */
export async function handleMenuAction(actionId: string): Promise<void> {
  // The PDF view zooms its pages itself (⌘+ / ⌘−) instead of the whole window.
  if (useDocumentStore.getState().kind === FILE_KIND.pdf && runViewCommand(actionId)) return;
  const documentCommand = DOCUMENT_COMMANDS[actionId];
  if (documentCommand) {
    await documentCommand();
    return;
  }

  const { viewMode, kind } = useDocumentStore.getState();
  // A PDF has no text to edit, search or format.
  if (kind === FILE_KIND.pdf) return;
  const showsSeparateView = viewMode === VIEW_MODE.formatted && hasSeparateFormattedView(kind);
  if (!showsSeparateView) {
    runEditorCommand(actionId);
    return;
  }
  if (runViewCommand(actionId)) return;
  if (SEARCH_ACTIONS.has(actionId)) runInPlainView(actionId);
}
