import { deleteLine } from '@codemirror/commands';
import { EditorSelection } from '@codemirror/state';
import type { EditorState, StateCommand } from '@codemirror/state';
import type { Command } from '@codemirror/view';

function leadingWhitespace(text: string): string {
  return /^\s*/.exec(text)?.[0] ?? '';
}

/** Opens a new line below each cursor's line, keeping its indentation, without splitting the current line. */
export const insertLineBelow: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head);
    const insert = state.lineBreak + leadingWhitespace(line.text);
    return {
      changes: { from: line.to, insert },
      range: EditorSelection.cursor(line.to + insert.length),
    };
  });
  dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

/** Opens a new line above each cursor's line, keeping its indentation. */
export const insertLineAbove: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head);
    const indentation = leadingWhitespace(line.text);
    return {
      changes: { from: line.from, insert: indentation + state.lineBreak },
      range: EditorSelection.cursor(line.from + indentation.length),
    };
  });
  dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

/** The whole lines under the cursors, each ending in a line break, when nothing is selected. */
function cursorLinesText(state: EditorState): string | null {
  if (state.selection.ranges.some((range) => !range.empty)) return null;
  const lineNumbers = new Set(state.selection.ranges.map((range) => state.doc.lineAt(range.head).number));
  return [...lineNumbers].map((lineNumber) => state.doc.line(lineNumber).text + state.lineBreak).join('');
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // The clipboard can refuse a write (no permission); there is nothing useful to tell the user.
  }
}

// macOS disables Copy and Cut with no selection, so ⌘C/⌘X with only a cursor are handled here: they take the whole line.
export const copyLineWhenNothingSelected: Command = (view) => {
  const text = cursorLinesText(view.state);
  if (text === null) return false;
  void writeClipboard(text);
  return true;
};

export const cutLineWhenNothingSelected: Command = (view) => {
  const text = cursorLinesText(view.state);
  if (text === null) return false;
  void writeClipboard(text);
  return deleteLine(view);
};
