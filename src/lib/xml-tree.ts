/**
 * An XML DOM → a bounded tree model, and an engine's `<parsererror>` text → a
 * normalized message with a position where it carries one. Pure logic +
 * tunables, kept apart from the React view so they can be unit-tested in a Node
 * environment — the same split as `lib/config-tree`, `lib/source-cap` and
 * `lib/delimited`.
 *
 * The document itself is parsed by the WebView's `DOMParser`, which Node does
 * not have. Everything here therefore takes {@link DomNodeLike}, a structural
 * subset a real `Document` satisfies and a test can write as an object literal,
 * so the transform is testable without a browser and the parse stays at the
 * component boundary.
 */

import { clipToChars } from './clip';

/**
 * Model nodes built at most, above which the walk counts without building.
 * Chosen against the same measurement decision-7 used for the table's cell
 * budget: this bounds the rows the tree can put in the DOM, and an attribute
 * counts as a node because it costs the same DOM as one.
 */
export const XML_MAX_NODES = 20_000;
/**
 * Attributes one element renders at most.
 *
 * The node budget bounds how many attributes exist but not how many land on one
 * *row*, and attributes render inline: without this, 25,000 of them are one
 * unwrapped line 200,000 characters wide. Measured across 826,427 elements in two
 * corpora (a projects tree with its `node_modules`, and `/Applications` +
 * `/usr/share` + `/Library`), no element carried more than 14 and none exceeded
 * 16, so this leaves better than 4× headroom — deliberately, because the two
 * errors are not symmetric: too low silently thins a real document, too high only
 * widens a row in a document nobody reads. Android layouts, which the corpora do
 * not cover, reach ~30 and still fit.
 */
export const XML_MAX_ATTRIBUTES = 64;
/**
 * Characters one text, comment, instruction or attribute value renders at most.
 * The node budget bounds how many values exist, not how long one is: a single
 * text node or attribute may hold the whole document, which would put megabytes
 * into one wrapping row.
 */
export const XML_MAX_VALUE_CHARS = 500;

// The DOM's own node-type numbers, which Node does not define.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

/** The part of a DOM node this transform reads. `Document`, `Element` and every
 *  other node satisfy it structurally; `attributes` is optional because only an
 *  element has one. */
export interface DomNodeLike {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  attributes?: ArrayLike<{ name: string; value: string }> | null;
  childNodes: ArrayLike<DomNodeLike>;
}

export interface XmlAttribute {
  name: string;
  value: string;
}

export type XmlNode =
  | {
      type: 'element';
      name: string;
      attributes: XmlAttribute[];
      /** Attributes the element carries beyond {@link XML_MAX_ATTRIBUTES}, so the
       *  row can mark that it was cut without the reader consulting the notice. */
      omittedAttributes: number;
      children: XmlNode[];
      /** Children the node budget ran out before: the same mark, for the case
       *  where an element that has content would otherwise be drawn as empty. */
      omittedChildren: number;
    }
  | { type: 'text' | 'cdata' | 'comment'; text: string }
  | { type: 'instruction'; target: string; text: string };

export type XmlElement = Extract<XmlNode, { type: 'element' }>;

export interface XmlTree {
  /** The document's top-level nodes: the root element, and any comment or
   *  instruction beside it. */
  nodes: XmlNode[];
  /** Nodes the document holds, before the cap — so this describes the document
   *  rather than the render. Whitespace-only text is not among them. */
  nodeCount: number;
  /** Nodes counted but not built. */
  omittedNodes: number;
  /** Built values clipped to {@link XML_MAX_VALUE_CHARS}. */
  clippedValues: number;
}

type NodeType = XmlNode['type'];

/**
 * The model type for a DOM node, or null for one the tree does not show.
 * Whitespace-only text is most of a pretty-printed document and says nothing a
 * tree can show — the indentation is already structure here. A CDATA section is
 * kept whatever it holds, because writing one is a statement that the text
 * matters. The doctype and anything else is dropped; none of them has children,
 * so dropping one drops nothing under it.
 */
function nodeTypeOf(node: DomNodeLike): NodeType | null {
  switch (node.nodeType) {
    case ELEMENT_NODE:
      return 'element';
    case TEXT_NODE:
      return (node.nodeValue ?? '').trim() === '' ? null : 'text';
    case CDATA_SECTION_NODE:
      return 'cdata';
    case COMMENT_NODE:
      return 'comment';
    case PROCESSING_INSTRUCTION_NODE:
      return 'instruction';
    default:
      return null;
  }
}

interface Frame {
  node: DomNodeLike;
  /** Where a built node is appended, or null inside a subtree past the cap. */
  out: XmlNode[] | null;
  /** The built element this node hangs under, so a child the cap drops can be
   *  recorded on the parent that will be drawn without it. Null at top level. */
  parent: XmlElement | null;
}

/**
 * Walk `root` into the model, bounded by {@link XML_MAX_NODES}.
 *
 * The walk is iterative rather than recursive because nesting depth here comes
 * from the document: 10 MiB of nested start tags is a stack overflow in a
 * recursive walk, and it is a document a viewer should survive rather than a
 * document it should refuse.
 */
export function buildXmlTree(root: DomNodeLike): XmlTree {
  const nodes: XmlNode[] = [];
  let nodeCount = 0;
  let built = 0;
  let clippedValues = 0;
  const stack: Frame[] = [];

  function pushChildren(node: DomNodeLike, out: XmlNode[] | null, parent: XmlElement | null): void {
    const children = node.childNodes;
    // Reversed, so the stack pops them back in document order.
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i], out, parent });
    }
  }

  function clip(value: string): string {
    if (value.length <= XML_MAX_VALUE_CHARS) {
      return value;
    }
    clippedValues += 1;
    return clipToChars(value, XML_MAX_VALUE_CHARS);
  }

  function buildAttributes(node: DomNodeLike): XmlAttribute[] {
    const kept: XmlAttribute[] = [];
    const attrs = node.attributes;
    if (!attrs) {
      return kept;
    }
    for (let i = 0; i < attrs.length; i++) {
      nodeCount += 1;
      // Counted and then skipped rather than leaving the loop, so an element
      // carrying a million attributes reports them all as omitted.
      if (kept.length >= XML_MAX_ATTRIBUTES || built >= XML_MAX_NODES) {
        continue;
      }
      built += 1;
      kept.push({ name: attrs[i].name, value: clip(attrs[i].value) });
    }
    return kept;
  }

  pushChildren(root, nodes, null);
  while (stack.length > 0) {
    const { node, out, parent } = stack.pop() as Frame;
    const type = nodeTypeOf(node);
    if (type === null) {
      continue;
    }
    nodeCount += 1;

    // Past the cap the node is counted but not built, and its subtree with it:
    // `nodeCount` then describes the document, at no allocation per node.
    if (out === null || built >= XML_MAX_NODES) {
      if (type === 'element') {
        nodeCount += node.attributes?.length ?? 0;
        pushChildren(node, null, null);
      }
      // A parent that was built is about to be drawn without this child, so it
      // has to be able to say so: an element drawn as `<name/>` asserts the
      // document holds nothing there, which is a different claim from "not all
      // of it is shown".
      if (parent !== null) {
        parent.omittedChildren += 1;
      }
      continue;
    }
    built += 1;

    if (type === 'element') {
      const attributes = buildAttributes(node);
      const element: XmlElement = {
        type,
        name: node.nodeName,
        attributes,
        omittedAttributes: (node.attributes?.length ?? 0) - attributes.length,
        children: [],
        omittedChildren: 0,
      };
      out.push(element);
      pushChildren(node, element.children, element);
    } else if (type === 'instruction') {
      out.push({ type, target: node.nodeName, text: clip((node.nodeValue ?? '').trim()) });
    } else if (type === 'cdata') {
      // Not trimmed, unlike a text node: a CDATA section is written to say that
      // its text is the document's rather than the serializer's, whitespace
      // included, so trimming it would drop what writing one asserts.
      out.push({ type, text: clip(node.nodeValue ?? '') });
    } else {
      // Trimmed at the ends only: what the ends carry is the indentation that
      // put the node on its own line, and the rest is the document's own text.
      out.push({ type, text: clip((node.nodeValue ?? '').trim()) });
    }
  }

  return { nodes, nodeCount, omittedNodes: nodeCount - built, clippedValues };
}

export interface XmlErrorInfo {
  message: string;
  /** Absent when the engine's text carries no position — see {@link xmlErrorInfo}. */
  line?: number;
  column?: number;
}

/** Sentences an engine wraps its own message in, which say nothing here. */
const BOILERPLATE = [
  /^This page contains the following errors:\s*/i,
  /\s*Below is a rendering of the page up to the first error\.?$/i,
  /^XML Parsing Error:\s*/i,
];

/**
 * How an engine writes the position. There is no API for it — the position only
 * ever exists as part of the message text — so it is read back out, and no
 * pattern is required to match.
 *
 * The first is libxml2's wording, which all three WebViews mallow ships on
 * (WKWebView, WebView2, WebKitGTK) parse XML with today. That is a fact about
 * the current engines, not a contract any of them offers, which is why the
 * second form and the no-position outcome are supported rather than assumed
 * away.
 */
const POSITIONS = [
  /error on line (\d+) at column (\d+)/i, // libxml2, via all three WebViews
  /line number (\d+),\s*column (\d+)/i, // Gecko's wording
];

/**
 * Normalize the text of a `<parsererror>` element into a message and, where the
 * engine put one there, a 1-based line and column.
 *
 * A missing position is a supported outcome, not a failure: the DOM gives no
 * structured position for an XML parse error, so an engine that words its
 * message differently yields a message alone, and the caller must not promise a
 * line it does not have.
 */
export function xmlErrorInfo(text: string): XmlErrorInfo {
  let message = text.replace(/\s+/g, ' ').trim();
  for (const pattern of BOILERPLATE) {
    message = message.replace(pattern, '').trim();
  }
  for (const pattern of POSITIONS) {
    const found = message.match(pattern);
    if (found) {
      return { message, line: Number(found[1]), column: Number(found[2]) };
    }
  }
  return { message };
}
