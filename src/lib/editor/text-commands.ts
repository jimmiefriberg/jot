import { EditorSelection } from '@codemirror/state';
import type { EditorState, SelectionRange, StateCommand } from '@codemirror/state';

import { findTrailingWhitespace } from '../documents/save-cleanup';

const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
const lineCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** The range a command should act on: the selection, or the word under an empty cursor. */
function targetRange(state: EditorState, range: SelectionRange): { from: number; to: number } {
  if (!range.empty) return { from: range.from, to: range.to };
  return state.wordAt(range.head) ?? { from: range.head, to: range.head };
}

/** Wraps each selection (or the word at the cursor) in a Markdown marker, or removes the marker when it's already there. */
function toggleMarker(marker: string): StateCommand {
  return function toggleMarkerCommand({ state, dispatch }) {
    const size = marker.length;
    const transaction = state.changeByRange((range) => {
      const { from, to } = targetRange(state, range);
      const isWrappedOutside = state.sliceDoc(from - size, from) === marker && state.sliceDoc(to, to + size) === marker;
      if (isWrappedOutside) {
        return {
          changes: [
            { from: from - size, to: from },
            { from: to, to: to + size },
          ],
          range: EditorSelection.range(from - size, to - size),
        };
      }
      const selectedText = state.sliceDoc(from, to);
      const isWrappedInside = selectedText.length >= size * 2 && selectedText.startsWith(marker) && selectedText.endsWith(marker);
      if (isWrappedInside) {
        return {
          changes: { from, to, insert: selectedText.slice(size, -size) },
          range: EditorSelection.range(from, to - size * 2),
        };
      }
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range: EditorSelection.range(from + size, to + size),
      };
    });
    dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input.format' }));
    return true;
  };
}

export const toggleBold = toggleMarker('**');
export const toggleItalic = toggleMarker('_');
export const toggleInlineCode = toggleMarker('`');

/**
 * Turns the selection into a Markdown link. Selected text becomes the label (cursor in the URL part);
 * a selected URL becomes the target (cursor in the label part).
 */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const selectedText = state.sliceDoc(range.from, range.to);
    if (URL_PATTERN.test(selectedText)) {
      return {
        changes: { from: range.from, to: range.to, insert: `[](${selectedText})` },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    const insert = `[${selectedText}]()`;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + (selectedText ? insert.length - 1 : 1)),
    };
  });
  dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

function transformText(transform: (text: string) => string): StateCommand {
  return function transformTextCommand({ state, dispatch }) {
    const transaction = state.changeByRange((range) => {
      const { from, to } = targetRange(state, range);
      const insert = transform(state.sliceDoc(from, to));
      return { changes: { from, to, insert }, range: EditorSelection.range(from, from + insert.length) };
    });
    dispatch(state.update(transaction, { userEvent: 'input.format' }));
    return true;
  };
}

function toTitleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toUpperCase());
}

export const makeUpperCase = transformText((text) => text.toUpperCase());
export const makeLowerCase = transformText((text) => text.toLowerCase());
export const makeTitleCase = transformText(toTitleCase);

/** The lines the selection covers, or the whole document when nothing is selected. */
function selectedLineSpan(state: EditorState): { from: number; to: number } {
  const hasSelection = state.selection.ranges.some((range) => !range.empty);
  if (!hasSelection) return { from: 0, to: state.doc.length };
  const from = Math.min(...state.selection.ranges.map((range) => range.from));
  const to = Math.max(...state.selection.ranges.map((range) => range.to));
  return { from: state.doc.lineAt(from).from, to: state.doc.lineAt(to).to };
}

function sortLines(direction: 1 | -1): StateCommand {
  return function sortLinesCommand({ state, dispatch }) {
    const { from, to } = selectedLineSpan(state);
    const lines = state.sliceDoc(from, to).split(state.lineBreak);
    const sorted = [...lines].sort((first, second) => direction * lineCollator.compare(first, second));
    const insert = sorted.join(state.lineBreak);
    if (insert === state.sliceDoc(from, to)) return true;
    dispatch(
      state.update({
        changes: { from, to, insert },
        selection: EditorSelection.range(from, from + state.toText(insert).length),
        userEvent: 'input.sort',
      }),
    );
    return true;
  };
}

export const sortLinesAscending = sortLines(1);
export const sortLinesDescending = sortLines(-1);

export const removeTrailingWhitespace: StateCommand = ({ state, dispatch }) => {
  const changes = findTrailingWhitespace(state.doc.toString());
  if (changes.length > 0) dispatch(state.update({ changes, userEvent: 'input.trim' }));
  return true;
};
