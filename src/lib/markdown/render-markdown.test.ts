import { expect, test } from 'bun:test';

import { isExternalLink, renderMarkdown } from './render-markdown';

const environment = { resolveImageSource: (source: string) => `resolved:${source}` };

test('renders GFM tables', () => {
  const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |', environment);
  expect(html).toContain('<table>');
  expect(html).toContain('<td>2</td>');
});

test('escapes raw HTML and resolves image sources', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n![logo](logo.png)', environment);
  expect(html).not.toContain('<script>');
  expect(html).toContain('src="resolved:logo.png"');
});

test('tells external links from file links', () => {
  expect(isExternalLink('https://example.com')).toBe(true);
  expect(isExternalLink('mailto:me@example.com')).toBe(true);
  expect(isExternalLink('notes/todo.md')).toBe(false);
});
