import { expect, test } from 'bun:test';

import { linkFromPaste, markdownTableFromCells } from './markdown-paste';

test('a URL pasted over selected text makes a link', () => {
  expect(linkFromPaste('the docs', 'https://example.com/a?b=1\n')).toBe('[the docs](https://example.com/a?b=1)');
  expect(linkFromPaste('', 'https://example.com')).toBeNull();
  expect(linkFromPaste('two\nlines', 'https://example.com')).toBeNull();
  expect(linkFromPaste('word', 'not a url')).toBeNull();
});

test('copied cells become a lined-up Markdown table', () => {
  expect(markdownTableFromCells([['Name', 'City'], ['Ada', 'London'], ['Grace']])).toBe(
    ['| Name  | City   |', '| ----- | ------ |', '| Ada   | London |', '| Grace |        |'].join('\n'),
  );
});

test('pipes and line breaks inside cells are kept inside the cell', () => {
  expect(markdownTableFromCells([['a', 'b'], ['x|y', 'two\nlines']])).toContain('| x\\|y | two<br>lines |');
});

test('a single column is left alone', () => {
  expect(markdownTableFromCells([['one column'], ['only']])).toBeNull();
  expect(markdownTableFromCells([])).toBeNull();
});
