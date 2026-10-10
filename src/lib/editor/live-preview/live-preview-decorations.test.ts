import { expect, test } from 'bun:test';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';

import { buildInlineDecorations, buildTableDecorations, describeActiveTables, findTables } from './live-preview-decorations';
import { CheckboxWidget, ImageWidget } from './live-preview-widgets';

const environment = {
  resolveImageSource: (source: string) => `resolved:${source}`,
  renderTable: () => '<table></table>',
  openLink: () => {},
};

function createState(text: string, cursor: number) {
  const state = EditorState.create({
    doc: text,
    selection: EditorSelection.cursor(cursor),
    extensions: markdown({ base: markdownLanguage }),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

/** The text each "hide" decoration removes from view. */
function hiddenText(text: string, cursor: number): string[] {
  const state = createState(text, cursor);
  return buildInlineDecorations(state, environment)
    .filter((range) => range.from !== range.to && range.value.spec.widget === undefined && range.value.spec.class === undefined)
    .map((range) => text.slice(range.from, range.to));
}

test('hides heading and emphasis markup away from the cursor, and shows it on the cursor line', () => {
  const text = '# Title\n\nSome **bold** text\n';
  expect(hiddenText(text, text.length)).toEqual(['# ', '**', '**']);
  expect(hiddenText(text, 3)).toEqual(['**', '**']);
  expect(hiddenText(text, 15)).toEqual(['# ']);
});

test('shows link text only, keeping the URL for ⌘-click', () => {
  const text = 'See [the docs](https://example.com) now\n\n';
  const state = createState(text, text.length);
  const decorations = buildInlineDecorations(state, environment);
  const linkMark = decorations.find((range) => range.value.spec.class === 'cm-lp-link');
  expect(text.slice(linkMark?.from, linkMark?.to)).toBe('the docs');
  expect(linkMark?.value.spec.attributes).toEqual({ 'data-url': 'https://example.com' });
  expect(hiddenText(text, text.length)).toEqual(['[', '](https://example.com)']);
});

test('renders task markers as checkboxes and marks done items', () => {
  const text = '- [ ] buy milk\n- [x] call mum\n\nend';
  const state = createState(text, text.length);
  const decorations = buildInlineDecorations(state, environment);
  const checkboxes = decorations.filter((range) => range.value.spec.widget instanceof CheckboxWidget);
  expect(checkboxes.map((range) => text.slice(range.from, range.to))).toEqual(['[ ]', '[x]']);
  expect(decorations.some((range) => range.value.spec.class === 'cm-lp-task-done')).toBe(true);
  expect(hiddenText(text, text.length)).toEqual(['- ', '- ']);
});

test('replaces images with a widget using the resolved source', () => {
  const text = '![logo](logo.png)\n\nnext';
  const image = buildInlineDecorations(createState(text, text.length), environment).find(
    (range) => range.value.spec.widget instanceof ImageWidget,
  );
  expect(image?.value.spec.widget).toEqual(new ImageWidget('resolved:logo.png', 'logo'));
});

test('renders tables unless the cursor is inside them', () => {
  const text = '| a | b |\n| - | - |\n| 1 | 2 |\n\nafter';
  const outside = createState(text, text.length);
  const inside = createState(text, 2);
  expect(buildTableDecorations(outside, environment, findTables(outside))).toHaveLength(1);
  expect(buildTableDecorations(inside, environment, findTables(inside))).toHaveLength(0);
});

test('finds tables inside quotes and tells which one the cursor is in', () => {
  const text = 'intro\n\n> | a |\n> | - |\n> | 1 |\n\n| b |\n| - |\n| 2 |\n';
  const state = createState(text, text.indexOf('| b'));
  const tables = findTables(state);
  expect(tables).toHaveLength(2);
  expect(describeActiveTables(state, tables)).toBe(String(tables[1].from));
});

test('typing Markdown syntax applies the formatting right away', () => {
  const before = createState('Plan\n\nnext', 0);
  const typed = before.update({ changes: { from: 0, insert: '## ' }, selection: EditorSelection.cursor(3) }).state;
  ensureSyntaxTree(typed, typed.doc.length, 5000);
  const headingLine = buildInlineDecorations(typed, environment).find((range) => range.value.spec.class?.includes('cm-lp-h2'));
  expect(headingLine?.from).toBe(0);
  // The marks stay visible while the cursor is on the line, and hide once it moves away.
  expect(hiddenText(typed.doc.toString(), 3)).toEqual([]);
  expect(hiddenText(typed.doc.toString(), typed.doc.length)).toEqual(['## ']);
});

test('hides code fences unless the cursor is inside the block', () => {
  const text = 'intro\n\n```js\nlet a = 1\n```\n\nend';
  expect(hiddenText(text, text.length)).toEqual(['```js', '```']);
  expect(hiddenText(text, text.indexOf('let'))).toEqual([]);
});
