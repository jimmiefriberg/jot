import { expect, test } from 'bun:test';

import { collectContainerPaths } from '../tree/tree-model';
import { formatJson, parseJsonLinesTree, parseJsonTree } from './json-tree';

test('parses JSON with comments and trailing commas into a tree', () => {
  const { root, problems } = parseJsonTree('{\n  // settings\n  "name": "demo",\n  "tags": [1, true, null,],\n}');
  expect(problems).toEqual([]);
  expect(root?.kind).toBe('object');
  expect(root?.children.map((child) => child.key)).toEqual(['name', 'tags']);
  const tags = root?.children[1];
  expect(tags?.children.map((child) => [child.kind, child.value])).toEqual([
    ['number', 1],
    ['boolean', true],
    ['null', null],
  ]);
});

test('reports problems with line and column', () => {
  const { problems } = parseJsonTree('{\n  "a": 1\n  "b": 2\n}');
  expect(problems[0].line).toBe(3);
  expect(problems[0].message).toBe('CommaExpected');
});

test('collects container paths up to a depth', () => {
  const { root } = parseJsonTree('{"a": {"b": {"c": [1]}}}');
  if (!root) throw new Error('expected a tree');
  expect([...collectContainerPaths(root, 1)]).toEqual(['$', '$/a']);
  expect(collectContainerPaths(root).size).toBe(4);
});

test('formats while keeping comments', () => {
  expect(formatJson('{"a":1, // note\n"b":[1,2]}', 2)).toBe('{\n  "a": 1, // note\n  "b": [\n    1,\n    2\n  ]\n}');
});

test('JSON Lines: one item per line, with ranges in the whole file', () => {
  const text = '{"name":"Ada"}\n\n{"name":"Grace","tags":[1]}\n';
  const { root, problems } = parseJsonLinesTree(text);
  expect(problems).toEqual([]);
  expect(root?.children.map((child) => child.key)).toEqual([0, 1]);
  const grace = root?.children[1].children[0];
  expect(grace?.valueRange && text.slice(grace.valueRange.from, grace.valueRange.to)).toBe('"Grace"');
});

test('JSON Lines: a broken line is reported on its own line', () => {
  const { root, problems } = parseJsonLinesTree('{"a":1}\n{"b":}\n');
  expect(root?.children).toHaveLength(2);
  expect(problems[0]?.line).toBe(2);
});
