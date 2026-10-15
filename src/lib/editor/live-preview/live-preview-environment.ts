import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { useDocumentStore } from '../../documents/document-store';
import { useFolderStore } from '../../folders/folder-store';
import { extractOutline } from '../../markdown/outline';
import { isExternalLink, renderMarkdown } from '../../markdown/render-markdown';
import { hasUrlScheme, resolveRelativePath } from '../../markdown/resolve-path';
import { openFileInThisWindow } from '../../documents/document-actions';
import { localFileUrl, openExternalLink, openPaths } from '../../tauri/backend';
import type { OpenPlacement } from '../../tauri/backend';
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

/** Bare `www.` addresses and email addresses (which GitHub links too) as openable URLs. */
function withScheme(url: string): string {
  if (/^www\./i.test(url)) return `https://${url}`;
  if (!hasUrlScheme(url) && /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(url)) return `mailto:${url}`;
  return url;
}

/**
 * Web and mail links open in the browser, `#heading` links jump within the note, and relative links open the file
 * in this window (or where `placement` says).
 */
function openLink(rawUrl: string, view: EditorView, placement: OpenPlacement | null): void {
  const { path } = useDocumentStore.getState();
  const url = withScheme(rawUrl);
  if (isExternalLink(url)) {
    void openExternalLink(url);
    return;
  }
  if (url.startsWith('#')) {
    jumpToHeading(url, view);
    return;
  }
  if (hasUrlScheme(url) || !path) return;
  const targetPath = resolveRelativePath(path, url);
  if (placement) void openPaths([targetPath], useFolderStore.getState().folderPath, placement);
  else void openFileInThisWindow(targetPath);
}

/** Connects the live preview to this window's document (for image paths and links). */
export const livePreviewEnvironment: LivePreviewEnvironment = { resolveImageSource, renderTable, openLink };
