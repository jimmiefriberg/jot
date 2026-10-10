import { Scalar, isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';

import { ROOT_PATH, childPath, createProblem } from '../tree/tree-model';
import type { TextRange } from '../documents/text-change';
import type { DataTreeNode, TreeParseResult } from '../tree/tree-model';

function startOffset(node: unknown, fallbackOffset: number): number {
  if ((isMap(node) || isSeq(node) || isScalar(node) || isAlias(node)) && node.range) return node.range[0];
  return fallbackOffset;
}

const BLOCK_SCALAR_TYPES = new Set<unknown>([Scalar.BLOCK_LITERAL, Scalar.BLOCK_FOLDED]);

/** Range of a single-line scalar, which is what can be edited in place. Block scalars (`|`, `>`) are edited in source. */
function editableRange(node: unknown, text: string): TextRange | null {
  if (!isScalar(node) || !node.range || BLOCK_SCALAR_TYPES.has(node.type)) return null;
  const [from, to] = node.range;
  return text.slice(from, to).includes('\n') ? null : { from, to };
}

function keyName(key: unknown): string {
  if (isScalar(key)) return String(key.value);
  return String(key);
}

interface NodeLocation {
  key: string | number | null;
  path: string;
  depth: number;
  fallbackOffset: number;
  keyRange: TextRange | null;
}

function toTreeNode(node: unknown, location: NodeLocation, text: string): DataTreeNode {
  const { key, path, depth, keyRange } = location;
  const offset = startOffset(node, location.fallbackOffset);
  const base = { path, key, offset, depth, value: null, children: [], valueRange: editableRange(node, text), keyRange };

  if (isMap(node)) {
    const children = node.items.map((pair) => {
      const name = keyName(pair.key);
      const childLocation = {
        key: name,
        path: childPath(path, name),
        depth: depth + 1,
        fallbackOffset: startOffset(pair.key, offset),
        keyRange: editableRange(pair.key, text),
      };
      return toTreeNode(pair.value, childLocation, text);
    });
    return { ...base, kind: 'object', children };
  }
  if (isSeq(node)) {
    const children = node.items.map((item, index) =>
      toTreeNode(item, { key: index, path: childPath(path, index), depth: depth + 1, fallbackOffset: offset, keyRange: null }, text),
    );
    return { ...base, kind: 'array', children };
  }
  if (isAlias(node)) return { ...base, kind: 'string', value: `*${node.source}` };
  if (!isScalar(node)) return { ...base, kind: 'null' };

  const value: unknown = node.value;
  if (typeof value === 'string') return { ...base, kind: 'string', value };
  if (typeof value === 'number') return { ...base, kind: 'number', value };
  if (typeof value === 'bigint') return { ...base, kind: 'number', value: String(value) };
  if (typeof value === 'boolean') return { ...base, kind: 'boolean', value };
  if (value === null || value === undefined) return { ...base, kind: 'null' };
  return { ...base, kind: 'string', value: String(value) };
}

/** Parses YAML into the same tree the JSON view uses. Several documents (`---`) become a list of documents. */
export function parseYamlTree(text: string): TreeParseResult<DataTreeNode> {
  const documents = parseAllDocuments(text);
  const problems = documents.flatMap((document) =>
    document.errors.map((error) => createProblem(text, error.message.split('\n')[0], error.pos[0])),
  );

  if (documents.length === 0) return { root: null, problems };
  if (documents.length === 1) {
    const location = { key: null, path: ROOT_PATH, depth: 0, fallbackOffset: 0, keyRange: null };
    return { root: toTreeNode(documents[0].contents, location, text), problems };
  }

  const children = documents.map((document, index) => {
    const location = { key: index, path: childPath(ROOT_PATH, index), depth: 1, fallbackOffset: document.range[0], keyRange: null };
    return toTreeNode(document.contents, location, text);
  });
  const root: DataTreeNode = {
    path: ROOT_PATH,
    key: null,
    kind: 'array',
    value: null,
    children,
    offset: 0,
    depth: 0,
    valueRange: null,
    keyRange: null,
  };
  return { root, problems };
}
