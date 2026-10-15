import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { SyntaxNode, Tree } from '@lezer/common';

import type { OpenPlacement } from '../../tauri/backend';

import { emojiForShortcode, findFrontMatter, readAlertKind } from '../../markdown/markdown-features';
import {
  AlertTitleWidget,
  BulletWidget,
  CheckboxWidget,
  CodeBlockToolbarWidget,
  FootnoteReferenceWidget,
  HorizontalRuleWidget,
  ImageWidget,
  LIST_MARKER_KIND,
  ListMarkerWidget,
  MathWidget,
  TableWidget,
  TextWidget,
} from './live-preview-widgets';
import { MermaidWidget } from './mermaid-widget';

export interface LivePreviewEnvironment {
  /** Turns an image source from the document into a URL the editor can load. */
  resolveImageSource: (source: string) => string;
  /** Renders a Markdown table to HTML. */
  renderTable: (markdown: string) => string;
  /** Opens a clicked link: here (null), or in a new tab, window or pane. */
  openLink: (url: string, view: EditorView, placement: OpenPlacement | null) => void;
}

export interface DocumentRange {
  from: number;
  to: number;
}

/** A block rendered as a widget while the cursor is outside it: a table, display math or a Mermaid diagram. */
export interface RenderedBlock extends DocumentRange {
  kind: 'table' | 'math' | 'mermaid';
}

/** Code fences drawn as something else when the cursor is outside them, as on GitHub. */
const RENDERED_FENCES: Record<string, RenderedBlock['kind']> = { math: 'math', mermaid: 'mermaid' };

// Markup is hidden by shrinking it to nothing rather than replacing it: replaced ranges get invisible marker elements
// around them, and the browser treats those as places to wrap a line (so a "." could end up alone on the next line).
// The cursor never sits inside hidden markup, because markup the cursor touches is shown.
const HIDDEN = Decoration.mark({ class: 'cm-lp-hidden' });
// Markup at a line's start is removed from layout instead: a zero-size start leaves ↑ nothing to measure, so it skipped the line.
const HIDDEN_LINE_START = Decoration.replace({ class: 'cm-lp-hidden' });
// List markers and the indentation before them are atomic: the cursor steps over them in one go.
const HIDDEN_INDENTATION = Decoration.replace({ isAtomic: true });
const BULLET_CHARACTERS = new Set(['-', '*', '+']);
// Bullets change with depth, like GitHub: • then ◦ then ▪.
const BULLETS_BY_DEPTH = ['•', '◦', '▪'];
const LIST_CONTAINERS = new Set(['BulletList', 'OrderedList']);
const EMPTY_TASK = /^\[([ xX])\]\s*$/;
// Nodes whose lines are code, so blank lines in them keep their full height.
const CODE_NODES = new Set(['FencedCode', 'CodeBlock', 'BlockMath', 'HTMLBlock', 'CommentBlock']);
// Inline HTML that renders as formatting, like on GitHub: `<kbd>⌘K</kbd>`, `H<sub>2</sub>O`.
const FORMATTING_TAG = /<(kbd|sup|sub|mark|u|ins|del|s|b|strong|i|em)>([^<\n]+?)<\/\1>/gi;

const INLINE_STYLES: Record<string, { className: string; markName: string }> = {
  Emphasis: { className: 'cm-lp-em', markName: 'EmphasisMark' },
  StrongEmphasis: { className: 'cm-lp-strong', markName: 'EmphasisMark' },
  Strikethrough: { className: 'cm-lp-strike', markName: 'StrikethroughMark' },
  // GitHub shows `~single tildes~` as strikethrough too.
  Subscript: { className: 'cm-lp-strike', markName: 'SubscriptMark' },
  Superscript: { className: 'cm-lp-sup', markName: 'SuperscriptMark' },
  Highlight: { className: 'cm-lp-highlight', markName: 'HighlightMark' },
  InlineCode: { className: 'cm-lp-code', markName: 'CodeMark' },
};

/** Facts about the whole document that single decorations need: footnote numbers, link targets, front matter. */
interface DocumentFacts {
  footnoteNumbers: Map<string, number>;
  linkDefinitions: Map<string, string>;
  frontMatter: DocumentRange | null;
}

// Worked out once per syntax tree, not once per cursor move.
const documentFactsCache = new WeakMap<Tree, DocumentFacts>();

function normalizeLinkLabel(label: string): string {
  return label.replace(/^\[|\]$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getDocumentFacts(state: EditorState): DocumentFacts {
  const tree = syntaxTree(state);
  const cached = documentFactsCache.get(tree);
  if (cached) return cached;

  const footnoteNumbers = new Map<string, number>();
  const linkDefinitions = new Map<string, string>();
  tree.iterate({
    enter(nodeReference) {
      if (nodeReference.name === 'FootnoteReference') {
        const label = state.sliceDoc(nodeReference.from + 2, nodeReference.to - 1);
        // Footnotes are numbered in the order they're first referenced, as on GitHub.
        if (!footnoteNumbers.has(label)) footnoteNumbers.set(label, footnoteNumbers.size + 1);
        return false;
      }
      if (nodeReference.name === 'LinkReference') {
        const { node } = nodeReference;
        const label = node.getChild('LinkLabel');
        const url = node.getChild('URL');
        if (label && url) linkDefinitions.set(normalizeLinkLabel(state.sliceDoc(label.from, label.to)), state.sliceDoc(url.from, url.to));
        return false;
      }
      return CODE_NODES.has(nodeReference.name) ? false : undefined;
    },
  });
  const facts = { footnoteNumbers, linkDefinitions, frontMatter: findFrontMatter(state.sliceDoc(0, Math.min(state.doc.length, 50_000))) };
  documentFactsCache.set(tree, facts);
  return facts;
}

/** Which parts of the document the cursor is in. Markup there stays visible so it can be edited; a read-only view shows none. */
class SelectionContext {
  private readonly activeLines = new Set<number>();

  constructor(private readonly state: EditorState) {
    if (state.readOnly) return;
    for (const range of state.selection.ranges) {
      const firstLine = state.doc.lineAt(range.from).number;
      const lastLine = state.doc.lineAt(range.to).number;
      for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) this.activeLines.add(lineNumber);
    }
  }

  isLineActive(position: number): boolean {
    return this.activeLines.has(this.state.doc.lineAt(position).number);
  }

  touches(from: number, to: number): boolean {
    if (this.state.readOnly) return false;
    return this.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
  }
}

function lineClass(className: string, attributes?: Record<string, string>) {
  return Decoration.line({ class: className, attributes });
}

function eachLine(state: EditorState, node: { from: number; to: number }, callback: (lineStart: number, lineIndex: number) => void) {
  const firstLine = state.doc.lineAt(node.from).number;
  const lastLine = state.doc.lineAt(node.to).number;
  for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
    callback(state.doc.line(lineNumber).from, lineNumber - firstLine);
  }
}

/** Hides a range plus one space after it (for `# `, `> `, `- `), never across a line break. */
function hideWithTrailingSpace(state: EditorState, from: number, to: number): Range<Decoration> | null {
  const end = state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to;
  if (state.sliceDoc(from, end).includes('\n') || from === end) return null;
  return hiddenRange(state, from, end);
}

function hide(state: EditorState, from: number, to: number): Range<Decoration> | null {
  if (from >= to || state.sliceDoc(from, to).includes('\n')) return null;
  return hiddenRange(state, from, to);
}

function hiddenRange(state: EditorState, from: number, to: number): Range<Decoration> {
  const isAtLineStart = state.doc.lineAt(from).from === from;
  return (isAtLineStart ? HIDDEN_LINE_START : HIDDEN).range(from, to);
}

function textOf(state: EditorState, node: SyntaxNode | null): string {
  return node ? state.sliceDoc(node.from, node.to) : '';
}

function isInside(node: SyntaxNode, name: string): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.name === name) return true;
  return false;
}

/** How deeply a list item is nested: 0 for a top-level item. */
function listDepth(node: SyntaxNode): number {
  let depth = -1;
  for (let parent = node.parent; parent; parent = parent.parent) if (LIST_CONTAINERS.has(parent.name)) depth++;
  return Math.max(depth, 0);
}

/** End of the run of spaces starting at `from` (at most to the end of the line). */
function skipSpaces(state: EditorState, from: number, lineEnd: number): number {
  let position = from;
  while (position < lineEnd && state.sliceDoc(position, position + 1) === ' ') position++;
  return position;
}

/**
 * Inline live-preview decorations: hides Markdown markup outside the cursor's line or span, styles what it marks,
 * and swaps in widgets for list markers, checkboxes, rules, images, emoji, math and footnotes.
 */
export function buildInlineDecorations(
  state: EditorState,
  environment: LivePreviewEnvironment,
  ranges: readonly DocumentRange[] = [{ from: 0, to: state.doc.length }],
): Range<Decoration>[] {
  const selection = new SelectionContext(state);
  const facts = getDocumentFacts(state);
  const decorations: Range<Decoration>[] = [];
  const codeRanges: DocumentRange[] = [];

  function add(decoration: Range<Decoration> | null) {
    if (decoration) decorations.push(decoration);
  }

  /**
   * Code blocks: the ``` fence lines collapse into the block's rounded top and bottom edges (with the language and
   * a copy button in the corner), and show again when the cursor is inside the block.
   */
  function decorateFencedCode(node: SyntaxNode) {
    const isActive = selection.touches(node.from, node.to);
    const [openingMark, closingMark] = node.getChildren('CodeMark');
    const fenceLines = new Map<number, string>();
    if (openingMark) fenceLines.set(state.doc.lineAt(openingMark.from).number, 'cm-lp-fence-open');
    if (closingMark) fenceLines.set(state.doc.lineAt(closingMark.from).number, 'cm-lp-fence-close');

    const codeText = node.getChild('CodeText');
    if (!isActive && codeText) {
      const language = textOf(state, node.getChild('CodeInfo'));
      const firstCodeLine = state.doc.lineAt(codeText.from);
      add(Decoration.widget({ widget: new CodeBlockToolbarWidget(language, textOf(state, codeText)), side: -1 }).range(firstCodeLine.from));
    }

    eachLine(state, node, (lineStart) => {
      const line = state.doc.lineAt(lineStart);
      const fenceClass = fenceLines.get(line.number);
      if (!fenceClass) {
        add(lineClass('cm-lp-codeblock').range(lineStart));
        return;
      }
      if (isActive) {
        add(lineClass('cm-lp-codeblock cm-lp-fence').range(lineStart));
        return;
      }
      add(lineClass(`cm-lp-codeblock cm-lp-fence-hidden ${fenceClass}`).range(lineStart));
      add(hide(state, line.from, line.to));
    });
  }

  /** `- [ ]` with nothing after it yet is still a task; the parser only sees one once there is text. */
  function findEmptyTask(listItem: SyntaxNode): { from: number; to: number } | null {
    const paragraph = listItem.getChild('Paragraph');
    if (!paragraph || !EMPTY_TASK.test(textOf(state, paragraph))) return null;
    return { from: paragraph.from, to: paragraph.from + 3 };
  }

  /**
   * List items get a fixed-width marker (bullet, number or checkbox) and a hanging indent, so wrapped lines
   * line up with the text, like a rendered document. Markers stay rendered while editing; ⌫ at the start of the
   * text removes them.
   */
  function decorateListItem(node: SyntaxNode) {
    const mark = node.getChild('ListMark');
    if (!mark) return;
    const line = state.doc.lineAt(mark.from);
    if (state.sliceDoc(line.from, mark.from).trim() !== '') return;

    const depth = listDepth(node);
    const taskMarker = node.getChild('Task')?.getChild('TaskMarker') ?? findEmptyTask(node);
    const markText = textOf(state, mark);
    let contentStart = skipSpaces(state, mark.to, line.to);
    let widget: ListMarkerWidget;
    if (taskMarker) {
      const isChecked = /x/i.test(state.sliceDoc(taskMarker.from, taskMarker.to));
      contentStart = skipSpaces(state, taskMarker.to, line.to);
      widget = new ListMarkerWidget(LIST_MARKER_KIND.task, '', isChecked);
      if (isChecked) add(lineClass('cm-lp-task-done').range(line.from));
    } else if (BULLET_CHARACTERS.has(markText)) {
      widget = new ListMarkerWidget(LIST_MARKER_KIND.bullet, BULLETS_BY_DEPTH[depth % BULLETS_BY_DEPTH.length]);
    } else {
      widget = new ListMarkerWidget(LIST_MARKER_KIND.ordered, markText);
    }

    const depthStyle = { style: `--lp-depth: ${depth}` };
    add(Decoration.replace({ widget, isAtomic: true }).range(line.from, contentStart));
    add(lineClass('cm-lp-list-item', depthStyle).range(line.from));

    // Further lines of the item's paragraphs line up under its text.
    for (const paragraph of node.getChildren('Paragraph')) {
      eachLine(state, paragraph, (lineStart) => {
        if (lineStart === line.from) return;
        const continuationLine = state.doc.lineAt(lineStart);
        add(lineClass('cm-lp-list-continuation', depthStyle).range(lineStart));
        const textStart = skipSpaces(state, lineStart, continuationLine.to);
        if (textStart > lineStart) add(HIDDEN_INDENTATION.range(lineStart, textStart));
      });
    }
  }

  /** Lists inside quotes keep their written indentation; only the marker itself is drawn. */
  function decorateQuotedListMark(node: SyntaxNode) {
    const isBullet = BULLET_CHARACTERS.has(textOf(state, node));
    const isTask = node.parent?.getChild('Task') !== null;
    if (!isBullet || selection.isLineActive(node.from)) return;
    if (isTask) add(hideWithTrailingSpace(state, node.from, node.to));
    else add(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
  }

  /** Quotes, and GitHub alerts: a quote starting with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`. */
  function decorateBlockquote(node: SyntaxNode) {
    const firstLine = state.doc.lineAt(node.from);
    const alertKind = readAlertKind(firstLine.text);
    if (!alertKind) {
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-quote').range(lineStart)));
      return;
    }
    const lastLineIndex = state.doc.lineAt(node.to).number - firstLine.number;
    eachLine(state, node, (lineStart, lineIndex) => {
      const edgeClasses = `${lineIndex === 0 ? ' cm-lp-alert-first' : ''}${lineIndex === lastLineIndex ? ' cm-lp-alert-last' : ''}`;
      add(lineClass(`cm-lp-alert cm-lp-alert-${alertKind}${edgeClasses}`).range(lineStart));
    });
    if (!selection.isLineActive(firstLine.from)) {
      add(Decoration.replace({ widget: new AlertTitleWidget(alertKind) }).range(firstLine.from, firstLine.to));
    }
  }

  /** The address a link points at: its own URL, or the `[label]: url` definition it refers to. */
  function linkTarget(node: SyntaxNode): string {
    const url = node.getChild('URL');
    if (url) return textOf(state, url);
    const label = node.getChild('LinkLabel');
    const [openBracket, closeBracket] = node.getChildren('LinkMark');
    const reference = label ? textOf(state, label) : openBracket && closeBracket ? state.sliceDoc(openBracket.to, closeBracket.from) : '';
    return facts.linkDefinitions.get(normalizeLinkLabel(reference)) ?? '';
  }

  function decorateNode(node: SyntaxNode): boolean | void {
    const { name, from, to } = node;
    // Front matter is shown as a plain block (see the line pass below), never as headings or rules.
    if (facts.frontMatter && from < facts.frontMatter.to && name !== 'Document') return false;

    const headingLevel = /^ATXHeading(\d)$/.exec(name)?.[1] ?? /^SetextHeading(\d)$/.exec(name)?.[1];
    if (headingLevel) {
      add(lineClass(`cm-lp-heading cm-lp-h${headingLevel}`).range(state.doc.lineAt(from).from));
      if (selection.isLineActive(from)) return;
      for (const mark of node.getChildren('HeaderMark')) {
        const isOpeningMark = mark.from === state.doc.lineAt(mark.from).from;
        add(isOpeningMark ? hideWithTrailingSpace(state, mark.from, mark.to) : hide(state, mark.from - 1, mark.to));
      }
      return;
    }

    const inlineStyle = INLINE_STYLES[name];
    if (inlineStyle) {
      add(Decoration.mark({ class: inlineStyle.className }).range(from, to));
      if (!selection.touches(from, to)) {
        for (const mark of node.getChildren(inlineStyle.markName)) add(hide(state, mark.from, mark.to));
      }
      return name === 'InlineCode' ? false : undefined;
    }

    if (name === 'Link') {
      const [openBracket, closeBracket] = node.getChildren('LinkMark');
      if (!openBracket || !closeBracket) return false;
      add(Decoration.mark({ class: 'cm-lp-link', attributes: { 'data-url': linkTarget(node) } }).range(openBracket.to, closeBracket.from));
      if (!selection.touches(from, to)) {
        add(hide(state, from, openBracket.to));
        add(hide(state, closeBracket.from, to));
      }
      return false;
    }

    if (name === 'Autolink') {
      if (!selection.touches(from, to)) for (const mark of node.getChildren('LinkMark')) add(hide(state, mark.from, mark.to));
      return;
    }

    if (name === 'URL' && node.parent?.name !== 'Link' && node.parent?.name !== 'Image' && node.parent?.name !== 'LinkReference') {
      add(Decoration.mark({ class: 'cm-lp-link', attributes: { 'data-url': textOf(state, node) } }).range(from, to));
      return false;
    }

    if (name === 'Image') {
      const source = textOf(state, node.getChild('URL'));
      if (!source || selection.touches(from, to) || state.sliceDoc(from, to).includes('\n')) return false;
      const [altStart, altEnd] = node.getChildren('LinkMark');
      const alternativeText = altStart && altEnd ? state.sliceDoc(altStart.to, altEnd.from) : '';
      add(Decoration.replace({ widget: new ImageWidget(environment.resolveImageSource(source), alternativeText) }).range(from, to));
      return false;
    }

    if (name === 'LinkReference') {
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-link-definition').range(lineStart)));
      return false;
    }

    if (name === 'Emoji') {
      const emoji = emojiForShortcode(state.sliceDoc(from + 1, to - 1));
      if (emoji && !selection.touches(from, to)) add(Decoration.replace({ widget: new TextWidget(emoji, 'cm-lp-emoji') }).range(from, to));
      return false;
    }

    if (name === 'Escape') {
      if (!selection.touches(from, to)) add(hide(state, from, from + 1));
      return false;
    }

    if (name === 'InlineMath') {
      if (selection.touches(from, to)) add(Decoration.mark({ class: 'cm-lp-math-source' }).range(from, to));
      else add(Decoration.replace({ widget: new MathWidget(state.sliceDoc(from + 1, to - 1), false) }).range(from, to));
      return false;
    }

    if (name === 'FootnoteReference') {
      const label = state.sliceDoc(from + 2, to - 1);
      const number = facts.footnoteNumbers.get(label) ?? 0;
      if (selection.touches(from, to)) add(Decoration.mark({ class: 'cm-lp-footnote-source', attributes: { 'data-footnote': label } }).range(from, to));
      else add(Decoration.replace({ widget: new FootnoteReferenceWidget(label, number) }).range(from, to));
      return false;
    }

    if (name === 'FootnoteDefinition') {
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-footnote-definition').range(lineStart)));
      const label = node.getChild('FootnoteLabel');
      if (label && !selection.isLineActive(label.from)) {
        const labelText = state.sliceDoc(label.from + 2, label.to - 2);
        const number = facts.footnoteNumbers.get(labelText);
        const widget = new TextWidget(number ? `${number}.` : `${labelText}.`, 'cm-lp-footnote-label');
        add(Decoration.replace({ widget }).range(label.from, skipSpaces(state, label.to, state.doc.lineAt(label.to).to)));
      }
      return;
    }

    if (name === 'ListItem') {
      if (!isInside(node, 'Blockquote')) decorateListItem(node);
      return;
    }

    if (name === 'ListMark') {
      if (isInside(node, 'Blockquote')) decorateQuotedListMark(node);
      return;
    }

    if (name === 'TaskMarker') {
      // Outside quotes, the list item draws its own checkbox.
      if (!isInside(node, 'Blockquote')) return;
      const isChecked = /x/i.test(textOf(state, node));
      if (isChecked) add(lineClass('cm-lp-task-done').range(state.doc.lineAt(from).from));
      if (!selection.touches(from, to)) add(Decoration.replace({ widget: new CheckboxWidget(isChecked) }).range(from, to));
      return;
    }

    if (name === 'Blockquote') {
      decorateBlockquote(node);
      return;
    }

    if (name === 'QuoteMark') {
      // An alert's `> [!NOTE]` line is replaced whole by its title (see decorateBlockquote).
      const isAlertTitleLine = readAlertKind(state.doc.lineAt(from).text) !== null;
      if (!selection.isLineActive(from) && !isAlertTitleLine) add(hideWithTrailingSpace(state, from, to));
      return;
    }

    if (name === 'CodeBlock') {
      codeRanges.push({ from, to });
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-codeblock').range(lineStart)));
      return false;
    }

    if (name === 'FencedCode') {
      codeRanges.push({ from, to });
      decorateFencedCode(node);
      return false;
    }

    if (name === 'BlockMath') {
      // Rendered as a block widget (see buildBlockDecorations); while editing, show the source in monospace.
      codeRanges.push({ from, to });
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-math-source-line').range(lineStart)));
      return false;
    }

    if (name === 'HTMLBlock' || name === 'CommentBlock') {
      codeRanges.push({ from, to });
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-html-block').range(lineStart)));
      return false;
    }

    if (name === 'Comment' || name === 'HTMLTag') {
      add(Decoration.mark({ class: name === 'Comment' ? 'cm-lp-comment' : 'cm-lp-html-tag' }).range(from, to));
      return false;
    }

    if (name === 'HorizontalRule') {
      if (!selection.isLineActive(from)) add(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(from, to));
      return false;
    }

    if (name === 'Table') {
      // Tables render as a block widget (see buildBlockDecorations); while editing, show the source in monospace.
      if (selection.touches(from, to)) eachLine(state, node, (lineStart) => add(lineClass('cm-lp-table-source').range(lineStart)));
      return false;
    }
  }

  function isInCode(position: number): boolean {
    return codeRanges.some((range) => position >= range.from && position <= range.to);
  }

  /** `<kbd>`, `<sup>`, `<mark>`… pairs on one line render as formatting, with the tags hidden. */
  function decorateFormattingTags(lineStart: number, lineText: string) {
    for (const match of lineText.matchAll(FORMATTING_TAG)) {
      const from = lineStart + (match.index ?? 0);
      const to = from + match[0].length;
      const tagName = match[1].toLowerCase();
      const openTagEnd = from + tagName.length + 2;
      const closeTagStart = to - tagName.length - 3;
      add(Decoration.mark({ class: `cm-lp-tag-${tagName}` }).range(openTagEnd, closeTagStart));
      if (!selection.touches(from, to)) {
        add(HIDDEN.range(from, openTagEnd));
        add(HIDDEN.range(closeTagStart, to));
      }
    }
  }

  /** Per-line styling: front matter, blank lines (shorter, for calmer spacing) and inline HTML formatting. */
  function decorateLines(range: DocumentRange) {
    const { frontMatter } = facts;
    let position = range.from;
    while (position <= range.to) {
      const line = state.doc.lineAt(position);
      if (frontMatter && line.from < frontMatter.to) {
        const isFirst = line.from === 0;
        const isLast = line.to >= frontMatter.to;
        add(lineClass(`cm-lp-frontmatter${isFirst ? ' cm-lp-frontmatter-first' : ''}${isLast ? ' cm-lp-frontmatter-last' : ''}`).range(line.from));
      } else if (!isInCode(line.from)) {
        if (line.text.trim() === '') add(lineClass('cm-lp-blank').range(line.from));
        else if (line.text.includes('<')) decorateFormattingTags(line.from, line.text);
      }
      position = line.to + 1;
    }
  }

  function handleEnter(nodeReference: { node: SyntaxNode }) {
    return decorateNode(nodeReference.node);
  }

  const tree = syntaxTree(state);
  for (const range of ranges) tree.iterate({ from: range.from, to: range.to, enter: handleEnter });
  for (const range of ranges) decorateLines(range);
  return decorations;
}

// Tables and math are blocks, and blocks only nest inside these; everything else can be skipped when looking for them.
const BLOCK_CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

/** Every table, display-math block and Mermaid diagram in the document (```math fences count as math, as on GitHub). */
export function findRenderedBlocks(state: EditorState): RenderedBlock[] {
  const blocks: RenderedBlock[] = [];
  const frontMatter = getDocumentFacts(state).frontMatter;
  syntaxTree(state).iterate({
    enter(nodeReference) {
      const { name, from, to, node } = nodeReference;
      if (frontMatter && from < frontMatter.to && name !== 'Document') return false;
      if (name === 'Table') blocks.push({ kind: 'table', from, to });
      if (name === 'BlockMath') blocks.push({ kind: 'math', from, to });
      const fenceKind = name === 'FencedCode' ? RENDERED_FENCES[textOf(state, node.getChild('CodeInfo')).toLowerCase()] : undefined;
      if (fenceKind) blocks.push({ kind: fenceKind, from, to });
      return BLOCK_CONTAINERS.has(name);
    },
  });
  return blocks;
}

/** The blocks the cursor is in, as a short key, so a cursor move only re-renders when it enters or leaves one. */
export function describeActiveBlocks(state: EditorState, blocks: DocumentRange[]): string {
  const selection = new SelectionContext(state);
  return blocks
    .filter((block) => selection.touches(block.from, block.to))
    .map((block) => block.from)
    .join(',');
}

/** What's inside a block: the TeX between `$$` marks, or the lines between a fence's ``` lines. */
function blockSource(state: EditorState, block: RenderedBlock): string {
  const source = state.sliceDoc(block.from, block.to);
  if (source.startsWith('$$')) return source.replace(/^\$\$/, '').replace(/\$\$\s*$/, '').trim();
  return source.split('\n').slice(1, -1).join('\n').trim();
}

function createBlockWidget(state: EditorState, environment: LivePreviewEnvironment, block: RenderedBlock) {
  if (block.kind === 'table') return new TableWidget(environment.renderTable(state.sliceDoc(block.from, block.to)));
  if (block.kind === 'mermaid') return new MermaidWidget(blockSource(state, block));
  return new MathWidget(blockSource(state, block), true);
}

/** Block decorations that render each table, math block and diagram the cursor isn't in. Block widgets need a state field. */
export function buildBlockDecorations(state: EditorState, environment: LivePreviewEnvironment, blocks: RenderedBlock[]): Range<Decoration>[] {
  const selection = new SelectionContext(state);
  return blocks
    .filter((block) => !selection.touches(block.from, block.to))
    .map((block) => Decoration.replace({ widget: createBlockWidget(state, environment, block), block: true }).range(block.from, block.to));
}
