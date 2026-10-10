export interface TextRange {
  from: number;
  to: number;
}

/** One edit to the document text: replace `from`–`to` with `insert`. */
export interface TextChange extends TextRange {
  insert: string;
}

/** Turns CRLF and lone CR line breaks into LF, the form every view works with. */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * The smallest single change that turns `previousText` into `nextText`: everything both share at the start
 * and the end is left alone. Null when the texts are equal.
 */
export function createMinimalChange(previousText: string, nextText: string): TextChange | null {
  if (previousText === nextText) return null;

  const shortestLength = Math.min(previousText.length, nextText.length);
  let prefixLength = 0;
  while (prefixLength < shortestLength && previousText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)) {
    prefixLength++;
  }

  let suffixLength = 0;
  const maximumSuffixLength = shortestLength - prefixLength;
  while (
    suffixLength < maximumSuffixLength &&
    previousText.charCodeAt(previousText.length - 1 - suffixLength) === nextText.charCodeAt(nextText.length - 1 - suffixLength)
  ) {
    suffixLength++;
  }

  return {
    from: prefixLength,
    to: previousText.length - suffixLength,
    insert: nextText.slice(prefixLength, nextText.length - suffixLength),
  };
}
