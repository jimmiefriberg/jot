import { expect, test } from 'bun:test';

import { linkFromPaste, markdownTableFromSpreadsheet } from './markdown-paste';

test('a URL pasted over selected text makes a link', () => {
  expect(linkFromPaste('the docs', 'https://example.com/a?b=1\n')).toBe('[the docs](https://example.com/a?b=1)');
  expect(linkFromPaste('', 'https://example.com')).toBeNull();
  expect(linkFromPaste('two\nlines', 'https://example.com')).toBeNull();
  expect(linkFromPaste('word', 'not a url')).toBeNull();
});

test('spreadsheet cells become a lined-up Markdown table', () => {
  expect(markdownTableFromSpreadsheet('Name\tCity\nAda\tLondon\nGrace\t\n')).toBe(
    ['| Name  | City   |', '| ----- | ------ |', '| Ada   | London |', '| Grace |        |'].join('\n'),
  );
});

test('pipes and line breaks inside cells are kept inside the cell', () => {
  expect(markdownTableFromSpreadsheet('a\tb\n"x|y"\t"two\nlines"')).toContain('| x\\|y | two<br>lines |');
});

test('text without a grid of columns is left alone', () => {
  expect(markdownTableFromSpreadsheet('just text')).toBeNull();
  expect(markdownTableFromSpreadsheet('one column\nonly')).toBeNull();
});
