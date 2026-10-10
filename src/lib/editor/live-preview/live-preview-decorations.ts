import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

import { BulletWidget, CheckboxWidget, HorizontalRuleWidget, ImageWidget, TableWidget } from './live-preview-widgets';

export interface LivePreviewEnvironment {
  /** Turns an image source from the document into a URL the editor can load. */
  resolveImageSource: (source: string) => string;
  /** Renders a Markdown table to HTML. */
  renderTable: (markdown: string) => string;
  /** Opens a link that was ⌘-clicked. */
  openLink: (url: string, view: EditorView) => void;
}

export interface DocumentRange {
  from: number;
  to: number;
}

const HIDDEN = Decoration.replace({});
const BULLET_CHARACTERS = new Set(['-', '*', '+']);

const INLINE_STYLES: Record<string, { className: string; markName: string }> = {
  Emphasis: { className: 'cm-lp-em', markName: 'EmphasisMark' },
  StrongEmphasis: { className: 'cm-lp-strong', markName: 'EmphasisMark' },
  Strikethrough: { className: 'cm-lp-strike', markName: 'StrikethroughMark' },
  InlineCode: { className: 'cm-lp-code', markName: 'CodeMark' },
};

/** Which parts of the document the cursor is in. Markup there stays visible so it can be edited. */
class SelectionContext {
  private readonly activeLines = new Set<number>();

  constructor(private readonly state: EditorState) {
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
    return this.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
  }
}

function lineClass(className: string) {
  return Decoration.line({ class: className });
}

function eachLine(state: EditorState, node: SyntaxNode, callback: (lineStart: number, lineIndex: number, lineCount: number) => void) {
  const firstLine = state.doc.lineAt(node.from).number;
  const lastLine = state.doc.lineAt(node.to).number;
  for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
    callback(state.doc.line(lineNumber).from, lineNumber - firstLine, lastLine - firstLine + 1);
  }
}

/** Hides a range plus one space after it (for `# `, `> `, `- `), never across a line break. */
function hideWithTrailingSpace(state: EditorState, from: number, to: number): Range<Decoration> | null {
  const end = state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to;
  if (state.sliceDoc(from, end).includes('\n') || from === end) return null;
  return HIDDEN.range(from, end);
}

function hide(state: EditorState, from: number, to: number): Range<Decoration> | null {
  if (from >= to || state.sliceDoc(from, to).includes('\n')) return null;
  return HIDDEN.range(from, to);
}

function textOf(state: EditorState, node: SyntaxNode | null): string {
  return node ? state.sliceDoc(node.from, node.to) : '';
}

/**
 * Inline live-preview decorations: hides Markdown markup outside the cursor's line or span, styles what it marks,
 * and swaps in widgets for checkboxes, bullets, rules and images.
 */
export function buildInlineDecorations(
  state: EditorState,
  environment: LivePreviewEnvironment,
  ranges: readonly DocumentRange[] = [{ from: 0, to: state.doc.length }],
): Range<Decoration>[] {
  const selection = new SelectionContext(state);
  const decorations: Range<Decoration>[] = [];

  function add(decoration: Range<Decoration> | null) {
    if (decoration) decorations.push(decoration);
  }

  /**
   * Code blocks: the ``` fence lines collapse into the block's rounded top and bottom edges,
   * and show again when the cursor is inside the block.
   */
  function decorateFencedCode(node: SyntaxNode) {
    const isActive = selection.touches(node.from, node.to);
    const [openingMark, closingMark] = node.getChildren('CodeMark');
    const fenceLines = new Map<number, string>();
    if (openingMark) fenceLines.set(state.doc.lineAt(openingMark.from).number, 'cm-lp-fence-open');
    if (closingMark) fenceLines.set(state.doc.lineAt(closingMark.from).number, 'cm-lp-fence-close');

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

  function decorateNode(node: SyntaxNode): boolean | void {
    const { name, from, to } = node;
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
      const url = textOf(state, node.getChild('URL'));
      if (!openBracket || !closeBracket) return false;
      add(Decoration.mark({ class: 'cm-lp-link', attributes: { 'data-url': url } }).range(openBracket.to, closeBracket.from));
      if (!selection.touches(from, to)) {
        add(hide(state, from, openBracket.to));
        add(hide(state, closeBracket.from, to));
      }
      return false;
    }

    if (name === 'URL' && node.parent?.name !== 'Link' && node.parent?.name !== 'Image') {
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

    if (name === 'ListMark') {
      const isBullet = BULLET_CHARACTERS.has(textOf(state, node));
      const isTask = node.parent?.getChild('Task') !== null;
      if (!isBullet || selection.isLineActive(from)) return;
      if (isTask) add(hideWithTrailingSpace(state, from, to));
      else add(Decoration.replace({ widget: new BulletWidget() }).range(from, to));
      return;
    }

    if (name === 'TaskMarker') {
      const isChecked = /x/i.test(textOf(state, node));
      if (isChecked) add(lineClass('cm-lp-task-done').range(state.doc.lineAt(from).from));
      if (!selection.touches(from, to)) add(Decoration.replace({ widget: new CheckboxWidget(isChecked) }).range(from, to));
      return;
    }

    if (name === 'Blockquote') {
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-quote').range(lineStart)));
      return;
    }

    if (name === 'QuoteMark') {
      if (!selection.isLineActive(from)) add(hideWithTrailingSpace(state, from, to));
      return;
    }

    if (name === 'CodeBlock') {
      eachLine(state, node, (lineStart) => add(lineClass('cm-lp-codeblock').range(lineStart)));
      return false;
    }

    if (name === 'FencedCode') {
      decorateFencedCode(node);
      return false;
    }

    if (name === 'HorizontalRule') {
      if (!selection.isLineActive(from)) add(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(from, to));
      return false;
    }

    if (name === 'Table') {
      // Tables render as a block widget (see buildTableDecorations); while editing, show the source in monospace.
      if (selection.touches(from, to)) eachLine(state, node, (lineStart) => add(lineClass('cm-lp-table-source').range(lineStart)));
      return false;
    }
  }

  function handleEnter(nodeReference: { node: SyntaxNode }) {
    return decorateNode(nodeReference.node);
  }

  const tree = syntaxTree(state);
  for (const range of ranges) tree.iterate({ from: range.from, to: range.to, enter: handleEnter });
  return decorations;
}

// Tables are blocks, and blocks only nest inside these; everything else can be skipped when looking for tables.
const TABLE_CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

/** Every table in the document. */
export function findTables(state: EditorState): DocumentRange[] {
  const tables: DocumentRange[] = [];
  syntaxTree(state).iterate({
    enter(nodeReference) {
      if (nodeReference.name === 'Table') {
        tables.push({ from: nodeReference.from, to: nodeReference.to });
        return false;
      }
      return TABLE_CONTAINERS.has(nodeReference.name);
    },
  });
  return tables;
}

/** The tables the cursor is in, as a short key, so a cursor move only re-renders when it enters or leaves one. */
export function describeActiveTables(state: EditorState, tables: DocumentRange[]): string {
  const selection = new SelectionContext(state);
  return tables
    .filter((table) => selection.touches(table.from, table.to))
    .map((table) => table.from)
    .join(',');
}

/** Block decorations that render each table the cursor isn't in. Kept separate because block widgets need a state field. */
export function buildTableDecorations(state: EditorState, environment: LivePreviewEnvironment, tables: DocumentRange[]): Range<Decoration>[] {
  const selection = new SelectionContext(state);
  return tables
    .filter((table) => !selection.touches(table.from, table.to))
    .map((table) => {
      const widget = new TableWidget(environment.renderTable(state.sliceDoc(table.from, table.to)));
      return Decoration.replace({ widget, block: true }).range(table.from, table.to);
    });
}
