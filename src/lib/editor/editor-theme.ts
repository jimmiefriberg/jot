import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Decoration, EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

// Every colour is a CSS variable, so switching themes never needs to rebuild the editor.
const editorChrome = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--color-foreground)',
    backgroundColor: 'var(--color-background)',
    fontSize: 'var(--font-size)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-editor)',
    lineHeight: 'var(--line-height)',
  },
  '.cm-content': { padding: '12px 0 40vh', caretColor: 'var(--color-cursor)' },
  '.cm-line': { padding: '0 18px 0 6px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-cursor)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--color-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--color-active-line)' },
  '.cm-selectedText': { backgroundColor: 'var(--color-selection)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-gutter-background)',
    color: 'var(--color-gutter-foreground)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-foreground)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-muted-foreground)',
  },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--color-selection) 55%, transparent)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 45%, transparent)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--color-selection)', outline: 'none' },
  '.cm-panels': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--color-border)' },
  '.cm-panel input, .cm-panel button': { fontSize: '13px' },
  '.cm-textfield': {
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: '5px',
    padding: '3px 6px',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: '5px',
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.45em', fontWeight: '700', color: 'var(--color-heading)' },
  { tag: tags.heading2, fontSize: '1.25em', fontWeight: '700', color: 'var(--color-heading)' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '700', color: 'var(--color-heading)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '700', color: 'var(--color-heading)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-link)' },
  { tag: tags.monospace, color: 'var(--color-string)' },
  { tag: tags.quote, color: 'var(--color-muted-foreground)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--color-accent)' },
  { tag: [tags.propertyName, tags.definition(tags.propertyName), tags.attributeName], color: 'var(--color-property)' },
  { tag: [tags.tagName, tags.typeName], color: 'var(--color-heading)', fontWeight: '600' },
  { tag: tags.attributeValue, color: 'var(--color-string)' },
  { tag: [tags.meta, tags.documentMeta, tags.labelName], color: 'var(--color-accent)' },
  { tag: [tags.angleBracket], color: 'var(--color-punctuation)' },
  { tag: tags.string, color: 'var(--color-string)' },
  { tag: tags.number, color: 'var(--color-number)' },
  { tag: [tags.bool, tags.null, tags.keyword], color: 'var(--color-keyword)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--color-comment)', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.separator, tags.brace, tags.squareBracket], color: 'var(--color-punctuation)' },
  // Code in other languages (Markdown code blocks): functions, classes, constants, regular expressions, diffs.
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: 'var(--color-link)' },
  { tag: [tags.className, tags.definition(tags.typeName), tags.namespace], color: 'var(--color-heading)' },
  { tag: [tags.atom, tags.self, tags.operatorKeyword], color: 'var(--color-keyword)' },
  { tag: [tags.constant(tags.variableName), tags.standard(tags.variableName), tags.regexp, tags.escape, tags.special(tags.string)], color: 'var(--color-number)' },
  { tag: tags.operator, color: 'var(--color-punctuation)' },
  { tag: tags.inserted, color: 'var(--color-string)' },
  { tag: tags.deleted, color: 'var(--color-number)' },
]);

const SELECTED_TEXT = Decoration.mark({ class: 'cm-selectedText' });

// The selection layer sits behind the lines, so line backgrounds (current line, code blocks) hid it; this colours the selected text itself.
const selectedTextBackground = EditorView.decorations.compute(['selection'], (state) =>
  Decoration.set(state.selection.ranges.filter((range) => !range.empty).map((range) => SELECTED_TEXT.range(range.from, range.to))),
);

export const editorTheme = [editorChrome, syntaxHighlighting(highlightStyle), selectedTextBackground];
