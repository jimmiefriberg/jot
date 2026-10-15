import { expect, test } from 'bun:test';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';

import { markdownSyntaxExtensions } from '../markdown-syntax';
import { buildBlockDecorations, buildInlineDecorations, describeActiveBlocks, findRenderedBlocks } from './live-preview-decorations';
import {
  AlertTitleWidget,
  CheckboxWidget,
  FootnoteReferenceWidget,
  ImageWidget,
  ListMarkerWidget,
  MathWidget,
  TextWidget,
} from './live-preview-widgets';

const environment = {
  resolveImageSource: (source: string) => `resolved:${source}`,
  renderTable: () => '<table></table>',
  openLink: () => {},
};

function createState(text: string, cursor: number) {
  const state = EditorState.create({
    doc: text,
    selection: EditorSelection.cursor(cursor),
    extensions: markdown({ base: markdownLanguage, extensions: markdownSyntaxExtensions }),
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

/** The text each "hide" decoration removes from view. */
function hiddenText(text: string, cursor: number): string[] {
  const state = createState(text, cursor);
  return buildInlineDecorations(state, environment)
    .filter((range) => range.value.spec.class === 'cm-lp-hidden')
    .map((range) => text.slice(range.from, range.to));
}

test('hides heading and emphasis markup away from the cursor, and shows it on the cursor line', () => {
  const text = '# Title\n\nSome **bold** text\n';
  expect(hiddenText(text, text.length)).toEqual(['# ', '**', '**']);
  expect(hiddenText(text, 3)).toEqual(['**', '**']);
  expect(hiddenText(text, 15)).toEqual(['# ']);
});

test('a read-only view keeps markup hidden and tables rendered under the cursor', () => {
  const text = '# Title\n\n| a | b |\n|--|--|\n| 1 | 2 |\n';
  const state = EditorState.create({
    doc: text,
    selection: EditorSelection.cursor(3),
    extensions: [markdown({ base: markdownLanguage, extensions: markdownSyntaxExtensions }), EditorState.readOnly.of(true)],
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const hidden = buildInlineDecorations(state, environment).filter((range) => range.value.spec.class === 'cm-lp-hidden');
  expect(hidden.map((range) => text.slice(range.from, range.to))).toEqual(['# ']);
  const insideTable = state.update({ selection: EditorSelection.cursor(12) }).state;
  expect(buildBlockDecorations(insideTable, environment, findRenderedBlocks(insideTable))).toHaveLength(1);
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
  const decorations = buildInlineDecorations(createState(text, text.length), environment);
  const markers = decorations.filter((range) => range.value.spec.widget instanceof ListMarkerWidget);
  expect(markers.map((range) => text.slice(range.from, range.to))).toEqual(['- [ ] ', '- [x] ']);
  expect(markers.map((range) => range.value.spec.widget)).toEqual([new ListMarkerWidget('task', '', false), new ListMarkerWidget('task', '', true)]);
  expect(decorations.some((range) => range.value.spec.class === 'cm-lp-task-done')).toBe(true);
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
  expect(buildBlockDecorations(outside, environment, findRenderedBlocks(outside))).toHaveLength(1);
  expect(buildBlockDecorations(inside, environment, findRenderedBlocks(inside))).toHaveLength(0);
});

test('finds tables, math and diagrams and tells which one the cursor is in', () => {
  const text = 'intro\n\n> | a |\n> | - |\n> | 1 |\n\n$$\nx^2\n$$\n\n```math\ny\n```\n\n```mermaid\ngraph TD; A-->B\n```\n\n```js\nz\n```\n';
  const state = createState(text, text.indexOf('x^2'));
  const blocks = findRenderedBlocks(state);
  expect(blocks.map((block) => block.kind)).toEqual(['table', 'math', 'math', 'mermaid']);
  expect(describeActiveBlocks(state, blocks)).toBe(String(blocks[1].from));
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

/** The widgets the inline decorations put in, in document order. */
function widgetsOf(text: string, cursor: number) {
  return buildInlineDecorations(createState(text, cursor), environment)
    .map((range) => range.value.spec.widget)
    .filter((widget) => widget !== undefined);
}

test('draws list markers with a hanging indent, including tasks with nothing typed yet', () => {
  const text = '- bullet\n  - nested\n\n3. ordered\n\n- [ ]\n\nend';
  expect(widgetsOf(text, text.length)).toEqual([
    new ListMarkerWidget('bullet', '•'),
    new ListMarkerWidget('bullet', '◦'),
    new ListMarkerWidget('ordered', '3.'),
    new ListMarkerWidget('task', '', false),
  ]);
  const listLines = buildInlineDecorations(createState(text, text.length), environment).filter(
    (range) => range.value.spec.class === 'cm-lp-list-item',
  );
  expect(listLines.map((range) => range.value.spec.attributes.style)).toEqual(['--lp-depth: 0', '--lp-depth: 1', '--lp-depth: 0', '--lp-depth: 0']);
});

test('keeps checkboxes inside quotes', () => {
  expect(widgetsOf('> - [x] quoted task\n\nend', 20)).toContainEqual(new CheckboxWidget(true));
});

test('renders GitHub alerts with a title', () => {
  const text = '> [!WARNING]\n> Careful.\n\nend';
  expect(widgetsOf(text, text.length)).toEqual([new AlertTitleWidget('warning')]);
  const lineClasses = buildInlineDecorations(createState(text, text.length), environment).map((range) => range.value.spec.class);
  expect(lineClasses).toContain('cm-lp-alert cm-lp-alert-warning cm-lp-alert-first');
  expect(lineClasses).toContain('cm-lp-alert cm-lp-alert-warning cm-lp-alert-last');
});

test('numbers footnotes in reference order and shows emoji and math', () => {
  const text = 'See[^b] and[^a] :tada: $x^2$ but $5 and $10.\n\n[^a]: A.\n[^b]: B.\n\nend';
  expect(widgetsOf(text, text.length)).toEqual([
    new FootnoteReferenceWidget('b', 1),
    new FootnoteReferenceWidget('a', 2),
    new TextWidget('🎉', 'cm-lp-emoji'),
    new MathWidget('x^2', false),
    new TextWidget('2.', 'cm-lp-footnote-label'),
    new TextWidget('1.', 'cm-lp-footnote-label'),
  ]);
});

test('shows front matter as a block instead of headings', () => {
  const text = '---\ntitle: Notes\n---\n\n# Real';
  const decorations = buildInlineDecorations(createState(text, text.length), environment);
  const classes = decorations.map((range) => range.value.spec.class).filter(Boolean);
  expect(classes.filter((className: string) => className.includes('cm-lp-h'))).toEqual(['cm-lp-heading cm-lp-h1']);
  expect(classes.filter((className: string) => className.startsWith('cm-lp-frontmatter'))).toHaveLength(3);
});
