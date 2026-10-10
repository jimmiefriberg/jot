import { getDirectoryName } from '../documents/file-kind';

/** Whether a link or image source points at something with its own scheme (web, mail, data) rather than a file. */
export function hasUrlScheme(reference: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(reference);
}

/** Decodes `%20`-style escapes, leaving the text as it is when it isn't valid encoding (like "100%.png"). */
function decodeReference(reference: string): string {
  try {
    return decodeURI(reference);
  } catch {
    return reference;
  }
}

/** Resolves a relative reference (like `../images/a.png`) against the folder of the document at `documentPath`. */
export function resolveRelativePath(documentPath: string, reference: string): string {
  const cleanReference = decodeReference(reference.split(/[?#]/)[0]);
  if (cleanReference.startsWith('/')) return cleanReference;

  const segments = getDirectoryName(documentPath).split('/');
  for (const segment of cleanReference.split('/')) {
    if (segment === '..') segments.pop();
    else if (segment !== '.' && segment !== '') segments.push(segment);
  }
  return segments.join('/');
}

/** The path to `targetPath` as seen from `fromDirectory`, like `../images/a.png`. */
export function relativePath(fromDirectory: string, targetPath: string): string {
  const fromSegments = fromDirectory.split('/').filter(Boolean);
  const targetSegments = targetPath.split('/').filter(Boolean);
  let sharedCount = 0;
  while (
    sharedCount < fromSegments.length &&
    sharedCount < targetSegments.length - 1 &&
    fromSegments[sharedCount] === targetSegments[sharedCount]
  ) {
    sharedCount++;
  }
  const upSegments = new Array<string>(fromSegments.length - sharedCount).fill('..');
  return [...upSegments, ...targetSegments.slice(sharedCount)].join('/');
}

/** Encodes a path for use in a Markdown link (spaces and other unsafe characters), keeping the slashes. */
export function encodeMarkdownPath(path: string): string {
  return encodeURI(path).replaceAll('(', '%28').replaceAll(')', '%29');
}
