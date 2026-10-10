import { expect, test } from 'bun:test';

import { parseJsonTree } from '../json/json-tree';
import { dataNodeSearchTexts, findKeyChain, formatDataPath, searchTree } from './tree-search';

const { root } = parseJsonTree('{ "name": "editor", "settings": { "theme": { "light": "paper" } }, "tags": ["Paper", "ink"] }');

test('finds matching keys and values and the containers to expand', () => {
  const result = searchTree(root, 'PAPER', dataNodeSearchTexts);
  expect(result.matchedPaths).toEqual(['$/settings/theme/light', '$/tags/0']);
  expect([...result.ancestorPaths]).toEqual(['$', '$/settings', '$/settings/theme', '$/tags']);
  expect(searchTree(root, '  ', dataNodeSearchTexts).matchedPaths).toEqual([]);
});

test('formats the path to a value the way code would reach it', () => {
  expect(root && findKeyChain(root, '$/settings/theme/light')).toEqual(['settings', 'theme', 'light']);
  expect(formatDataPath(['settings', 'theme', 'light'])).toBe('settings.theme.light');
  expect(formatDataPath(['tags', 0])).toBe('tags[0]');
  expect(formatDataPath([0, 'my key'])).toBe('[0]["my key"]');
});
