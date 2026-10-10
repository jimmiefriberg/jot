import { expect, test } from 'bun:test';

import { parseYamlTree } from './yaml-tree';

test('parses YAML maps, lists and scalar types into a tree', () => {
  const { root, problems } = parseYamlTree('# config\nname: deploy\nretries: 3\nenabled: true\nowner:\ntags:\n  - web\n  - api\n');
  expect(problems).toEqual([]);
  expect(root?.kind).toBe('object');
  expect(root?.children.map((child) => [child.key, child.kind, child.value])).toEqual([
    ['name', 'string', 'deploy'],
    ['retries', 'number', 3],
    ['enabled', 'boolean', true],
    ['owner', 'null', null],
    ['tags', 'array', null],
  ]);
  expect(root?.children[4].children.map((child) => child.value)).toEqual(['web', 'api']);
  expect(root?.children[1].offset).toBe(31);
});

test('turns several documents into a list', () => {
  const { root } = parseYamlTree('a: 1\n---\nb: 2\n');
  expect(root?.kind).toBe('array');
  expect(root?.children.map((document) => document.children[0].key)).toEqual(['a', 'b']);
});

test('reports problems with line numbers', () => {
  const { problems } = parseYamlTree('a: 1\nb: [1, 2\nc: 3\n');
  expect(problems.length).toBeGreaterThan(0);
  expect(problems[0].line).toBeGreaterThanOrEqual(2);
});

test('an empty file has no tree', () => {
  expect(parseYamlTree('').root).toBeNull();
});
