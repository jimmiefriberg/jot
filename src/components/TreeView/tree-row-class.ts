/** What the filter and selection say about a row, for its highlight. */
export interface RowHighlight {
  matchedPaths: Set<string>;
  activeMatchPath: string | null;
  selectedPath: string | null;
}

/** The class names of a tree row: matches of the filter, the current match, and the selected row. */
export function treeRowClassName(path: string, highlight: RowHighlight): string {
  const classNames = ['tree-row'];
  if (highlight.matchedPaths.has(path)) classNames.push('is-match');
  if (highlight.activeMatchPath === path) classNames.push('is-active-match');
  if (highlight.selectedPath === path) classNames.push('is-selected');
  return classNames.join(' ');
}
