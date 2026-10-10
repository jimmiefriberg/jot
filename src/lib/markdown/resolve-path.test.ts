import { expect, test } from 'bun:test';

import { encodeMarkdownPath, hasUrlScheme, relativePath, resolveRelativePath } from './resolve-path';

test('resolves references against the document folder', () => {
  expect(resolveRelativePath('/Users/me/notes/today.md', 'images/a%20b.png')).toBe('/Users/me/notes/images/a b.png');
  expect(resolveRelativePath('/Users/me/notes/today.md', '../todo.md#later')).toBe('/Users/me/todo.md');
  expect(resolveRelativePath('/Users/me/notes/today.md', './x.md')).toBe('/Users/me/notes/x.md');
  expect(resolveRelativePath('/Users/me/notes/today.md', '/etc/hosts')).toBe('/etc/hosts');
});

test('keeps references with a stray % instead of failing', () => {
  expect(resolveRelativePath('/Users/me/notes/today.md', '100%.png')).toBe('/Users/me/notes/100%.png');
});

test('recognises URL schemes', () => {
  expect(hasUrlScheme('https://example.com')).toBe(true);
  expect(hasUrlScheme('mailto:me@example.com')).toBe(true);
  expect(hasUrlScheme('notes/today.md')).toBe(false);
});

test('builds relative paths between folders', () => {
  expect(relativePath('/Users/me/notes', '/Users/me/notes/images/a.png')).toBe('images/a.png');
  expect(relativePath('/Users/me/notes', '/Users/me/Desktop/shot.png')).toBe('../Desktop/shot.png');
  expect(relativePath('/Users/me/notes', '/Users/me/notes/a.png')).toBe('a.png');
});

test('encodes paths for Markdown links', () => {
  expect(encodeMarkdownPath('images/my shot (1).png')).toBe('images/my%20shot%20%281%29.png');
});
