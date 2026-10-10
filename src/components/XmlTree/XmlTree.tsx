import { useMemo, useState } from 'react';

import { useDocumentText } from '../../lib/documents/use-document-text';
import { applyTextChange } from '../../lib/editor/editor-session';
import { createReplacement, encodeXmlAttributeValue, encodeXmlText } from '../../lib/tree/tree-edits';
import { parseXmlTree } from '../../lib/xml/xml-tree';
import type { XmlTreeNode } from '../../lib/xml/xml-tree';
import { Icon } from '../Icon/Icon';
import { InlineEditor } from '../TreeView/InlineEditor';
import { ShowMoreChildren, useVisibleChildCount } from '../TreeView/ShowMoreChildren';
import { TreeShell } from '../TreeView/TreeShell';
import { treeRowClassName } from '../TreeView/tree-row-class';
import type { RowHighlight } from '../TreeView/tree-row-class';
import { isEditing, useTreeEditing } from '../TreeView/use-tree-editing';
import type { EditTarget } from '../TreeView/use-tree-editing';
import { useTreeExpansion } from '../TreeView/use-tree-expansion';
import { useExpandedWithMatches, useTreeSearch } from '../TreeView/use-tree-search';

const INITIAL_EXPANDED_DEPTH = 2;
const INLINE_TEXT_LIMIT = 80;
const TEXT_FIELD = 'value';
const ATTRIBUTE_FIELD_PREFIX = 'attribute-';

const LEAF_CLASS_NAMES: Record<string, string> = {
  text: 'tree-text',
  comment: 'tree-comment',
  cdata: 'tree-string',
  instruction: 'tree-meta',
  doctype: 'tree-meta',
};

/** An XML node's searchable text: tag name, attributes and text content. */
function xmlNodeSearchTexts(node: XmlTreeNode): string[] {
  return [node.name, node.text, ...node.attributes.flatMap((attribute) => [attribute.name, attribute.value])].filter(Boolean);
}

/** Everything every row needs, passed down the tree as one prop. */
interface TreeContext {
  expandedPaths: Set<string>;
  editTarget: EditTarget | null;
  highlight: RowHighlight;
  onCommitEdit: (node: XmlTreeNode, field: string, input: string) => void;
  onCancelEdit: () => void;
}

interface NodePartProps {
  node: XmlTreeNode;
  context: TreeContext;
}

function AttributeValue({ node, context, index }: NodePartProps & { index: number }) {
  const attribute = node.attributes[index];
  const field = `${ATTRIBUTE_FIELD_PREFIX}${index}`;

  function handleCommit(input: string) {
    context.onCommitEdit(node, field, input);
  }

  if (isEditing(context.editTarget, node.path, field)) {
    return <InlineEditor initialValue={attribute.value} onCommit={handleCommit} onCancel={context.onCancelEdit} />;
  }
  const isEditable = attribute.valueRange !== null;
  return (
    <span className="tree-string" data-edit-path={isEditable ? node.path : undefined} data-edit-field={isEditable ? field : undefined}>
      "{attribute.value}"
    </span>
  );
}

/** `<name attribute="value">`, coloured like the editor. */
function OpenTag({ node, context, isSelfClosing = false }: NodePartProps & { isSelfClosing?: boolean }) {
  return (
    <span>
      <span className="tree-punctuation">&lt;</span>
      <span className="tree-tag">{node.name}</span>
      {node.attributes.map((attribute, index) => (
        <span key={index}>
          {' '}
          <span className="tree-key">{attribute.name}</span>
          <span className="tree-punctuation">=</span>
          <AttributeValue node={node} context={context} index={index} />
        </span>
      ))}
      <span className="tree-punctuation">{isSelfClosing ? ' />' : '>'}</span>
    </span>
  );
}

function CloseTag({ node }: { node: XmlTreeNode }) {
  return (
    <span>
      <span className="tree-punctuation">&lt;/</span>
      <span className="tree-tag">{node.name}</span>
      <span className="tree-punctuation">&gt;</span>
    </span>
  );
}

/** Text, comment or other leaf content. Text can be edited in place. */
function LeafContent({ node, context }: NodePartProps) {
  function handleCommit(input: string) {
    context.onCommitEdit(node, TEXT_FIELD, input);
  }

  if (isEditing(context.editTarget, node.path, TEXT_FIELD)) {
    return <InlineEditor initialValue={node.text} onCommit={handleCommit} onCancel={context.onCancelEdit} />;
  }
  const isEditable = node.valueRange !== null;
  return (
    <span
      className={LEAF_CLASS_NAMES[node.kind]}
      data-edit-path={isEditable ? node.path : undefined}
      data-edit-field={isEditable ? TEXT_FIELD : undefined}
    >
      {node.text}
    </span>
  );
}

function hasInlineText(node: XmlTreeNode): boolean {
  const [onlyChild] = node.children;
  return node.children.length === 1 && onlyChild.kind === 'text' && onlyChild.text.length <= INLINE_TEXT_LIMIT;
}

function XmlNodeView({ node, context }: NodePartProps) {
  const { visibleCount, hiddenCount, showMore } = useVisibleChildCount(node.children.length);
  const rowClassName = treeRowClassName(node.path, context.highlight);

  if (node.kind !== 'element') {
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <span className="tree-toggle-spacer" />
        <LeafContent node={node} context={context} />
      </div>
    );
  }

  if (node.children.length === 0) {
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <span className="tree-toggle-spacer" />
        <OpenTag node={node} context={context} isSelfClosing />
      </div>
    );
  }

  if (hasInlineText(node)) {
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <span className="tree-toggle-spacer" />
        <OpenTag node={node} context={context} />
        <LeafContent node={node.children[0]} context={context} />
        <CloseTag node={node} />
      </div>
    );
  }

  if (!context.expandedPaths.has(node.path)) {
    const count = node.children.length;
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <button className="tree-toggle" data-toggle-path={node.path} aria-label="Expand">
          <Icon name="chevronRight" size={12} />
        </button>
        <OpenTag node={node} context={context} />
        <span className="tree-summary" data-toggle-path={node.path}>
          {' '}
          {count} {count === 1 ? 'child' : 'children'}{' '}
        </span>
        <CloseTag node={node} />
      </div>
    );
  }

  return (
    <div className="tree-node">
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <button className="tree-toggle" data-toggle-path={node.path} aria-label="Collapse">
          <Icon name="chevronRight" size={12} className="is-expanded" />
        </button>
        <OpenTag node={node} context={context} />
      </div>
      <div className="tree-children">
        {node.children.slice(0, visibleCount).map((child) => (
          <XmlNodeView key={child.path} node={child} context={context} />
        ))}
        <ShowMoreChildren hiddenCount={hiddenCount} onShowMore={showMore} />
      </div>
      <div className="tree-row">
        <span className="tree-toggle-spacer" />
        <CloseTag node={node} />
      </div>
    </div>
  );
}

/** Collapsible element tree of an XML document. Double-click text or an attribute value to edit it in place. */
export function XmlTree() {
  const text = useDocumentText();
  const { root, problems } = useMemo(() => parseXmlTree(text), [text]);
  const { expandedPaths, expandAll, collapseAll, togglePath } = useTreeExpansion(root, INITIAL_EXPANDED_DEPTH);
  const { editTarget, startEditing, stopEditing } = useTreeEditing();
  const search = useTreeSearch(root, xmlNodeSearchTexts);
  const visibleExpandedPaths = useExpandedWithMatches(expandedPaths, search.ancestorPaths);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  function handleCommitEdit(node: XmlTreeNode, field: string, input: string) {
    stopEditing();
    if (field === TEXT_FIELD) {
      const change = node.valueRange && createReplacement(text, node.valueRange, encodeXmlText(input));
      if (change) applyTextChange(change);
      return;
    }
    const attribute = node.attributes[Number(field.slice(ATTRIBUTE_FIELD_PREFIX.length))];
    const change = attribute?.valueRange && createReplacement(text, attribute.valueRange, encodeXmlAttributeValue(input, attribute.quote));
    if (change) applyTextChange(change);
  }

  const highlight: RowHighlight = { matchedPaths: search.matchedPaths, activeMatchPath: search.activeMatchPath, selectedPath };
  const context: TreeContext = { expandedPaths: visibleExpandedPaths, editTarget, highlight, onCommitEdit: handleCommitEdit, onCancelEdit: stopEditing };
  const filter = {
    query: search.query,
    onQueryChange: search.changeQuery,
    matchCount: search.matchCount,
    activeMatchPath: search.activeMatchPath,
    onGoToMatch: search.goToMatch,
  };

  return (
    <TreeShell
      problems={problems}
      isEmpty={!root}
      filter={filter}
      onExpandAll={expandAll}
      onCollapseAll={collapseAll}
      onTogglePath={togglePath}
      onEdit={startEditing}
      onSelectPath={setSelectedPath}
      selectedPathLabel={null}
    >
      {root?.children.map((child) => <XmlNodeView key={child.path} node={child} context={context} />)}
    </TreeShell>
  );
}
