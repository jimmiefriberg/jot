export interface FuzzyMatch {
  score: number;
  /** Positions in the text that matched, for highlighting. */
  matchedIndexes: number[];
}

export interface RankedPath {
  path: string;
  /** The path shown to the user (relative to the open folder when inside it). */
  label: string;
  matchedIndexes: number[];
}

const WORD_SEPARATORS = new Set(['/', '\\', '-', '_', '.', ' ']);
const CONSECUTIVE_BONUS = 6;
const WORD_START_BONUS = 8;
const FILE_NAME_BONUS = 12;

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text[index - 1];
  if (WORD_SEPARATORS.has(previous)) return true;
  // camelCase boundary: "fileKind" matches "fk".
  return previous === previous.toLowerCase() && text[index] !== text[index].toLowerCase();
}

/** Where the next query character goes: right after the previous match, else at a word start, else anywhere later. */
function findNextIndex(text: string, haystack: string, character: string, previousIndex: number): number {
  if (haystack[previousIndex + 1] === character) return previousIndex + 1;
  let firstIndex = -1;
  for (let index = haystack.indexOf(character, previousIndex + 1); index !== -1; index = haystack.indexOf(character, index + 1)) {
    if (isWordStart(text, index)) return index;
    if (firstIndex === -1) firstIndex = index;
  }
  return firstIndex;
}

/** Matches the whole query with its first character at `startIndex`. */
function matchFrom(text: string, haystack: string, needle: string, startIndex: number): FuzzyMatch | null {
  const fileNameStart = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\')) + 1;
  const matchedIndexes: number[] = [];
  let score = 0;
  let index = startIndex;
  for (let needleIndex = 0; needleIndex < needle.length; needleIndex++) {
    if (needleIndex > 0) index = findNextIndex(text, haystack, needle[needleIndex], index);
    if (index === -1) return null;
    if (matchedIndexes.length > 0 && matchedIndexes[matchedIndexes.length - 1] === index - 1) score += CONSECUTIVE_BONUS;
    if (isWordStart(text, index)) score += WORD_START_BONUS;
    if (index >= fileNameStart) score += FILE_NAME_BONUS;
    matchedIndexes.push(index);
  }
  // Prefer shorter paths when everything else is equal.
  return { score: score - text.length * 0.05, matchedIndexes };
}

/**
 * Matches the query's characters in order anywhere in the text (so "edsess" finds "editor-session.ts").
 * Matches at word starts, in a row, and in the file name score higher. Null when the text doesn't match.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.replaceAll(' ', '').toLowerCase();
  if (!needle) return { score: 0, matchedIndexes: [] };

  const haystack = text.toLowerCase();
  let bestMatch: FuzzyMatch | null = null;
  for (let start = haystack.indexOf(needle[0]); start !== -1; start = haystack.indexOf(needle[0], start + 1)) {
    const match = matchFrom(text, haystack, needle, start);
    if (!match) break;
    if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
  }
  return bestMatch;
}

/** Shows paths inside the folder relative to it, and others in full. */
function labelFor(path: string, folderPath: string | null): string {
  if (folderPath && path.startsWith(`${folderPath}/`)) return path.slice(folderPath.length + 1);
  return path;
}

/** The best matches for a query, best first. With an empty query, paths keep their order. */
export function rankPaths(query: string, paths: string[], folderPath: string | null, limit = 50): RankedPath[] {
  const ranked: (RankedPath & { score: number })[] = [];
  for (const path of paths) {
    const label = labelFor(path, folderPath);
    const match = fuzzyMatch(query, label);
    if (match) ranked.push({ path, label, matchedIndexes: match.matchedIndexes, score: match.score });
  }
  if (query.trim()) ranked.sort((first, second) => second.score - first.score);
  return ranked.slice(0, limit).map(({ path, label, matchedIndexes }) => ({ path, label, matchedIndexes }));
}
