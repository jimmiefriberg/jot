import { EditorSelection } from '@codemirror/state';
import type { StateCommand } from '@codemirror/state';

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
