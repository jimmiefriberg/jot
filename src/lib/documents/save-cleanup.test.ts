import { expect, test } from 'bun:test';

import { findMissingFinalNewline, findTrailingWhitespace } from './save-cleanup';

test('finds trailing spaces and tabs on every line', () => {
  expect(findTrailingWhitespace('a  \nb\t\nc')).toEqual([
    { from: 1, to: 3, insert: '' },
    { from: 5, to: 6, insert: '' },
  ]);
});

test('can keep Markdown hard line breaks', () => {
  expect(findTrailingWhitespace('line one  \nline two \n', true)).toEqual([{ from: 19, to: 20, insert: '' }]);
});

test('adds a final newline only when one is missing', () => {
  expect(findMissingFinalNewline('text')).toEqual({ from: 4, to: 4, insert: '\n' });
  expect(findMissingFinalNewline('text\n')).toBeNull();
  expect(findMissingFinalNewline('')).toBeNull();
});
