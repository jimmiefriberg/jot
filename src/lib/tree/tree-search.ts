import type { DataTreeNode } from './tree-model';

interface SearchableNode<Node> {
  path: string;
  children: Node[];
}

export interface TreeSearchResult {
  /** Paths of matching nodes, in document order (for jumping from one match to the next). */
  matchedPaths: string[];
  /** Containers to expand so every match is visible. */
  ancestorPaths: Set<string>;
}

const EMPTY_RESULT: TreeSearchResult = { matchedPaths: [], ancestorPaths: new Set() };

/** Finds nodes whose text (key, value, tag name…) contains the query, ignoring case. */
export function searchTree<Node extends SearchableNode<Node>>(
  root: Node | null,
  query: string,
  getSearchTexts: (node: Node) => string[],
): TreeSearchResult {
  const needle = query.trim().toLowerCase();
  if (!root || !needle) return EMPTY_RESULT;

  const matchedPaths: string[] = [];
  const ancestorPaths = new Set<string>();
  const openPaths: string[] = [];

  function visit(node: Node) {
    if (getSearchTexts(node).some((text) => text.toLowerCase().includes(needle))) {
      matchedPaths.push(node.path);
      for (const path of openPaths) ancestorPaths.add(path);
    }
    openPaths.push(node.path);
    node.children.forEach(visit);
    openPaths.pop();
  }

  visit(root);
  return { matchedPaths, ancestorPaths };
}

/** A data node's searchable text: its property name and, for plain values, the value. */
export function dataNodeSearchTexts(node: DataTreeNode): string[] {
  const texts = typeof node.key === 'string' ? [node.key] : [];
  if (node.kind !== 'object' && node.kind !== 'array') texts.push(String(node.value));
  return texts;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A path like `settings.theme.light` or `jobs.build.steps[0]`, the way you'd reach the value in code. */
export function formatDataPath(keys: (string | number)[]): string {
  let path = '';
  for (const key of keys) {
    if (typeof key === 'number') path += `[${key}]`;
    else if (IDENTIFIER.test(key)) path += path ? `.${key}` : key;
    else path += `[${JSON.stringify(key)}]`;
  }
  return path;
}

/** The keys from the root down to the node at `targetPath`, or null when it isn't in the tree. */
export function findKeyChain(root: DataTreeNode, targetPath: string): (string | number)[] | null {
  if (root.path === targetPath) return [];
  for (const child of root.children) {
    if (child.path !== targetPath && !targetPath.startsWith(`${child.path}/`)) continue;
    const rest = findKeyChain(child, targetPath);
    if (rest !== null && child.key !== null) return [child.key, ...rest];
  }
  return null;
}
