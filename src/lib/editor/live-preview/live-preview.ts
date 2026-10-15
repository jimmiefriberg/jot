import { syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState, Prec, RangeSet, StateField, Transaction } from '@codemirror/state';
import type { Extension, Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

import { buildBlockDecorations, buildInlineDecorations, describeActiveBlocks, findRenderedBlocks } from './live-preview-decorations';
import type { LivePreviewEnvironment, RenderedBlock } from './live-preview-decorations';

export type { LivePreviewEnvironment } from './live-preview-decorations';

/** Rendered tables are kept by their Markdown source, so moving the cursor around never re-renders an unchanged table. */
const MAXIMUM_CACHED_TABLES = 200;

interface BlockDecorations {
  decorations: DecorationSet;
  blocks: RenderedBlock[];
  /** Which blocks the cursor was in when the decorations were built. */
  activeBlocksKey: string;
}

function hasTreeChanged(state: EditorState, startState: EditorState): boolean {
  return syntaxTree(state) !== syntaxTree(startState);
}

function isAtomic(range: Range<Decoration>): boolean {
  return range.value.spec.isAtomic === true;
}

function createInlinePlugin(environment: LivePreviewEnvironment) {
  return ViewPlugin.fromClass(
    class InlinePreview {
      decorations: DecorationSet;
      /** List markers and hidden indentation, which the cursor moves over in one step. */
      atomicRanges: DecorationSet;

      constructor(view: EditorView) {
        const ranges = buildInlineDecorations(view.state, environment, view.visibleRanges);
        this.decorations = Decoration.set(ranges, true);
        this.atomicRanges = Decoration.set(ranges.filter(isAtomic), true);
      }

      update(update: ViewUpdate) {
        const shouldRebuild =
          update.docChanged || update.selectionSet || update.viewportChanged || hasTreeChanged(update.state, update.startState);
        if (!shouldRebuild) return;
        const ranges = buildInlineDecorations(update.state, environment, update.view.visibleRanges);
        this.decorations = Decoration.set(ranges, true);
        this.atomicRanges = Decoration.set(ranges.filter(isAtomic), true);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomicRanges ?? RangeSet.empty),
    },
  );
}

function createBlockField(environment: LivePreviewEnvironment) {
  const renderedTables = new Map<string, string>();

  function renderTableOnce(markdown: string): string {
    const cached = renderedTables.get(markdown);
    if (cached !== undefined) return cached;
    if (renderedTables.size >= MAXIMUM_CACHED_TABLES) renderedTables.clear();
    const html = environment.renderTable(markdown);
    renderedTables.set(markdown, html);
    return html;
  }

  const cachingEnvironment: LivePreviewEnvironment = { ...environment, renderTable: renderTableOnce };

  function build(state: EditorState, blocks: RenderedBlock[]): BlockDecorations {
    return {
      decorations: Decoration.set(buildBlockDecorations(state, cachingEnvironment, blocks), true),
      blocks,
      activeBlocksKey: describeActiveBlocks(state, blocks),
    };
  }

  return StateField.define<BlockDecorations>({
    create: (state) => build(state, findRenderedBlocks(state)),
    update(value: BlockDecorations, transaction: Transaction) {
      if (transaction.docChanged || hasTreeChanged(transaction.state, transaction.startState)) {
        return build(transaction.state, findRenderedBlocks(transaction.state));
      }
      if (!transaction.selection) return value;
      // A cursor move only matters when it enters or leaves a table or math block.
      const activeBlocksKey = describeActiveBlocks(transaction.state, value.blocks);
      return activeBlocksKey === value.activeBlocksKey ? value : build(transaction.state, value.blocks);
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Moves the cursor to a footnote's text (from a reference), or back to its first reference (from the footnote). */
function jumpToFootnote(view: EditorView, label: string, isFromDefinition: boolean) {
  const text = view.state.doc.toString();
  const index = isFromDefinition
    ? text.search(new RegExp(`\\[\\^${escapeRegExp(label)}\\](?!:)`))
    : text.search(new RegExp(`^\\[\\^${escapeRegExp(label)}\\]:`, 'm'));
  if (index === -1) return;
  view.dispatch({ selection: EditorSelection.cursor(index), effects: EditorView.scrollIntoView(index, { y: 'center' }) });
  view.focus();
}

/** ⌘-click (Ctrl-click on Linux) opens a link or jumps to a footnote; a plain click just places the cursor. */
function createLinkClickHandler(environment: LivePreviewEnvironment) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.metaKey || event.ctrlKey) || !(event.target instanceof Element)) return false;
      const footnote = event.target.closest<HTMLElement>('[data-footnote]')?.dataset.footnote;
      if (footnote) {
        event.preventDefault();
        jumpToFootnote(view, footnote, false);
        return true;
      }
      const footnoteLabel = event.target.closest('.cm-lp-footnote-label');
      const footnoteLabelText = footnoteLabel && /^\[\^([^\]]+)\]:/.exec(view.state.doc.lineAt(view.posAtDOM(footnoteLabel)).text)?.[1];
      if (footnoteLabelText) {
        event.preventDefault();
        jumpToFootnote(view, footnoteLabelText, true);
        return true;
      }
      const url = event.target.closest<HTMLElement>('[data-url]')?.dataset.url;
      if (!url) return false;
      event.preventDefault();
      environment.openLink(url, view);
      return true;
    },
  });
}

// Edits a reading view still allows: ticking a checkbox, reloading from disk, recovering a draft and the save cleanup.
const READING_VIEW_EDITS = new Set(['input.toggle-task', 'reload', 'input.recover', 'input.save-cleanup']);

/** Drops typing, pasting, undo and edit commands; the view's text only changes for the edits above (or a sync with no user event). */
const blockEditsWhileReading = EditorState.transactionFilter.of((transaction) => {
  const userEvent = transaction.annotation(Transaction.userEvent);
  if (!transaction.docChanged || userEvent === undefined || READING_VIEW_EDITS.has(userEvent)) return transaction;
  return [];
});

/**
 * Read-only Markdown preview: the document stays plain text, but markup is hidden, headings and emphasis are styled,
 * and lists, checkboxes, rules, images, tables, math, footnotes and alerts render in place.
 * Text can still be selected, searched and copied (as Markdown).
 */
export function livePreview(environment: LivePreviewEnvironment): Extension {
  const blockField = createBlockField(environment);
  return [
    createInlinePlugin(environment),
    blockField,
    createLinkClickHandler(environment),
    EditorState.readOnly.of(true),
    blockEditsWhileReading,
    Prec.high(EditorView.contentAttributes.of({ spellcheck: 'false' })),
    EditorView.editorAttributes.of({ class: 'cm-live-preview' }),
  ];
}
