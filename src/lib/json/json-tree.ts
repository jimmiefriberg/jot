import { applyEdits, format, parseTree, printParseErrorCode } from 'jsonc-parser';
import type { Node, ParseError } from 'jsonc-parser';

import { ROOT_PATH, childPath, createProblem } from '../tree/tree-model';
import type { TextRange } from '../documents/text-change';
import type { DataTreeNode, TreeParseResult } from '../tree/tree-model';

function scalarValue(node: Node): string | number | boolean | null {
  const value: unknown = node.value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

function rangeOf(node: Node): TextRange {
  return { from: node.offset, to: node.offset + node.length };
}

function toTreeNode(
  node: Node,
  key: string | number | null,
  path: string,
  depth: number,
  keyRange: TextRange | null = null,
): DataTreeNode {
  const base = { path, key, offset: node.offset, depth, value: null, children: [], valueRange: null, keyRange };

  if (node.type === 'object') {
    const children = (node.children ?? []).flatMap((property) => {
      const [keyNode, valueNode] = property.children ?? [];
      if (!keyNode || !valueNode) return [];
      const propertyName = String(keyNode.value);
      return [toTreeNode(valueNode, propertyName, childPath(path, propertyName), depth + 1, rangeOf(keyNode))];
    });
    return { ...base, kind: 'object', children };
  }

  if (node.type === 'array') {
    const children = (node.children ?? []).map((item, index) => toTreeNode(item, index, childPath(path, index), depth + 1));
    return { ...base, kind: 'array', children };
  }

  const kind = node.type === 'property' ? 'null' : node.type;
  return { ...base, kind, value: scalarValue(node), valueRange: rangeOf(node) };
}

/** Parses JSON (comments and trailing commas allowed) into a tree for the formatted view. */
export function parseJsonTree(text: string): TreeParseResult<DataTreeNode> {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  const problems = errors.map((error) => createProblem(text, printParseErrorCode(error.error), error.offset));
  const root = tree ? toTreeNode(tree, null, ROOT_PATH, 0) : null;
  return { root, problems };
}

/** Pretty-prints JSON while keeping comments. Returns the text unchanged when there is nothing to format. */
export function formatJson(text: string, tabSize: number): string {
  const edits = format(text, undefined, { tabSize, insertSpaces: true, eol: '\n' });
  return applyEdits(text, edits);
}
