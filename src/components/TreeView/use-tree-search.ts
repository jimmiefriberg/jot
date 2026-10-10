import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

import { searchTree } from '../../lib/tree/tree-search';

interface SearchableNode<Node> {
  path: string;
  children: Node[];
}

/** The filter box state of a tree: the query, its matches, and which match is current. */
export function useTreeSearch<Node extends SearchableNode<Node>>(root: Node | null, getSearchTexts: (node: Node) => string[]) {
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  // Searching walks the whole tree, so it's only redone when the tree or the query changes.
  const result = useMemo(() => searchTree(root, query, getSearchTexts), [root, query, getSearchTexts]);
  const matchedPaths = useMemo(() => new Set(result.matchedPaths), [result]);
  const matchCount = result.matchedPaths.length;
  const activeMatchPath = matchCount > 0 ? result.matchedPaths[activeMatchIndex % matchCount] : null;

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveMatchIndex(0);
  }

  function goToMatch(step: 1 | -1) {
    if (matchCount === 0) return;
    setActiveMatchIndex((index) => (index + step + matchCount) % matchCount);
  }

  return { query, changeQuery, matchedPaths, ancestorPaths: result.ancestorPaths, matchCount, activeMatchPath, goToMatch };
}

/** Adds the folders around every match to the expanded set, so matches are visible while filtering. */
export function useExpandedWithMatches(expandedPaths: Set<string>, ancestorPaths: Set<string>): Set<string> {
  return useMemo(() => (ancestorPaths.size === 0 ? expandedPaths : new Set([...expandedPaths, ...ancestorPaths])), [expandedPaths, ancestorPaths]);
}

/** Scrolls the current match into view whenever it changes. */
export function useScrollToActiveMatch(containerRef: RefObject<HTMLElement | null>, activeMatchPath: string | null): void {
  useEffect(() => {
    if (!activeMatchPath) return;
    containerRef.current?.querySelector('.is-active-match')?.scrollIntoView({ block: 'center' });
  }, [containerRef, activeMatchPath]);
}
