import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  addCursorAbove,
  addCursorBelow,
  copyLineDown,
  copyLineUp,
  defaultKeymap,
  deleteLine,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
  moveLineDown,
  moveLineUp,
  redo,
  selectLine,
  toggleComment,
  undo,
} from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { json, jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import {
  findNext,
  findPrevious,
  gotoLine,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  selectNextOccurrence,
  selectSelectionMatches,
} from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, Prec, Text } from '@codemirror/state';
import type { ChangeSpec, Extension } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import type { Command } from '@codemirror/view';

import { FILE_KIND } from '../documents/file-kind';
import { createMinimalChange, normalizeLineBreaks } from '../documents/text-change';
import type { TextChange } from '../documents/text-change';
import type { FileKind } from '../documents/file-kind';
import { useDocumentStore } from '../documents/document-store';
import { editorTheme } from './editor-theme';
import { copyLineWhenNothingSelected, cutLineWhenNothingSelected, insertLineAbove, insertLineBelow } from './line-commands';
import { livePreview } from './live-preview/live-preview';
import { livePreviewEnvironment } from './live-preview/live-preview-environment';
import { markdownImagePaste } from './markdown-images';
import { markdownSmartPaste } from './markdown-paste';
import { markdownSyntaxExtensions } from './markdown-syntax';
import {
  deleteTableColumn,
  deleteTableRow,
  formatAllTables,
  insertTableColumnLeft,
  insertTableColumnRight,
  insertTableRowAbove,
  insertTableRowBelow,
  nextTableCell,
  previousTableCell,
} from './table-commands';
import {
  insertLink,
  makeLowerCase,
  makeTitleCase,
  makeUpperCase,
  removeTrailingWhitespace,
  sortLinesAscending,
  sortLinesDescending,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleTask,
} from './text-commands';
import { focusMode, typewriterScrolling } from './writing-modes';

export interface EditorOptions {
  kind: FileKind;
  tabSize: number;
  isWordWrapEnabled: boolean;
  showLineNumbers: boolean;
  highlightActiveLine: boolean;
  showInvisibles: boolean;
  isTypewriterScrolling: boolean;
  isFocusMode: boolean;
  /** Markdown's formatted view: the same editor with markup hidden and blocks rendered. */
  isLivePreview: boolean;
}

const languageCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const activeLineCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const livePreviewCompartment = new Compartment();
const invisiblesCompartment = new Compartment();
const writingModesCompartment = new Compartment();

let editorView: EditorView | null = null;
let savedDocument: Text | null = null;

/** Prose gets the system spell checker; code and data files don't, so keys and values aren't underlined. */
function isProse(kind: FileKind): boolean {
  return kind === FILE_KIND.text || kind === FILE_KIND.markdown;
}

function languageExtension(kind: FileKind): Extension {
  const contentAttributes = EditorView.contentAttributes.of({
    spellcheck: isProse(kind) ? 'true' : 'false',
    autocorrect: 'off',
    autocapitalize: 'off',
  });
  if (kind === FILE_KIND.markdown) {
    // Fenced code is highlighted in its own language; the grammars load the first time a language is used.
    const markdownSupport = markdown({ base: markdownLanguage, codeLanguages: languages, extensions: markdownSyntaxExtensions });
    // Smart paste comes first: spreadsheets also put a picture of the cells on the clipboard, which isn't wanted here.
    return [contentAttributes, markdownSupport, markdownSmartPaste, markdownImagePaste, markdownTableKeymap];
  }
  if (kind === FILE_KIND.json) {
    return [contentAttributes, json(), jsonLanguage.data.of({ commentTokens: { line: '//' } }), foldGutter(), closeBrackets()];
  }
  if (kind === FILE_KIND.jsonLines) return [contentAttributes, json(), closeBrackets()];
  if (kind === FILE_KIND.html) return [contentAttributes, html(), foldGutter()];
  if (kind === FILE_KIND.yaml) return [contentAttributes, yaml(), foldGutter()];
  if (kind === FILE_KIND.xml) return [contentAttributes, xml(), foldGutter()];
  return contentAttributes;
}

// Tab and ⇧Tab move between table cells; outside a table they fall through to indenting.
const markdownTableKeymap = Prec.high(
  keymap.of([
    { key: 'Tab', run: nextTableCell },
    { key: 'Shift-Tab', run: previousTableCell },
  ]),
);

function lineNumbersExtension(options: EditorOptions): Extension {
  return options.showLineNumbers && !options.isLivePreview ? lineNumbers() : [];
}

function activeLineExtension(options: EditorOptions): Extension {
  if (!options.highlightActiveLine || options.isLivePreview) return [];
  return [highlightActiveLine(), highlightActiveLineGutter()];
}

function wordWrapExtension(options: EditorOptions): Extension {
  return options.isWordWrapEnabled || options.isLivePreview ? EditorView.lineWrapping : [];
}

function livePreviewExtension(options: EditorOptions): Extension {
  return options.isLivePreview ? livePreview(livePreviewEnvironment) : [];
}

function tabSizeExtension(options: EditorOptions): Extension {
  return [EditorState.tabSize.of(options.tabSize), indentUnit.of(' '.repeat(options.tabSize))];
}

function invisiblesExtension(options: EditorOptions): Extension {
  return options.showInvisibles ? highlightWhitespace() : [];
}

function writingModesExtension(options: EditorOptions): Extension {
  return [options.isTypewriterScrolling ? typewriterScrolling : [], options.isFocusMode ? focusMode : []];
}

// The native menu owns most shortcuts on macOS; this keymap covers the same keys when there is no menu (Linux, browser).
const editorKeymap = keymap.of([
  { key: 'Mod-c', run: copyLineWhenNothingSelected },
  { key: 'Mod-x', run: cutLineWhenNothingSelected },
  { key: 'Mod-Enter', run: insertLineBelow },
  { key: 'Mod-Shift-Enter', run: insertLineAbove },
  { key: 'Mod-l', run: selectLine, preventDefault: true },
  { key: 'Mod-Shift-l', run: selectSelectionMatches, preventDefault: true },
  { key: 'Ctrl-g', run: gotoLine, preventDefault: true },
  { key: 'Mod-Alt-t', run: toggleTask, preventDefault: true },
  ...closeBracketsKeymap,
  ...defaultKeymap,
  ...searchKeymap,
  ...historyKeymap,
  ...foldKeymap,
  indentWithTab,
]);

function publishDocumentChange(view: EditorView) {
  useDocumentStore.setState((state) => ({
    revision: state.revision + 1,
    isDirty: savedDocument === null || !view.state.doc.eq(savedDocument),
  }));
}

function publishCursor(view: EditorView) {
  const { selection, doc } = view.state;
  const head = selection.main.head;
  const line = doc.lineAt(head);
  const selectedCharacters = selection.ranges.reduce((total, range) => total + (range.to - range.from), 0);
  useDocumentStore.setState({
    cursor: {
      line: line.number,
      column: head - line.from + 1,
      selectedCharacters,
      selectionCount: selection.ranges.length,
    },
  });
}

const documentListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) publishDocumentChange(update.view);
  if (update.docChanged || update.selectionSet) publishCursor(update.view);
});

/** Text as editor lines. Splitting on every line break keeps CRLF documents correct (their separator is "\r\n"). */
function toDocumentText(text: string): Text {
  return Text.of(normalizeLineBreaks(text).split('\n'));
}

/** Creates the one editor for this window. The editor's document is the single source of truth for every view. */
export function createEditor(parent: HTMLElement, text: string, lineSeparator: string, options: EditorOptions): EditorView {
  const state = EditorState.create({
    doc: text,
    extensions: [
      // Keeping CRLF files as CRLF; otherwise CodeMirror accepts any line ending and writes LF.
      lineSeparator === '\r\n' ? EditorState.lineSeparator.of(lineSeparator) : [],
      EditorState.allowMultipleSelections.of(true),
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      search({ top: true }),
      editorKeymap,
      editorTheme,
      documentListener,
      languageCompartment.of(languageExtension(options.kind)),
      lineNumbersCompartment.of(lineNumbersExtension(options)),
      wordWrapCompartment.of(wordWrapExtension(options)),
      activeLineCompartment.of(activeLineExtension(options)),
      tabSizeCompartment.of(tabSizeExtension(options)),
      livePreviewCompartment.of(livePreviewExtension(options)),
      invisiblesCompartment.of(invisiblesExtension(options)),
      writingModesCompartment.of(writingModesExtension(options)),
    ],
  });
  editorView = new EditorView({ state, parent });
  savedDocument = state.doc;
  return editorView;
}

/** A read-only Markdown preview of this window's document, shown beside the plain editor. Ticked checkboxes edit the document. */
export function createSideBySidePreview(parent: HTMLElement): EditorView {
  const forwardTaskToggles = EditorView.updateListener.of((update) => {
    if (!update.transactions.some((transaction) => transaction.isUserEvent('input.toggle-task'))) return;
    editorView?.dispatch({ changes: update.changes, userEvent: 'input.toggle-task' });
  });
  const state = EditorState.create({
    doc: editorView?.state.doc ?? '',
    extensions: [
      drawSelection(),
      editorTheme,
      languageExtension(FILE_KIND.markdown),
      EditorView.lineWrapping,
      livePreview(livePreviewEnvironment),
      forwardTaskToggles,
    ],
  });
  return new EditorView({ state, parent });
}

/** Brings a side-by-side preview's text up to date with the document, changing only the part that differs. */
export function syncSideBySidePreview(preview: EditorView): void {
  if (!editorView || preview.state.doc.eq(editorView.state.doc)) return;
  const change = createMinimalChange(preview.state.doc.toString(), getViewText());
  if (change) preview.dispatch({ changes: { from: change.from, to: change.to, insert: change.insert } });
}

/** How far a view is scrolled, from the top of its document. */
function scrolledHeight(view: EditorView): number {
  return view.scrollDOM.getBoundingClientRect().top - view.documentTop;
}

/** Scrolls `target` so it shows the same line at its top as `source` does (both views hold the same text). */
export function alignScroll(source: EditorView, target: EditorView): void {
  const sourceHeight = scrolledHeight(source);
  const sourceBlock = source.lineBlockAtHeight(sourceHeight);
  const lineNumber = Math.min(source.state.doc.lineAt(sourceBlock.from).number, target.state.doc.lines);
  const targetBlock = target.lineBlockAt(target.state.doc.line(lineNumber).from);
  const progressInBlock = sourceBlock.height > 0 ? (sourceHeight - sourceBlock.top) / sourceBlock.height : 0;
  const targetHeight = targetBlock.top + progressInBlock * targetBlock.height;
  target.scrollDOM.scrollTop += targetHeight - scrolledHeight(target);
}

export function destroyEditor(): void {
  editorView?.destroy();
  editorView = null;
}

export function getEditorView(): EditorView | null {
  return editorView;
}

export function reconfigureEditor(options: EditorOptions): void {
  editorView?.dispatch({
    effects: [
      languageCompartment.reconfigure(languageExtension(options.kind)),
      lineNumbersCompartment.reconfigure(lineNumbersExtension(options)),
      wordWrapCompartment.reconfigure(wordWrapExtension(options)),
      activeLineCompartment.reconfigure(activeLineExtension(options)),
      tabSizeCompartment.reconfigure(tabSizeExtension(options)),
      livePreviewCompartment.reconfigure(livePreviewExtension(options)),
      invisiblesCompartment.reconfigure(invisiblesExtension(options)),
      writingModesCompartment.reconfigure(writingModesExtension(options)),
    ],
  });
}

/** The full document text with the file's own line endings, as it is written to disk. */
export function getDocumentText(): string {
  return editorView?.state.sliceDoc() ?? '';
}

/**
 * The document text with LF line breaks. Offsets in it match editor positions exactly (even in CRLF files),
 * so formatted views read and edit this text.
 */
export function getViewText(): string {
  return editorView?.state.doc.toString() ?? '';
}

export function getDocumentLength(): number {
  return editorView?.state.doc.length ?? 0;
}

function toChangeSpec(change: TextChange): ChangeSpec {
  return { from: change.from, to: change.to, insert: toDocumentText(change.insert) };
}

/**
 * Replaces the document with new text as one undoable edit (used by formatted views, Format Document and reloads).
 * Only the part that actually differs is changed, so undo history stays small and the cursor stays put elsewhere.
 */
export function replaceDocumentText(text: string, userEvent = 'input.replace'): void {
  if (!editorView) return;
  const change = createMinimalChange(getViewText(), normalizeLineBreaks(text));
  if (change) editorView.dispatch({ changes: toChangeSpec(change), userEvent });
}

/** Applies one edit given in view-text offsets (see `getViewText`). */
export function applyTextChange(change: TextChange): void {
  editorView?.dispatch({ changes: toChangeSpec(change), userEvent: 'input' });
}

/** Applies several non-overlapping edits (view-text offsets) as one undoable change. */
export function applyTextChanges(changes: TextChange[], userEvent = 'input'): void {
  if (!editorView || changes.length === 0) return;
  editorView.dispatch({ changes: changes.map(toChangeSpec), userEvent });
}

/** The document as it is now, to hand to `markDocumentSaved` once that text has been written. */
export function getDocumentSnapshot(): Text | null {
  return editorView?.state.doc ?? null;
}

/**
 * Remembers `writtenDocument` (by default the current text) as what's on disk.
 * Edits made while it was being written keep the document dirty.
 */
export function markDocumentSaved(writtenDocument?: Text | null): void {
  if (!editorView) return;
  savedDocument = writtenDocument ?? editorView.state.doc;
  useDocumentStore.setState({ isDirty: !editorView.state.doc.eq(savedDocument) });
}

export function focusEditor(): void {
  editorView?.focus();
}

/** Moves the cursor to a character offset and scrolls it into the middle of the view. */
export function revealOffset(offset: number): void {
  if (!editorView) return;
  const position = Math.min(offset, editorView.state.doc.length);
  editorView.dispatch({
    selection: EditorSelection.cursor(position),
    effects: EditorView.scrollIntoView(position, { y: 'center' }),
  });
  editorView.focus();
}

/** Moves the cursor to the start of a (zero-based) line. */
export function revealLine(lineIndex: number): void {
  if (!editorView) return;
  const lineNumber = Math.min(lineIndex + 1, editorView.state.doc.lines);
  revealOffset(editorView.state.doc.line(lineNumber).from);
}

/** Inserts text at a document position (or the cursor) and puts the cursor after it. */
export function insertTextAt(text: string, position?: number): void {
  if (!editorView) return;
  const from = position ?? editorView.state.selection.main.head;
  const insertedText = toDocumentText(text);
  editorView.dispatch({
    changes: { from, insert: insertedText },
    selection: EditorSelection.cursor(from + insertedText.length),
    userEvent: 'input',
  });
  editorView.focus();
}

const EDITOR_COMMANDS: Record<string, Command> = {
  'edit.undo': undo,
  'edit.redo': redo,
  'edit.find': openSearchPanel,
  'edit.replace': openSearchPanel,
  'edit.findNext': findNext,
  'edit.findPrevious': findPrevious,
  'edit.gotoLine': gotoLine,
  'selection.insertLineAbove': insertLineAbove,
  'selection.insertLineBelow': insertLineBelow,
  'selection.moveLineUp': moveLineUp,
  'selection.moveLineDown': moveLineDown,
  'selection.copyLineUp': copyLineUp,
  'selection.copyLineDown': copyLineDown,
  'selection.deleteLine': deleteLine,
  'selection.selectLine': selectLine,
  'selection.addNextOccurrence': selectNextOccurrence,
  'selection.selectAllOccurrences': selectSelectionMatches,
  'selection.addCursorAbove': addCursorAbove,
  'selection.addCursorBelow': addCursorBelow,
  'selection.indent': indentMore,
  'selection.outdent': indentLess,
  'selection.toggleComment': toggleComment,
  'format.bold': toggleBold,
  'format.italic': toggleItalic,
  'format.inlineCode': toggleInlineCode,
  'format.link': insertLink,
  'format.toggleTask': toggleTask,
  'format.upperCase': makeUpperCase,
  'format.lowerCase': makeLowerCase,
  'format.titleCase': makeTitleCase,
  'format.sortAscending': sortLinesAscending,
  'format.sortDescending': sortLinesDescending,
  'format.removeTrailingWhitespace': removeTrailingWhitespace,
  'format.tables': formatAllTables,
  // Markdown tables; the CSV table handles these itself.
  'table.insertRowAbove': insertTableRowAbove,
  'table.insertRowBelow': insertTableRowBelow,
  'table.insertColumnLeft': insertTableColumnLeft,
  'table.insertColumnRight': insertTableColumnRight,
  'table.deleteRows': deleteTableRow,
  'table.deleteColumns': deleteTableColumn,
};

/** Runs a menu command in the editor. Returns false when the editor doesn't know the command. */
export function runEditorCommand(actionId: string): boolean {
  const command = EDITOR_COMMANDS[actionId];
  if (!command || !editorView) return false;
  command(editorView);
  return true;
}

export function undoDocument(): void {
  if (editorView) undo(editorView);
}

export function redoDocument(): void {
  if (editorView) redo(editorView);
}
