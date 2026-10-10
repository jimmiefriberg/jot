import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { useDocumentStore } from '../../documents/document-store';
import { useFolderStore } from '../../folders/folder-store';
import { extractOutline } from '../../markdown/outline';
import { isExternalLink, renderMarkdown } from '../../markdown/render-markdown';
import { hasUrlScheme, resolveRelativePath } from '../../markdown/resolve-path';
import { localFileUrl, openExternalLink, openPaths } from '../../tauri/backend';
import type { LivePreviewEnvironment } from './live-preview-decorations';

function resolveImageSource(source: string): string {
  const { path } = useDocumentStore.getState();
  if (hasUrlScheme(source) || !path) return source;
  return localFileUrl(resolveRelativePath(path, source));
}

function renderTable(markdown: string): string {
  return renderMarkdown(markdown, { resolveImageSource });
}

function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

/** Moves the cursor to the heading a `#anchor` link points at. */
function jumpToHeading(anchor: string, view: EditorView) {
  const slug = decodeAnchor(anchor.slice(1)).toLowerCase();
  const heading = extractOutline(view.state.doc.toString()).find((candidate) => candidate.slug === slug);
  if (!heading) return;
  const position = view.state.doc.line(heading.lineIndex + 1).from;
  view.dispatch({ selection: EditorSelection.cursor(position), effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 24 }) });
  view.focus();
}

/** Web and mail links open in the browser, `#heading` links jump within the note, and relative links open files in this app. */
function openLink(url: string, view: EditorView): void {
  const { path } = useDocumentStore.getState();
  if (isExternalLink(url)) {
    void openExternalLink(url);
    return;
  }
  if (url.startsWith('#')) {
    jumpToHeading(url, view);
    return;
  }
  if (hasUrlScheme(url) || !path) return;
  void openPaths([resolveRelativePath(path, url)], useFolderStore.getState().folderPath);
}

/** Connects the live preview to this window's document (for image paths and links). */
export const livePreviewEnvironment: LivePreviewEnvironment = { resolveImageSource, renderTable, openLink };
