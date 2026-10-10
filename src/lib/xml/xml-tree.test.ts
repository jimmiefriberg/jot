import { expect, test } from 'bun:test';

import { decodeEntities, parseXmlTree } from './xml-tree';

test('builds an element tree with attributes, text and comments', () => {
  const source = '<?xml version="1.0"?>\n<!-- c -->\n<project name="demo" note=\'a &amp; b\'>\n  <dependency id="tauri">Tauri &lt;2&gt;</dependency>\n  <empty/>\n</project>\n';
  const { root, problems } = parseXmlTree(source);
  expect(problems).toEqual([]);
  expect(root?.children.map((node) => node.kind)).toEqual(['instruction', 'comment', 'element']);

  const project = root?.children[2];
  expect(project?.name).toBe('project');
  expect(project?.attributes).toMatchObject([
    { name: 'name', value: 'demo', quote: '"' },
    { name: 'note', value: 'a & b', quote: "'" },
  ]);
  expect(project?.children.map((node) => node.name)).toEqual(['dependency', 'empty']);
  expect(project?.children[0].children).toMatchObject([{ kind: 'text', text: 'Tauri <2>' }]);
  expect(project?.children[1].children).toEqual([]);
  expect(source.slice(project?.offset)).toStartWith('<project');
});

test('reports a missing closing tag', () => {
  const { problems } = parseXmlTree('<a>\n  <b>\n</a>');
  expect(problems.map((problem) => problem.message)).toContain('Missing closing tag for <b>');
});

test('decodes entities', () => {
  expect(decodeEntities('&lt;&#65;&#x42;&unknown;')).toBe('<AB&unknown;');
});
