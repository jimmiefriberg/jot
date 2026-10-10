import { expect, test } from 'bun:test';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { StateCommand } from '@codemirror/state';

import { insertLink, makeTitleCase, sortLinesAscending, toggleBold } from './text-commands';

/** Runs a command on a document with a selection and returns the new text and selected text. */
function run(command: StateCommand, doc: string, from: number, to = from) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  command({
    state,
    dispatch(transaction) {
      state = transaction.state;
    },
  });
  const { main } = state.selection;
  return { text: state.doc.toString(), selected: state.sliceDoc(main.from, main.to) };
}

test('bold wraps the selection, or the word at the cursor, and unwraps again', () => {
  expect(run(toggleBold, 'make it bold', 8, 12)).toEqual({ text: 'make it **bold**', selected: 'bold' });
  expect(run(toggleBold, 'make it bold', 10)).toEqual({ text: 'make it **bold**', selected: 'bold' });
  expect(run(toggleBold, 'make it **bold**', 10, 14)).toEqual({ text: 'make it bold', selected: 'bold' });
});

test('link uses selected text as the label, or a selected URL as the target', () => {
  expect(run(insertLink, 'see docs', 4, 8).text).toBe('see [docs]()');
  expect(run(insertLink, 'https://example.com', 0, 19).text).toBe('[](https://example.com)');
});

test('capitalizes words', () => {
  expect(run(makeTitleCase, "the cat's HAT", 0, 13).text).toBe("The Cat's Hat");
});

test('sorts the whole document with numbers in natural order', () => {
  expect(run(sortLinesAscending, 'item 10\nitem 2\nApple', 0).text).toBe('Apple\nitem 2\nitem 10');
});
