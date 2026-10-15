import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

import { THEME_APPLIED_EVENT } from '../../settings/apply-theme';

type MermaidModule = typeof import('mermaid');

let mermaidLoading: Promise<MermaidModule> | null = null;
let nextDiagramNumber = 0;
// Mermaid keeps one global configuration, so renders run one at a time, each with the theme of that moment.
let renderQueue: Promise<unknown> = Promise.resolve();

/** Mermaid is large, so it only loads the first time a note shows a diagram. */
function loadMermaid(): Promise<MermaidModule> {
  mermaidLoading ??= import('mermaid');
  return mermaidLoading;
}

function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

/** Mermaid's colours, taken from the app's current theme so diagrams match light, dark and every preset. */
function themeVariables() {
  return {
    darkMode: document.documentElement.dataset.theme === 'dark',
    background: themeColor('background'),
    primaryColor: themeColor('surface'),
    primaryTextColor: themeColor('foreground'),
    primaryBorderColor: themeColor('accent'),
    secondaryColor: themeColor('active-line'),
    tertiaryColor: themeColor('background'),
    lineColor: themeColor('muted-foreground'),
    textColor: themeColor('foreground'),
    noteBkgColor: themeColor('surface'),
    noteTextColor: themeColor('foreground'),
    noteBorderColor: themeColor('border'),
    edgeLabelBackground: themeColor('background'),
    clusterBkg: themeColor('active-line'),
    clusterBorder: themeColor('border'),
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim(),
    fontSize: '14px',
  };
}

async function renderDiagram(source: string): Promise<string> {
  const { default: mermaid } = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVariables() });
  const id = `jot-mermaid-${nextDiagramNumber++}`;
  try {
    const { svg } = await mermaid.render(id, source);
    return svg;
  } finally {
    // A failed render can leave its scratch element behind in the page.
    document.getElementById(`d${id}`)?.remove();
  }
}

/** Renders one diagram after any earlier ones have finished. */
function queueRender(source: string): Promise<string> {
  const render = renderQueue.then(() => renderDiagram(source));
  renderQueue = render.catch(() => undefined);
  return render;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Each diagram's container → how to stop listening for theme changes when the editor drops it.
const stopListeningByContainer = new WeakMap<HTMLElement, () => void>();

/** A ```mermaid code block drawn as its diagram. Clicking it moves the cursor in, which shows the source. */
export class MermaidWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-lp-mermaid is-loading';
    container.textContent = 'Drawing diagram…';
    const source = this.source;

    async function draw() {
      try {
        const svg = await queueRender(source);
        container.className = 'cm-lp-mermaid';
        // The SVG comes from Mermaid with securityLevel "strict", which sanitizes labels.
        container.innerHTML = svg;
      } catch (error) {
        container.className = 'cm-lp-mermaid is-error';
        container.textContent = `Couldn't draw this diagram: ${describeError(error)}`;
      }
      // The diagram is a different size than the placeholder.
      view.requestMeasure();
    }

    // Diagrams take their colours from the theme, so they redraw when it changes.
    function handleThemeApplied() {
      void draw();
    }

    window.addEventListener(THEME_APPLIED_EVENT, handleThemeApplied);
    stopListeningByContainer.set(container, function stopListening() {
      window.removeEventListener(THEME_APPLIED_EVENT, handleThemeApplied);
    });
    void draw();
    return container;
  }

  destroy(dom: HTMLElement): void {
    stopListeningByContainer.get(dom)?.();
    stopListeningByContainer.delete(dom);
  }

  ignoreEvent(): boolean {
    return false;
  }
}
