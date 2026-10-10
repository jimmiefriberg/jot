import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

/** Clickable task checkbox that replaces `[ ]` / `[x]`. Clicking flips the marker in the document. */
export class CheckboxWidget extends WidgetType {
  constructor(private readonly isChecked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.isChecked === this.isChecked;
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cm-lp-checkbox';
    checkbox.checked = this.isChecked;
    checkbox.setAttribute('aria-label', this.isChecked ? 'Mark as not done' : 'Mark as done');
    checkbox.addEventListener('mousedown', function handleCheckboxMouseDown(event) {
      event.preventDefault();
      const markerStart = view.posAtDOM(checkbox);
      const markerCharacter = view.state.sliceDoc(markerStart + 1, markerStart + 2);
      view.dispatch({
        changes: { from: markerStart + 1, to: markerStart + 2, insert: markerCharacter === ' ' ? 'x' : ' ' },
        userEvent: 'input.toggle-task',
      });
    });
    return checkbox;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** Round bullet shown instead of `-`, `*` or `+`. */
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
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
