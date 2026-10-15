import { expect, test } from 'bun:test';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

import { markdownSyntaxExtensions } from './markdown-syntax';

/** The text of every node with the given name. */
function nodesNamed(doc: string, name: string): string[] {
  const state = EditorState.create({ doc, extensions: markdown({ base: markdownLanguage, extensions: markdownSyntaxExtensions }) });
  const found: string[] = [];
  ensureSyntaxTree(state, doc.length, 5000)?.iterate({
    enter(node) {
      if (node.name === name) found.push(doc.slice(node.from, node.to));
    },
  });
  return found;
}

test('parses ==highlights==', () => {
  expect(nodesNamed('Some ==important== text, not == this ==.', 'Highlight')).toEqual(['==important==']);
});

test('parses inline math but leaves prices alone', () => {
  expect(nodesNamed('Area is $\\pi r^2$ here.', 'InlineMath')).toEqual(['$\\pi r^2$']);
  expect(nodesNamed('It costs $5 and $10 today.', 'InlineMath')).toEqual([]);
  expect(nodesNamed('Use `$x$` literally.', 'InlineMath')).toEqual([]);
});

test('parses display math blocks, multi-line and single-line', () => {
  expect(nodesNamed('Before\n\n$$\na^2 + b^2 = c^2\n$$\n\nAfter', 'BlockMath')).toEqual(['$$\na^2 + b^2 = c^2\n$$']);
  expect(nodesNamed('$$ e = mc^2 $$', 'BlockMath')).toEqual(['$$ e = mc^2 $$']);
});

test('parses footnote references and definitions', () => {
  const doc = 'A claim[^1] and another[^source].\n\n[^1]: The first note.\n[^source]: Where it came from,\n  over two lines.\n\nAfter.';
  expect(nodesNamed(doc, 'FootnoteReference')).toEqual(['[^1]', '[^source]']);
  expect(nodesNamed(doc, 'FootnoteDefinition')).toEqual(['[^1]: The first note.', '[^source]: Where it came from,\n  over two lines.']);
  expect(nodesNamed(doc, 'Link')).toEqual([]);
});
