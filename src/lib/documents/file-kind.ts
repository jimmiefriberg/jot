export const FILE_KIND = {
  text: 'text',
  markdown: 'markdown',
  json: 'json',
  csv: 'csv',
  yaml: 'yaml',
  xml: 'xml',
} as const;

export type FileKind = (typeof FILE_KIND)[keyof typeof FILE_KIND];

/** Kinds that have a formatted (rendered) view in addition to the plain editor. */
export type FormattableKind = Exclude<FileKind, typeof FILE_KIND.text>;

export const VIEW_MODE = {
  formatted: 'formatted',
  plain: 'plain',
  /** Markdown only: the plain editor with the formatted view beside it. */
  sideBySide: 'sideBySide',
} as const;

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE];

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  md: FILE_KIND.markdown,
  markdown: FILE_KIND.markdown,
  mdown: FILE_KIND.markdown,
  json: FILE_KIND.json,
  jsonc: FILE_KIND.json,
  json5: FILE_KIND.json,
  'code-workspace': FILE_KIND.json,
  csv: FILE_KIND.csv,
  tsv: FILE_KIND.csv,
  yml: FILE_KIND.yaml,
  yaml: FILE_KIND.yaml,
  xml: FILE_KIND.xml,
  plist: FILE_KIND.xml,
  svg: FILE_KIND.xml,
  xsd: FILE_KIND.xml,
  xsl: FILE_KIND.xml,
  xslt: FILE_KIND.xml,
};

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  text: 'Plain Text',
  markdown: 'Markdown',
  json: 'JSON',
  csv: 'CSV',
  yaml: 'YAML',
  xml: 'XML',
};

export const FILE_KINDS: FileKind[] = Object.values(FILE_KIND);

export function isFileKind(value: unknown): value is FileKind {
  return FILE_KINDS.some((kind) => kind === value);
}

/** Returns the file name (last path segment) of a path, or "Untitled" when there is none. */
export function getFileName(path: string | null): string {
  if (!path) return 'Untitled';
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] || 'Untitled';
}

/** Returns the folder that contains the file, without a trailing separator. */
export function getDirectoryName(path: string): string {
  const lastSeparatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSeparatorIndex <= 0 ? path.slice(0, lastSeparatorIndex + 1) : path.slice(0, lastSeparatorIndex);
}

/** The lower-case extension without the dot ("md"), or "" when the name has none. */
export function getFileExtension(path: string | null): string {
  const fileName = getFileName(path).toLowerCase();
  const extensionStart = fileName.lastIndexOf('.');
  return extensionStart <= 0 ? '' : fileName.slice(extensionStart + 1);
}

/** Detects which kind of document a path is, based on its extension. Untitled and unknown files are plain text. */
export function detectFileKind(path: string | null): FileKind {
  return KIND_BY_EXTENSION[getFileExtension(path)] ?? FILE_KIND.text;
}

/** Whether the formatted view is a separate component (tree, table) rather than the editor's Markdown live preview. */
export function hasSeparateFormattedView(kind: FileKind): boolean {
  return hasFormattedView(kind) && kind !== FILE_KIND.markdown;
}

/** Whether a kind has a formatted (rendered) view in addition to the plain editor. */
export function hasFormattedView(kind: FileKind): kind is FormattableKind {
  return kind !== FILE_KIND.text;
}

/** Whether a kind can be shown in a view mode: plain text is only plain, and only Markdown has side by side. */
export function canShowViewMode(kind: FileKind, viewMode: ViewMode): boolean {
  if (viewMode === VIEW_MODE.plain) return true;
  if (viewMode === VIEW_MODE.sideBySide) return kind === FILE_KIND.markdown;
  return hasFormattedView(kind);
}
