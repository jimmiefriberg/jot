import MarkdownIt from 'markdown-it';

export interface MarkdownRenderEnvironment {
  /** Turns an image `src` from the document into a URL the view can load. */
  resolveImageSource: (source: string) => string;
}

// Set for the duration of one synchronous render, so the image rule can resolve paths for the current document.
let resolveCurrentImageSource = keepSource;

function keepSource(source: string) {
  return source;
}

function createRenderer() {
  const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });
  const defaultImageRule = markdown.renderer.rules.image;
  markdown.renderer.rules.image = function renderImage(tokens, index, options, environment, self) {
    const token = tokens[index];
    const source = token.attrGet('src');
    if (source !== null) token.attrSet('src', resolveCurrentImageSource(String(source)));
    if (defaultImageRule) return defaultImageRule(tokens, index, options, environment, self);
    return self.renderToken(tokens, index, options);
  };
  return markdown;
}

const renderer = createRenderer();

/** Renders Markdown to HTML (used for tables in the live preview). Raw HTML in the document is escaped, not rendered. */
export function renderMarkdown(text: string, environment: MarkdownRenderEnvironment): string {
  resolveCurrentImageSource = environment.resolveImageSource;
  return renderer.render(text);
}

/** Whether a link points somewhere outside the document (web, mail), as opposed to an anchor or a file. */
export function isExternalLink(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}
