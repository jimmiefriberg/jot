import type { TextChange } from './text-change';

const TRAILING_WHITESPACE = /[ \t]+$/;
// In Markdown, two or more spaces at the end of a line with text on it is a hard line break.
const MARKDOWN_LINE_BREAK = /\S {2,}$/;

/** Removals for the spaces and tabs at the end of each line. Markdown hard line breaks can be kept. */
export function findTrailingWhitespace(text: string, shouldKeepMarkdownLineBreaks = false): TextChange[] {
  const changes: TextChange[] = [];
  let lineStart = 0;
  for (const line of text.split('\n')) {
    const match = TRAILING_WHITESPACE.exec(line);
    const isLineBreak = shouldKeepMarkdownLineBreaks && MARKDOWN_LINE_BREAK.test(line);
    if (match && !isLineBreak) {
      changes.push({ from: lineStart + match.index, to: lineStart + line.length, insert: '' });
    }
    lineStart += line.length + 1;
  }
  return changes;
}

/** The newline to add at the end of a non-empty text that doesn't end with one, or null. */
export function findMissingFinalNewline(text: string): TextChange | null {
  if (text.length === 0 || text.endsWith('\n')) return null;
  return { from: text.length, to: text.length, insert: '\n' };
}
