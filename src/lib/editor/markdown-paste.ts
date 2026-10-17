import { EditorView } from '@codemirror/view';

import { COLUMN_ALIGNMENT, formatTable } from '../markdown/markdown-table';

const PASTED_URL = /^(https?:\/\/|mailto:)\S+$/i;

/** `[selected text](url)` when a lone URL is pasted over a selection on one line, otherwise null. */
export function linkFromPaste(selectedText: string, pastedText: string): string | null {
  const url = pastedText.trim();
  if (selectedText.trim() === '' || selectedText.includes('\n') || !PASTED_URL.test(url)) return null;
  return `[${selectedText}](${url})`;
}

/** Rows of cells as a lined-up Markdown table, or null unless there are at least 2 columns. */
export function markdownTableFromCells(rows: string[][]): string | null {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  if (columnCount < 2) return null;
  // Pipes would end a cell early, and a line break would end the row.
  const cells = rows.map((row) =>
    Array.from({ length: columnCount }, (_, columnIndex) => (row[columnIndex] ?? '').trim().replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')),
  );
  return formatTable({ rows: cells, alignments: cells[0].map(() => COLUMN_ALIGNMENT.none) });
}

/** The cells of the first table in clipboard HTML (from spreadsheets and Jot's CSV table), or null when there's none. */
function cellsFromHtmlTable(html: string): string[][] | null {
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
  if (!table) return null;
  return Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.textContent ?? ''));
}

/** Puts a table on lines of its own, with a blank line between it and any text around the cursor. */
function surroundWithBlankLines(view: EditorView, from: number, to: number, table: string): string {
  const lineBefore = view.state.doc.lineAt(from);
  const lineAfter = view.state.doc.lineAt(to);
  const before = from > lineBefore.from ? '\n\n' : '';
  const after = to < lineAfter.to ? '\n\n' : '';
  return `${before}${table}${after}`;
}

function replaceSelection(view: EditorView, insert: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: 'input.paste', scrollIntoView: true });
}

/**
 * Markdown pastes: cells from Excel, Numbers or Google Sheets become a table, and a URL pasted over selected text
 * makes it a link. Anything else pastes as usual.
 */
export const markdownSmartPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboard = event.clipboardData;
    if (!clipboard || view.state.selection.ranges.length > 1) return false;
    const pastedText = clipboard.getData('text/plain');
    const { from, to } = view.state.selection.main;

    const link = linkFromPaste(view.state.sliceDoc(from, to), pastedText);
    if (link) {
      event.preventDefault();
      replaceSelection(view, link);
      return true;
    }

    // Spreadsheets (and Jot's CSV table) put an HTML table on the clipboard, which tells cells apart from ordinary text.
    const html = clipboard.getData('text/html');
    const htmlCells = html.includes('<table') ? cellsFromHtmlTable(html) : null;
    const table = htmlCells ? markdownTableFromCells(htmlCells) : null;
    if (!table) return false;
    event.preventDefault();
    replaceSelection(view, surroundWithBlankLines(view, from, to, table));
    return true;
  },
});
