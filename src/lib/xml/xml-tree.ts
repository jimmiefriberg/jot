import { parser } from '@lezer/xml';
import type { SyntaxNode } from '@lezer/common';

import { ROOT_PATH, childPath, createProblem } from '../tree/tree-model';
import type { TextRange } from '../documents/text-change';
import type { TreeParseProblem, TreeParseResult } from '../tree/tree-model';

export type XmlNodeKind = 'document' | 'element' | 'text' | 'comment' | 'instruction' | 'cdata' | 'doctype';

export interface XmlAttribute {
  name: string;
  value: string;
  /** Range of the value between its quotes, and the quote character used. */
  valueRange: TextRange | null;
  quote: '"' | "'";
}

export interface XmlTreeNode {
  path: string;
  kind: XmlNodeKind;
  /** Tag name for elements, empty otherwise. */
  name: string;
  attributes: XmlAttribute[];
  /** Text for text, comment, CDATA, instruction and doctype nodes. */
  text: string;
  children: XmlTreeNode[];
  offset: number;
  depth: number;
  /** For text nodes: the source range of the text without surrounding whitespace, for editing in place. */
  valueRange: TextRange | null;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const LEAF_KINDS: Record<string, XmlNodeKind> = {
  Comment: 'comment',
  Cdata: 'cdata',
  ProcessingInst: 'instruction',
  DoctypeDecl: 'doctype',
};

const TEXT_NODE_NAMES = new Set(['Text', 'EntityReference', 'CharacterReference']);

function decodeReference(match: string, name: string): string {
  if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
  if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
  return NAMED_ENTITIES[name] ?? match;
}

/** Decodes `&amp;`, `&#38;` and `&#x26;` style references. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, decodeReference);
}

function childNodes(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) children.push(child);
  return children;
}

function stripQuotes(value: string): string {
  return /^["'].*["']$/s.test(value) ? value.slice(1, -1) : value;
}

function leafNode(kind: XmlNodeKind, text: string, path: string, offset: number, depth: number): XmlTreeNode {
  return { path, kind, name: '', attributes: [], text, children: [], offset, depth, valueRange: null };
}

/** The part of a raw text run without its leading and trailing whitespace. */
function trimmedRange(raw: string, start: number): TextRange {
  const leading = raw.length - raw.trimStart().length;
  const trailing = raw.length - raw.trimEnd().length;
  return { from: start + leading, to: start + raw.length - trailing };
}

/** Converts parsed content (a document's or an element's children) into tree nodes, merging runs of text. */
function convertContent(source: string, nodes: SyntaxNode[], parentPath: string, depth: number): XmlTreeNode[] {
  const result: XmlTreeNode[] = [];
  let textRun = '';
  let textRunStart = 0;

  function flushText() {
    const text = decodeEntities(textRun).replace(/\s+/g, ' ').trim();
    if (text) {
      const node = leafNode('text', text, childPath(parentPath, result.length), textRunStart, depth);
      result.push({ ...node, valueRange: trimmedRange(textRun, textRunStart) });
    }
    textRun = '';
  }

  for (const node of nodes) {
    if (TEXT_NODE_NAMES.has(node.name)) {
      if (!textRun) textRunStart = node.from;
      textRun += source.slice(node.from, node.to);
      continue;
    }
    flushText();
    const path = childPath(parentPath, result.length);
    if (node.name === 'Element') result.push(convertElement(source, node, path, depth));
    const leafKind = LEAF_KINDS[node.name];
    if (leafKind) result.push(leafNode(leafKind, source.slice(node.from, node.to), path, node.from, depth));
  }
  flushText();
  return result;
}

const TAG_PART_NAMES = new Set(['OpenTag', 'SelfClosingTag', 'CloseTag', 'MissingCloseTag', 'MismatchedCloseTag']);

function convertElement(source: string, element: SyntaxNode, path: string, depth: number): XmlTreeNode {
  const openTag = element.getChild('OpenTag') ?? element.getChild('SelfClosingTag');
  const tagName = openTag?.getChild('TagName');
  const attributes = (openTag?.getChildren('Attribute') ?? []).map((attribute): XmlAttribute => {
    const nameNode = attribute.getChild('AttributeName');
    const valueNode = attribute.getChild('AttributeValue');
    const rawValue = valueNode ? source.slice(valueNode.from, valueNode.to) : '';
    const isQuoted = valueNode !== null && /^["'].*["']$/s.test(rawValue);
    return {
      name: nameNode ? source.slice(nameNode.from, nameNode.to) : '',
      value: decodeEntities(stripQuotes(rawValue)),
      valueRange: valueNode && isQuoted ? { from: valueNode.from + 1, to: valueNode.to - 1 } : null,
      quote: rawValue.startsWith("'") ? "'" : '"',
    };
  });
  const content = childNodes(element).filter((child) => !TAG_PART_NAMES.has(child.name));
  return {
    path,
    kind: 'element',
    name: tagName ? source.slice(tagName.from, tagName.to) : '',
    attributes,
    text: '',
    children: convertContent(source, content, path, depth + 1),
    offset: element.from,
    depth,
    valueRange: null,
  };
}

function collectProblems(source: string, root: SyntaxNode): TreeParseProblem[] {
  const problems: TreeParseProblem[] = [];
  root.cursor().iterate((node) => {
    if (node.type.isError) problems.push(createProblem(source, 'Syntax error', node.from));
    const element = node.node.parent;
    const tagName = element?.getChild('OpenTag')?.getChild('TagName');
    const name = tagName ? source.slice(tagName.from, tagName.to) : '';
    if (node.name === 'MissingCloseTag') problems.push(createProblem(source, `Missing closing tag for <${name}>`, element?.from ?? node.from));
    if (node.name === 'MismatchedCloseTag') problems.push(createProblem(source, `Closing tag doesn't match <${name}>`, node.from));
  });
  return problems;
}

/** Parses XML into an element tree for the formatted view. Whitespace-only text is left out. */
export function parseXmlTree(source: string): TreeParseResult<XmlTreeNode> {
  const document = parser.parse(source).topNode;
  const children = convertContent(source, childNodes(document), ROOT_PATH, 1);
  const root = children.length === 0 ? null : { ...leafNode('document', '', ROOT_PATH, 0, 0), children };
  return { root, problems: collectProblems(source, document) };
}
