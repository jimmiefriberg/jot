import { EditorState } from '@codemirror/state';
import type { Extension, Range, Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

const dimmedLine = Decoration.line({ class: 'cm-dimmed' });

function isKeyboardEdit(transaction: Transaction): boolean {
  if (transaction.isUserEvent('select.pointer')) return false;
  return ['input', 'delete', 'select', 'move', 'undo', 'redo'].some((event) => transaction.isUserEvent(event));
}

/** Typewriter scrolling: typing and moving with the keyboard keep the cursor's line in the middle of the window. */
export const typewriterScrolling: Extension = [
  EditorState.transactionExtender.of((transaction) => {
    if (!isKeyboardEdit(transaction)) return null;
    return { effects: EditorView.scrollIntoView(transaction.newSelection.main.head, { y: 'center' }) };
  }),
  EditorView.editorAttributes.of({ class: 'cm-typewriter' }),
];

/** The first and last line number of the paragraph (run of non-blank lines) around the cursor. */
function currentParagraph(state: EditorState): { first: number; last: number } {
  const { doc } = state;
  const cursorLine = doc.lineAt(state.selection.main.head).number;
  let first = cursorLine;
  let last = cursorLine;
  while (first > 1 && doc.line(first - 1).text.trim() !== '') first--;
  while (last < doc.lines && doc.line(last + 1).text.trim() !== '') last++;
  return { first, last };
}

function buildDimmedLines(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const { first, last } = currentParagraph(view.state);
  const decorations: Range<Decoration>[] = [];
  let previousLineNumber = 0;
  for (const range of view.visibleRanges) {
    let position = range.from;
    while (position <= range.to) {
      const line = doc.lineAt(position);
      if (line.number > previousLineNumber && (line.number < first || line.number > last)) {
        decorations.push(dimmedLine.range(line.from));
      }
      previousLineNumber = line.number;
      position = line.to + 1;
    }
  }
  return Decoration.set(decorations, true);
}

/** Focus mode: everything but the paragraph you're writing in fades back. */
export const focusMode: Extension = [
  ViewPlugin.fromClass(
    class FocusMode {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDimmedLines(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = buildDimmedLines(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.editorAttributes.of({ class: 'cm-focus-mode' }),
];
