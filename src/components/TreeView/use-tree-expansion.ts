import { useState } from 'react';

import { collectContainerPaths } from '../../lib/tree/tree-model';
import type { ExpandableNode } from '../../lib/tree/tree-model';

/** Which tree nodes are expanded. Starts expanded to `initialDepth`. */
export function useTreeExpansion(root: ExpandableNode | null, initialDepth: number) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    root ? collectContainerPaths(root, initialDepth) : new Set(),
  );

  function expandAll() {
    if (root) setExpandedPaths(collectContainerPaths(root));
  }

  function collapseAll() {
    setExpandedPaths(new Set());
  }

  function togglePath(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return { expandedPaths, expandAll, collapseAll, togglePath };
}
