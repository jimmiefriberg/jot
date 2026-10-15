import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

import { ALERT_TITLES } from '../../markdown/markdown-features';
import type { AlertKind } from '../../markdown/markdown-features';

const COPIED_FEEDBACK_MS = 1200;

/** Flips the task marker (`[ ]` ⇄ `[x]`) on the line where a widget sits. */
function toggleTaskAt(view: EditorView, element: HTMLElement) {
  const widgetStart = view.posAtDOM(element);
  const line = view.state.doc.lineAt(widgetStart);
  const bracketIndex = line.text.indexOf('[', widgetStart - line.from);
  if (bracketIndex === -1) return;
  const markerPosition = line.from + bracketIndex + 1;
  const markerCharacter = view.state.sliceDoc(markerPosition, markerPosition + 1);
  view.dispatch({
    changes: { from: markerPosition, to: markerPosition + 1, insert: markerCharacter === ' ' ? 'x' : ' ' },
    userEvent: 'input.toggle-task',
  });
}

function createCheckbox(view: EditorView, isChecked: boolean): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'cm-lp-checkbox';
  checkbox.checked = isChecked;
  checkbox.setAttribute('aria-label', isChecked ? 'Mark as not done' : 'Mark as done');
  checkbox.addEventListener('mousedown', function handleCheckboxMouseDown(event) {
    event.preventDefault();
    toggleTaskAt(view, checkbox);
  });
  return checkbox;
}

/** Clickable task checkbox that replaces `[ ]` / `[x]` (used inside quotes, where list markers stay as written). */
export class CheckboxWidget extends WidgetType {
  constructor(private readonly isChecked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.isChecked === this.isChecked;
  }

  toDOM(view: EditorView): HTMLElement {
    return createCheckbox(view, this.isChecked);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export const LIST_MARKER_KIND = { bullet: 'bullet', ordered: 'ordered', task: 'task' } as const;
export type ListMarkerKind = (typeof LIST_MARKER_KIND)[keyof typeof LIST_MARKER_KIND];

/**
 * The marker at the start of a list item: a bullet, a number or a checkbox. It has a fixed width, so the item's
 * text (and its wrapped lines) line up, however deep the list is.
 */
export class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly kind: ListMarkerKind,
    private readonly label: string,
    private readonly isChecked = false,
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return other.kind === this.kind && other.label === this.label && other.isChecked === this.isChecked;
  }

  toDOM(view: EditorView): HTMLElement {
    const marker = document.createElement('span');
    marker.className = `cm-lp-list-marker is-${this.kind}`;
    if (this.kind === LIST_MARKER_KIND.task) marker.append(createCheckbox(view, this.isChecked));
    else marker.textContent = this.label;
    return marker;
  }

  ignoreEvent(): boolean {
    return this.kind === LIST_MARKER_KIND.task;
  }
}

/** Round bullet shown instead of `-`, `*` or `+` (inside quotes). */
export class BulletWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement('span');
    bullet.className = 'cm-lp-bullet';
    bullet.textContent = '•';
    return bullet;
  }
}

export class HorizontalRuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const rule = document.createElement('span');
    rule.className = 'cm-lp-rule';
    return rule;
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly alternativeText: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.source === this.source && other.alternativeText === this.alternativeText;
  }

  toDOM(): HTMLElement {
    const image = document.createElement('img');
    image.className = 'cm-lp-image';
    image.src = this.source;
    image.alt = this.alternativeText;
    return image;
  }

  // Let clicks through so the editor puts the cursor here, which reveals the Markdown.
  ignoreEvent(): boolean {
    return false;
  }
}

/** A rendered Markdown table. Clicking it moves the cursor inside, which shows the source for editing. */
const MINIMUM_COLUMN_WIDTH = 48;
// Widths dragged by hand, by the table's HTML, so they survive the table scrolling out of view and back.
// shortcut: widths reset when the table's text changes and aren't saved with the file; key by position if that matters.
const resizedColumnWidths = new Map<string, number[]>();

function applyColumnWidths(table: HTMLTableElement, headerCells: HTMLElement[], widths: number[]) {
  table.style.tableLayout = 'fixed';
  table.style.width = `${widths.reduce((total, width) => total + width, 0)}px`;
  headerCells.forEach((cell, index) => {
    cell.style.width = `${widths[index]}px`;
  });
}

/** Adds a drag handle to the right edge of each header cell. Double-clicking a handle goes back to automatic widths. */
function makeColumnsResizable(table: HTMLTableElement, key: string) {
  const headerCells = Array.from(table.querySelectorAll<HTMLElement>('thead th'));
  const savedWidths = resizedColumnWidths.get(key);
  if (savedWidths?.length === headerCells.length) applyColumnWidths(table, headerCells, savedWidths);

  headerCells.forEach((cell, columnIndex) => {
    const handle = document.createElement('span');
    handle.className = 'cm-lp-column-resizer';
    handle.setAttribute('aria-hidden', 'true');

    function handlePointerDown(event: PointerEvent) {
      // Stops the editor from starting a text selection.
      event.preventDefault();
      event.stopPropagation();
      const widths = resizedColumnWidths.get(key) ?? headerCells.map((headerCell) => headerCell.offsetWidth);
      const startX = event.clientX;
      const startWidth = widths[columnIndex];
      handle.setPointerCapture(event.pointerId);

      function handlePointerMove(moveEvent: PointerEvent) {
        widths[columnIndex] = Math.max(MINIMUM_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
        applyColumnWidths(table, headerCells, widths);
      }

      function handlePointerUp() {
        handle.removeEventListener('pointermove', handlePointerMove);
        handle.removeEventListener('pointerup', handlePointerUp);
        resizedColumnWidths.set(key, widths);
      }

      handle.addEventListener('pointermove', handlePointerMove);
      handle.addEventListener('pointerup', handlePointerUp);
    }

    function handleDoubleClick(event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      resizedColumnWidths.delete(key);
      table.style.removeProperty('table-layout');
      table.style.removeProperty('width');
      for (const headerCell of headerCells) headerCell.style.removeProperty('width');
    }

    handle.addEventListener('pointerdown', handlePointerDown);
    handle.addEventListener('mousedown', stopEvent);
    handle.addEventListener('dblclick', handleDoubleClick);
    cell.append(handle);
  });
}

function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

export class TableWidget extends WidgetType {
  constructor(private readonly html: string) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.html === this.html;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-lp-table';
    // The HTML comes from markdown-it with raw HTML disabled, so document content is escaped.
    container.innerHTML = this.html;
    const table = container.querySelector('table');
    if (table) makeColumnsResizable(table, this.html);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** A short piece of text shown in place of markup, like an emoji for `:tada:`. */
export class TextWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string,
  ) {
    super();
  }

  eq(other: TextWidget): boolean {
    return other.text === this.text && other.className === this.className;
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span');
    element.className = this.className;
    element.textContent = this.text;
    return element;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** A footnote reference, shown as its number in superscript. ⌘-click jumps to the footnote. */
export class FootnoteReferenceWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly number: number,
  ) {
    super();
  }

  eq(other: FootnoteReferenceWidget): boolean {
    return other.label === this.label && other.number === this.number;
  }

  toDOM(): HTMLElement {
    const reference = document.createElement('sup');
    reference.className = 'cm-lp-footnote-ref';
    reference.dataset.footnote = this.label;
    reference.textContent = String(this.number);
    return reference;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// Small line icons for alerts, drawn in a 16×16 box like the app's other icons.
const ALERT_ICON_PATHS: Record<AlertKind, string> = {
  note: 'M8 14.25A6.25 6.25 0 1 0 8 1.75a6.25 6.25 0 0 0 0 12.5ZM8 7.25v4M8 4.75h.01',
  tip: 'M6 12.25h4M6.75 14.25h2.5M8 1.75a4.25 4.25 0 0 0-2.5 7.7c.4.3.75.85.75 1.55v.25h3.5V11c0-.7.35-1.25.75-1.55A4.25 4.25 0 0 0 8 1.75Z',
  important: 'M2.25 3.25c0-.55.45-1 1-1h9.5c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H8l-3.25 2.5v-2.5h-1.5c-.55 0-1-.45-1-1v-7ZM8 4.5v3M8 9.25h.01',
  warning: 'M7.13 2.25a1 1 0 0 1 1.74 0l5.4 9.5a1 1 0 0 1-.87 1.5H2.6a1 1 0 0 1-.87-1.5l5.4-9.5ZM8 6v3M8 11h.01',
  caution: 'M5.5 1.75h5l3.75 3.75v5l-3.75 3.75h-5L1.75 10.5v-5L5.5 1.75ZM8 5v3.5M8 10.75h.01',
};

/** The title row of a GitHub alert (`> [!NOTE]` shows as an icon and "Note"). */
export class AlertTitleWidget extends WidgetType {
  constructor(private readonly kind: AlertKind) {
    super();
  }

  eq(other: AlertTitleWidget): boolean {
    return other.kind === this.kind;
  }

  toDOM(): HTMLElement {
    const title = document.createElement('span');
    title.className = 'cm-lp-alert-title';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ALERT_ICON_PATHS[this.kind]);
    icon.append(path);
    title.append(icon, ALERT_TITLES[this.kind]);
    return title;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** The language name and a copy button in the corner of a code block. */
export class CodeBlockToolbarWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly code: string,
  ) {
    super();
  }

  eq(other: CodeBlockToolbarWidget): boolean {
    return other.language === this.language && other.code === this.code;
  }

  toDOM(): HTMLElement {
    const toolbar = document.createElement('span');
    toolbar.className = 'cm-lp-code-toolbar';
    if (this.language) {
      const language = document.createElement('span');
      language.className = 'cm-lp-code-language';
      language.textContent = this.language;
      toolbar.append(language);
    }
    const copyButton = document.createElement('button');
    copyButton.className = 'cm-lp-code-copy';
    copyButton.textContent = 'Copy';
    const code = this.code;
    copyButton.addEventListener('mousedown', function handleCopyMouseDown(event) {
      event.preventDefault();
      event.stopPropagation();
      void copyCode(copyButton, code);
    });
    toolbar.append(copyButton);
    return toolbar;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

async function copyCode(button: HTMLButtonElement, code: string) {
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
    setTimeout(function resetCopyLabel() {
      button.textContent = 'Copy';
    }, COPIED_FEEDBACK_MS);
  } catch {
    // The clipboard can refuse access; the code can still be selected and copied by hand.
  }
}

type KatexModule = typeof import('katex');
let katexLoading: Promise<KatexModule> | null = null;

/** KaTeX (and its stylesheet and fonts) only load the first time a note shows math. */
function loadKatex(): Promise<KatexModule> {
  katexLoading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([katex]) => katex);
  return katexLoading;
}

/** Math rendered with KaTeX: inline for `$…$`, as a centred block for `$$…$$` and ```math blocks. */
export class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly isDisplay: boolean,
  ) {
    super();
  }

  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.isDisplay === this.isDisplay;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement(this.isDisplay ? 'div' : 'span');
    container.className = this.isDisplay ? 'cm-lp-math-block' : 'cm-lp-math';
    container.textContent = this.tex;
    void this.render(container, view);
    return container;
  }

  private async render(container: HTMLElement, view: EditorView) {
    try {
      const { default: katex } = await loadKatex();
      katex.render(this.tex, container, { displayMode: this.isDisplay, throwOnError: false });
    } catch {
      container.classList.add('is-unrendered');
    }
    // The rendered math is a different size than the placeholder text.
    view.requestMeasure();
  }

  ignoreEvent(): boolean {
    return false;
  }
}
