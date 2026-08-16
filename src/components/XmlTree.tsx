import { type CSSProperties, type ReactNode, useState } from 'react';
import { BRANCH_INITIAL, initialBranchOpen, nextVisibleCount } from '../lib/config-tree';
import { useT } from '../lib/i18n';
import type { XmlElement, XmlNode } from '../lib/xml-tree';
import { ChevronRight } from './icons';

/**
 * The XML model as a collapsible tree. The row shell — indentation, chevron,
 * hover, "show more" — is the config tree's `cfg-*` in `styles/config.scss`,
 * shared rather than copied under a second name, and so are the branch reveal
 * and expand-all caps in `lib/config-tree`. Only what is specific to markup
 * (tags, attributes, comments) is this view's own, in `styles/xml.scss`.
 */

function indent(depth: number): CSSProperties {
  return { '--cfg-indent': `${8 + depth * 14}px` } as CSSProperties;
}

/**
 * The value as a double-quoted attribute would carry it. The document may have
 * written it in single quotes, and then its own double quotes are legal inside —
 * printed as they are, `a='say "hi"'` comes back as `a="say "hi""`, which is not
 * a start tag anyone could have written.
 */
function attributeValue(value: string): string {
  // `replace` with a global regexp rather than `replaceAll`, which this project's
  // ES2020 lib target does not have.
  return `"${value.replace(/"/g, '&quot;')}"`;
}

/** `<name attr="value">`, or `<name attr="value"/>` for an element with nothing in it. */
function StartTag({ node, close }: { node: XmlElement; close: '>' | '/>' }) {
  return (
    <>
      <span className="xml-punct">{'<'}</span>
      <span className="xml-tag">{node.name}</span>
      {node.attributes.map((attr) => (
        // The name is a key: a repeated attribute name is a parse error, so a
        // document that reaches this view cannot carry two of the same.
        <span key={attr.name}>
          <span className="xml-attr-name"> {attr.name}</span>
          <span className="xml-punct">=</span>
          <span className="xml-attr-value">{attributeValue(attr.value)}</span>
        </span>
      ))}
      {node.omittedAttributes > 0 && <span className="xml-punct"> …</span>}
      <span className="xml-punct">{close}</span>
    </>
  );
}

function EndTag({ name }: { name: string }) {
  return <span className="xml-tag">{`</${name}>`}</span>;
}

function LeafRow({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <div className="cfg-row" style={indent(depth)}>
      <span className="cfg-chevron is-leaf" aria-hidden="true" />
      {children}
    </div>
  );
}

interface NodeProps {
  node: XmlNode;
  depth: number;
  forceOpen?: boolean;
}

function NodeView({ node, depth, forceOpen }: NodeProps) {
  switch (node.type) {
    case 'element':
      return <ElementNode node={node} depth={depth} forceOpen={forceOpen} />;
    case 'comment':
      return (
        <LeafRow depth={depth}>
          <span className="xml-comment">{`<!-- ${node.text} -->`}</span>
        </LeafRow>
      );
    case 'cdata':
      return (
        <LeafRow depth={depth}>
          <span className="xml-punct">{'<![CDATA['}</span>
          <span className="xml-text">{node.text}</span>
          <span className="xml-punct">{']]>'}</span>
        </LeafRow>
      );
    case 'instruction':
      return (
        <LeafRow depth={depth}>
          <span className="xml-instruction">{`<?${node.target} ${node.text}?>`}</span>
        </LeafRow>
      );
    default:
      return (
        <LeafRow depth={depth}>
          <span className="xml-text">{node.text}</span>
        </LeafRow>
      );
  }
}

function ElementNode({ node, depth, forceOpen }: { node: XmlElement; depth: number; forceOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(() => initialBranchOpen(forceOpen, depth));
  // Cap how many children mount at once; "show more" reveals the rest in chunks.
  const [visibleCount, setVisibleCount] = useState(BRANCH_INITIAL);
  const children = node.children;
  const hidden = children.length - visibleCount;

  // `<name/>` says the document holds nothing here, which is a different claim
  // from "what it holds is past the node budget" — so an element the budget
  // emptied is drawn open, with the ellipsis standing for what is not built.
  if (children.length === 0) {
    return node.omittedChildren > 0 ? (
      <LeafRow depth={depth}>
        <StartTag node={node} close=">" />
        <span className="xml-punct">…</span>
        <EndTag name={node.name} />
      </LeafRow>
    ) : (
      <LeafRow depth={depth}>
        <StartTag node={node} close="/>" />
      </LeafRow>
    );
  }

  return (
    <div className="cfg-node">
      <button
        type="button"
        className="cfg-row"
        style={indent(depth)}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`cfg-chevron${open ? ' is-open' : ''}`}>
          <ChevronRight />
        </span>
        <StartTag node={node} close=">" />
        {!open && (
          <>
            <span className="cfg-preview"> {t('items', { n: children.length })} </span>
            {node.omittedChildren > 0 && <span className="xml-punct">… </span>}
            <EndTag name={node.name} />
          </>
        )}
      </button>
      {open && (
        <div className="cfg-children">
          {children.slice(0, visibleCount).map((child, i) => (
            /* biome-ignore lint/suspicious/noArrayIndexKey: a node has no identity beyond its
               position among its siblings — two sibling elements may be identical in every other
               respect, which is what an XML list is. */
            <NodeView key={i} node={child} depth={depth + 1} forceOpen={forceOpen} />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              className="cfg-row cfg-more"
              style={indent(depth + 1)}
              onClick={() => setVisibleCount((c) => nextVisibleCount(c, children.length))}
            >
              <span className="cfg-chevron is-leaf" aria-hidden="true" />
              <span className="cfg-more-label">{t('showMore', { n: hidden })}</span>
            </button>
          )}
          {node.omittedChildren > 0 && (
            <LeafRow depth={depth + 1}>
              <span className="xml-punct">…</span>
            </LeafRow>
          )}
          <LeafRow depth={depth}>
            <EndTag name={node.name} />
          </LeafRow>
        </div>
      )}
    </div>
  );
}

export function XmlTree({ nodes, forceOpen }: { nodes: XmlNode[]; forceOpen?: boolean }) {
  return (
    <div className="cfg-tree xml-tree">
      {nodes.map((node, i) => (
        /* biome-ignore lint/suspicious/noArrayIndexKey: see the sibling list below — the same
           applies to the comments and instructions that sit beside the root element. */
        <NodeView key={i} node={node} depth={0} forceOpen={forceOpen} />
      ))}
    </div>
  );
}
