import { EditorView } from '@codemirror/view';

import { FILE_KIND, getDirectoryName, getFileExtension } from '../documents/file-kind';
import { useDocumentStore } from '../documents/document-store';
import { encodeMarkdownPath, relativePath } from '../markdown/resolve-path';
import { err, ok } from '../result';
import type { Result } from '../result';
import { saveImageFile, showErrorMessage } from '../tauri/backend';

const IMAGE_FOLDER = 'images';
const MAXIMUM_NAME_ATTEMPTS = 20;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic', 'bmp', 'tif', 'tiff']);
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
};

export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(path));
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** `image-20261010-143005`, so pasted images sort by when they were added. */
function timestampedImageName(date: Date): string {
  const day = `${date.getFullYear()}${padTwoDigits(date.getMonth() + 1)}${padTwoDigits(date.getDate())}`;
  const time = `${padTwoDigits(date.getHours())}${padTwoDigits(date.getMinutes())}${padTwoDigits(date.getSeconds())}`;
  return `image-${day}-${time}`;
}

function imageMarkdown(path: string): string {
  return `![](${encodeMarkdownPath(path)})`;
}

/** Saves a pasted image in an `images` folder next to the note. Returns the path to use in the Markdown link. */
async function savePastedImage(file: File): Promise<Result<string>> {
  const { path } = useDocumentStore.getState();
  if (!path) return err('Save this note first, so the image has a folder to go in.');

  const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? 'png';
  const baseName = timestampedImageName(new Date());
  const bytes = new Uint8Array(await file.arrayBuffer());
  const directory = `${getDirectoryName(path)}/${IMAGE_FOLDER}`;
  let lastError = '';
  // Adds -2, -3… when several images are pasted within the same second.
  for (let attempt = 1; attempt <= MAXIMUM_NAME_ATTEMPTS; attempt++) {
    const fileName = attempt === 1 ? `${baseName}.${extension}` : `${baseName}-${attempt}.${extension}`;
    const result = await saveImageFile(`${directory}/${fileName}`, bytes);
    if (result.isOk) return ok(`${IMAGE_FOLDER}/${fileName}`);
    lastError = result.error;
  }
  return err(lastError);
}

async function pasteImage(view: EditorView, file: File) {
  const result = await savePastedImage(file);
  if (!result.isOk) {
    await showErrorMessage("Couldn't paste the image", result.error);
    return;
  }
  const insert = imageMarkdown(result.value);
  const position = view.state.selection.main.head;
  view.dispatch({ changes: { from: position, insert }, selection: { anchor: position + insert.length }, userEvent: 'input.paste' });
}

/** Pasting an image (a screenshot, say) into a Markdown note saves it next to the note and links it. */
export const markdownImagePaste = EditorView.domEventHandlers({
  paste(event, view) {
    const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
    if (!imageFile) return false;
    event.preventDefault();
    void pasteImage(view, imageFile);
    return true;
  },
});

/**
 * Image files dropped on a Markdown note are linked where they were dropped (relative to the note when it's saved).
 * Returns false when the drop isn't for this, so the files open as documents instead.
 */
export function insertDroppedImages(view: EditorView | null, paths: string[], clientPosition: { x: number; y: number }): boolean {
  const { kind, path: documentPath } = useDocumentStore.getState();
  if (!view || kind !== FILE_KIND.markdown || paths.length === 0 || !paths.every(isImagePath)) return false;

  const documentDirectory = documentPath ? getDirectoryName(documentPath) : null;
  const links = paths.map((imagePath) => imageMarkdown(documentDirectory ? relativePath(documentDirectory, imagePath) : imagePath));
  const position = view.posAtCoords(clientPosition) ?? view.state.selection.main.head;
  const insert = view.state.toText(links.join(view.state.lineBreak));
  view.dispatch({ changes: { from: position, insert }, selection: { anchor: position + insert.length }, userEvent: 'input.drop' });
  view.focus();
  return true;
}
