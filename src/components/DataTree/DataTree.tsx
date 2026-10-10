import { useMemo, useState } from 'react';

import { useDocumentText } from '../../lib/documents/use-document-text';
import { applyTextChange } from '../../lib/editor/editor-session';
import { parseJsonTree } from '../../lib/json/json-tree';
import { createReplacement, encodeJsonKey, encodeJsonValue, encodeYamlScalar } from '../../lib/tree/tree-edits';
import type { DataTreeNode, DataValueKind, TreeParseResult } from '../../lib/tree/tree-model';
import { dataNodeSearchTexts, findKeyChain, formatDataPath } from '../../lib/tree/tree-search';
import { parseYamlTree } from '../../lib/yaml/yaml-tree';
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

type Notation = 'json' | 'yaml';
type EditField = 'key' | 'value';

/** How a notation turns typed text back into source text. */
interface NotationRules {
  initialExpandedDepth: number;
  encodeValue: (input: string, originalSource: string, originalKind: DataValueKind) => string;
  encodeKey: (input: string, originalSource: string) => string;
}

function encodeJsonValueFromSource(input: string, _originalSource: string, originalKind: DataValueKind) {
  return encodeJsonValue(input, originalKind);
}

function encodeYamlKey(input: string, originalSource: string) {
  return encodeYamlScalar(input, originalSource, 'string');
}

const NOTATION_RULES: Record<Notation, NotationRules> = {
  json: { initialExpandedDepth: 1, encodeValue: encodeJsonValueFromSource, encodeKey: encodeJsonKey },
  // YAML's root has no row of its own, so it opens one level deeper to look the same as JSON.
  yaml: { initialExpandedDepth: 2, encodeValue: encodeYamlScalar, encodeKey: encodeYamlKey },
};

/** Everything every row needs, passed down the tree as one prop. */
interface TreeContext {
  notation: Notation;
  expandedPaths: Set<string>;
  editTarget: EditTarget | null;
  highlight: RowHighlight;
  onCommitEdit: (node: DataTreeNode, field: EditField, input: string) => void;
  onCancelEdit: () => void;
}

function describeCollapsed(node: DataTreeNode): string {
  const count = node.children.length;
  if (node.kind === 'object') return `{ ${count} ${count === 1 ? 'key' : 'keys'} }`;
  return `[ ${count} ${count === 1 ? 'item' : 'items'} ]`;
}

/** JSON shows strings quoted; YAML shows them as written, quoting only empty strings. */
function formatScalar(node: DataTreeNode, notation: Notation): string {
  if (node.kind !== 'string') return String(node.value);
  if (notation === 'json' || node.value === '') return JSON.stringify(node.value);
  return String(node.value);
}

interface NodePartProps {
  node: DataTreeNode;
  context: TreeContext;
}

function KeyLabel({ node, context }: NodePartProps) {
  const { notation, editTarget, onCommitEdit, onCancelEdit } = context;
  if (node.key === null) return null;
  if (typeof node.key === 'number') {
    return <span className="tree-index">{notation === 'yaml' ? '- ' : `${node.key}: `}</span>;
  }

  function handleCommit(input: string) {
    onCommitEdit(node, 'key', input);
  }

  const isKeyEditing = isEditing(editTarget, node.path, 'key');
  const isEditable = node.keyRange !== null;
  return (
    <span className="tree-key">
      {isKeyEditing ? (
        <InlineEditor initialValue={node.key} onCommit={handleCommit} onCancel={onCancelEdit} />
      ) : (
        <span data-edit-path={isEditable ? node.path : undefined} data-edit-field={isEditable ? 'key' : undefined}>
          {notation === 'json' ? JSON.stringify(node.key) : node.key}
        </span>
      )}
      <span className="tree-punctuation">: </span>
    </span>
  );
}

function ScalarValue({ node, context }: NodePartProps) {
  const { notation, editTarget, onCommitEdit, onCancelEdit } = context;

  function handleCommit(input: string) {
    onCommitEdit(node, 'value', input);
  }

  if (isEditing(editTarget, node.path, 'value')) {
    const initialValue = node.kind === 'string' ? String(node.value) : String(node.value ?? 'null');
    return <InlineEditor initialValue={initialValue} onCommit={handleCommit} onCancel={onCancelEdit} />;
  }
  const isEditable = node.valueRange !== null;
  return (
    <span
      className={`tree-value tree-${node.kind}`}
      data-edit-path={isEditable ? node.path : undefined}
      data-edit-field={isEditable ? 'value' : undefined}
    >
      {formatScalar(node, notation)}
    </span>
  );
}

interface DataNodeViewProps extends NodePartProps {
  isLast: boolean;
}

function DataNodeView({ node, context, isLast }: DataNodeViewProps) {
  const { visibleCount, hiddenCount, showMore } = useVisibleChildCount(node.children.length);
  const isContainer = node.kind === 'object' || node.kind === 'array';
  const isJson = context.notation === 'json';
  const comma = isJson && !isLast ? ',' : '';
  const rowClassName = treeRowClassName(node.path, context.highlight);

  if (!isContainer) {
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <span className="tree-toggle-spacer" />
        <KeyLabel node={node} context={context} />
        <ScalarValue node={node} context={context} />
        <span className="tree-punctuation">{comma}</span>
      </div>
    );
  }

  const [openBracket, closeBracket] = node.kind === 'object' ? ['{', '}'] : ['[', ']'];
  const isEmpty = node.children.length === 0;
  const isExpanded = context.expandedPaths.has(node.path) && !isEmpty;

  if (!isExpanded) {
    return (
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        {isEmpty ? (
          <span className="tree-toggle-spacer" />
        ) : (
          <button className="tree-toggle" data-toggle-path={node.path} aria-label="Expand">
            <Icon name="chevronRight" size={12} />
          </button>
        )}
        <KeyLabel node={node} context={context} />
        <span className="tree-summary" data-toggle-path={isEmpty ? undefined : node.path}>
          {isEmpty ? `${openBracket}${closeBracket}` : describeCollapsed(node)}
        </span>
        <span className="tree-punctuation">{comma}</span>
      </div>
    );
  }

  const isYamlRoot = !isJson && node.key === null;
  const children = node.children.slice(0, visibleCount).map((child, index) => (
    <DataNodeView key={child.path} node={child} context={context} isLast={index === node.children.length - 1} />
  ));

  // YAML has no brackets, so its root needs no row of its own: its keys are the top level.
  if (isYamlRoot) {
    return (
      <div className="tree-node">
        {children}
        <ShowMoreChildren hiddenCount={hiddenCount} onShowMore={showMore} />
      </div>
    );
  }

  return (
    <div className="tree-node">
      <div className={rowClassName} data-offset={node.offset} data-node-path={node.path}>
        <button className="tree-toggle" data-toggle-path={node.path} aria-label="Collapse">
          <Icon name="chevronRight" size={12} className="is-expanded" />
        </button>
        <KeyLabel node={node} context={context} />
        {isJson && <span className="tree-punctuation">{openBracket}</span>}
      </div>
      <div className="tree-children">
        {children}
        <ShowMoreChildren hiddenCount={hiddenCount} onShowMore={showMore} />
      </div>
      {isJson && (
        <div className="tree-row">
          <span className="tree-toggle-spacer" />
          <span className="tree-punctuation">
            {closeBracket}
            {comma}
          </span>
        </div>
      )}
    </div>
  );
}

interface DataTreeProps {
  parse: (text: string) => TreeParseResult<DataTreeNode>;
  notation: Notation;
}

/** Collapsible tree of a JSON or YAML document. Double-click a value or key to edit it in place. */
function DataTree({ parse, notation }: DataTreeProps) {
  const text = useDocumentText();
  const { root, problems } = useMemo(() => parse(text), [parse, text]);
  const rules = NOTATION_RULES[notation];
  const { expandedPaths, expandAll, collapseAll, togglePath } = useTreeExpansion(root, rules.initialExpandedDepth);
  const { editTarget, startEditing, stopEditing } = useTreeEditing();
  const search = useTreeSearch(root, dataNodeSearchTexts);
  const visibleExpandedPaths = useExpandedWithMatches(expandedPaths, search.ancestorPaths);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedKeys = root && selectedPath !== null ? findKeyChain(root, selectedPath) : null;

  function handleCommitEdit(node: DataTreeNode, field: EditField, input: string) {
    stopEditing();
    const range = field === 'key' ? node.keyRange : node.valueRange;
    if (!range) return;
    const originalSource = text.slice(range.from, range.to);
    const insert = field === 'key' ? rules.encodeKey(input, originalSource) : rules.encodeValue(input, originalSource, node.kind);
    const change = createReplacement(text, range, insert);
    if (change) applyTextChange(change);
  }

  const highlight: RowHighlight = { matchedPaths: search.matchedPaths, activeMatchPath: search.activeMatchPath, selectedPath };
  const context: TreeContext = {
    notation,
    expandedPaths: visibleExpandedPaths,
    editTarget,
    highlight,
    onCommitEdit: handleCommitEdit,
    onCancelEdit: stopEditing,
  };
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
      selectedPathLabel={selectedKeys ? formatDataPath(selectedKeys) : null}
    >
      {root && <DataNodeView node={root} context={context} isLast />}
    </TreeShell>
  );
}

/** JSON tree. Comments and trailing commas are allowed. */
export function JsonTree() {
  return <DataTree parse={parseJsonTree} notation="json" />;
}

/** YAML tree. Several documents (`---`) show as a list. */
export function YamlTree() {
  return <DataTree parse={parseYamlTree} notation="yaml" />;
}
