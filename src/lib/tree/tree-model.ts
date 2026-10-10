import type { TextRange } from '../documents/text-change';

export type DataValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** A node in a JSON or YAML data tree. */
export interface DataTreeNode {
  /** Unique, stable id for the node, used to remember which nodes are expanded. */
  path: string;
  /** Property name for object members, index for array items, null for the root. */
  key: string | number | null;
  kind: DataValueKind;
  value: string | number | boolean | null;
  children: DataTreeNode[];
  /** Character offset of the value in the source text. */
  offset: number;
  depth: number;
  /** Source range of a scalar value that can be edited in place; null for containers and multi-line values. */
  valueRange: TextRange | null;
  /** Source range of the property name, for renaming in place. */
  keyRange: TextRange | null;
}

export interface TreeParseProblem {
  message: string;
  offset: number;
  line: number;
  column: number;
}

export interface TreeParseResult<Node> {
  root: Node | null;
  problems: TreeParseProblem[];
}

export interface ExpandableNode {
  path: string;
  depth: number;
  children: ExpandableNode[];
}

export const ROOT_PATH = '$';

export function childPath(parentPath: string, key: string | number): string {
  return `${parentPath}/${String(key)}`;
}

/** One-based line and column of a character offset. */
export function lineAndColumnAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset && index < text.length; index++) {
    if (text[index] === '\n') {
      line++;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

export function createProblem(text: string, message: string, offset: number): TreeParseProblem {
  return { message, offset, ...lineAndColumnAt(text, offset) };
}

/** Collects the paths of every node with children, down to (and including) `maximumDepth`. */
export function collectContainerPaths(root: ExpandableNode, maximumDepth = Infinity): Set<string> {
  const paths = new Set<string>();
  function visit(node: ExpandableNode) {
    if (node.children.length === 0 || node.depth > maximumDepth) return;
    paths.add(node.path);
    node.children.forEach(visit);
  }
  visit(root);
  return paths;
}
