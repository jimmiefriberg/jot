import { syntaxTree } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import type { EditorState, Extension, Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

import { buildInlineDecorations, buildTableDecorations, describeActiveTables, findTables } from './live-preview-decorations';
import type { DocumentRange, LivePreviewEnvironment } from './live-preview-decorations';

export type { LivePreviewEnvironment } from './live-preview-decorations';

/** Rendered tables are kept by their Markdown source, so moving the cursor around never re-renders an unchanged table. */
const MAXIMUM_CACHED_TABLES = 200;

interface TableDecorations {
  decorations: DecorationSet;
  tables: DocumentRange[];
  /** Which tables the cursor was in when the decorations were built. */
  activeTablesKey: string;
}

function hasTreeChanged(state: EditorState, startState: EditorState): boolean {
  return syntaxTree(state) !== syntaxTree(startState);
}

function createInlinePlugin(environment: LivePreviewEnvironment) {
  function build(view: EditorView): DecorationSet {
    return Decoration.set(buildInlineDecorations(view.state, environment, view.visibleRanges), true);
  }

  return ViewPlugin.fromClass(
    class InlinePreview {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        const shouldRebuild =
          update.docChanged || update.selectionSet || update.viewportChanged || hasTreeChanged(update.state, update.startState);
        if (shouldRebuild) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function createTableField(environment: LivePreviewEnvironment) {
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

  function build(state: EditorState, tables: DocumentRange[]): TableDecorations {
    return {
      decorations: Decoration.set(buildTableDecorations(state, cachingEnvironment, tables), true),
      tables,
      activeTablesKey: describeActiveTables(state, tables),
    };
  }

  return StateField.define<TableDecorations>({
    create: (state) => build(state, findTables(state)),
    update(value: TableDecorations, transaction: Transaction) {
      if (transaction.docChanged || hasTreeChanged(transaction.state, transaction.startState)) {
        return build(transaction.state, findTables(transaction.state));
      }
      if (!transaction.selection) return value;
      // A cursor move only matters when it enters or leaves a table.
      const activeTablesKey = describeActiveTables(transaction.state, value.tables);
      return activeTablesKey === value.activeTablesKey ? value : build(transaction.state, value.tables);
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
}

/** ⌘-click (Ctrl-click on Linux) opens a link; a plain click just places the cursor, so links stay editable. */
function createLinkClickHandler(environment: LivePreviewEnvironment) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.metaKey || event.ctrlKey) || !(event.target instanceof Element)) return false;
      const url = event.target.closest<HTMLElement>('[data-url]')?.dataset.url;
      if (!url) return false;
      event.preventDefault();
      environment.openLink(url, view);
      return true;
    },
  });
}

/**
 * Editable Markdown preview: the document stays plain text, but markup is hidden outside the line being edited,
 * headings and emphasis are styled, and checkboxes, bullets, rules, images and tables render in place.
 */
export function livePreview(environment: LivePreviewEnvironment): Extension {
  return [
    createInlinePlugin(environment),
    createTableField(environment),
    createLinkClickHandler(environment),
    EditorView.editorAttributes.of({ class: 'cm-live-preview' }),
  ];
}
