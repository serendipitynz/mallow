import { describe, expect, it } from 'vitest';
import {
  buildXmlTree,
  type DomNodeLike,
  XML_MAX_ATTRIBUTES,
  XML_MAX_NODES,
  XML_MAX_VALUE_CHARS,
  type XmlElement,
  type XmlNode,
  xmlErrorInfo,
} from './xml-tree';

// Stand-ins for the DOM the WebView's DOMParser returns, which Node has no
// implementation of. They carry exactly what `DomNodeLike` declares, so what the
// transform is tested against and what it is given at runtime cannot diverge
// without TypeScript saying so.
function el(name: string, attributes: Record<string, string> = {}, children: DomNodeLike[] = []): DomNodeLike {
  return {
    nodeType: 1,
    nodeName: name,
    nodeValue: null,
    attributes: Object.entries(attributes).map(([n, value]) => ({ name: n, value })),
    childNodes: children,
  };
}

function leaf(nodeType: number, nodeName: string, nodeValue: string): DomNodeLike {
  return { nodeType, nodeName, nodeValue, childNodes: [] };
}

const text = (value: string) => leaf(3, '#text', value);
const cdata = (value: string) => leaf(4, '#cdata-section', value);
const comment = (value: string) => leaf(8, '#comment', value);
const instruction = (target: string, value: string) => leaf(7, target, value);
const doctype = (name: string) => leaf(10, name, '');

function doc(children: DomNodeLike[]): DomNodeLike {
  return { nodeType: 9, nodeName: '#document', nodeValue: null, childNodes: children };
}

function elementAt(nodes: XmlNode[], index: number): XmlElement {
  const node = nodes[index];
  if (node.type !== 'element') {
    throw new Error(`expected an element at ${index}, got ${node.type}`);
  }
  return node;
}

describe('buildXmlTree', () => {
  it('keeps elements, their attributes and their text in document order', () => {
    const tree = buildXmlTree(
      doc([
        instruction('xml-stylesheet', 'href="a.xsl"'),
        el('note', { id: '1', lang: 'ja' }, [el('to', {}, [text('Alice')]), el('body', {}, [text('hi')])]),
      ]),
    );

    expect(tree.nodes.map((n) => n.type)).toEqual(['instruction', 'element']);
    const note = elementAt(tree.nodes, 1);
    expect(note.name).toBe('note');
    expect(note.attributes).toEqual([
      { name: 'id', value: '1' },
      { name: 'lang', value: 'ja' },
    ]);
    expect(note.children.map((c) => (c.type === 'element' ? c.name : c.type))).toEqual(['to', 'body']);
    expect(elementAt(note.children, 0).children).toEqual([{ type: 'text', text: 'Alice' }]);
    // The two attributes count as nodes too, alongside the three elements, the
    // instruction and the two text nodes.
    expect(tree.nodeCount).toBe(8);
    expect(tree.omittedNodes).toBe(0);
  });

  it('drops whitespace-only text and the doctype, and keeps comments and CDATA', () => {
    const tree = buildXmlTree(
      doc([doctype('plist'), el('root', {}, [text('\n  '), comment(' why '), cdata('  \n  '), text('  kept  ')])]),
    );

    expect(tree.nodes).toHaveLength(1);
    expect(elementAt(tree.nodes, 0).children).toEqual([
      { type: 'comment', text: 'why' },
      { type: 'cdata', text: '' },
      { type: 'text', text: 'kept' },
    ]);
  });

  it('counts every node but builds no more than the cap', () => {
    const extra = 250;
    const children = Array.from({ length: XML_MAX_NODES + extra }, (_, i) => el(`item${i}`));
    const tree = buildXmlTree(doc([el('root', {}, children)]));

    const root = elementAt(tree.nodes, 0);
    // The root itself takes one from the budget, so one child less is built.
    expect(root.children).toHaveLength(XML_MAX_NODES - 1);
    expect(tree.nodeCount).toBe(XML_MAX_NODES + extra + 1);
    expect(tree.omittedNodes).toBe(extra + 1);
  });

  it('shows no more than the attribute cap on one element, and says so on the element', () => {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < XML_MAX_ATTRIBUTES + 25; i++) {
      attributes[`a${i}`] = String(i);
    }
    const tree = buildXmlTree(doc([el('root', attributes, [el('child')])]));

    const root = elementAt(tree.nodes, 0);
    expect(root.attributes).toHaveLength(XML_MAX_ATTRIBUTES);
    expect(root.omittedAttributes).toBe(25);
    // The cap bounds the row; the ones it drops are still the document's, so
    // they are counted and the child is still built.
    expect(tree.omittedNodes).toBe(25);
    expect(root.children).toHaveLength(1);
  });

  it('spends the node budget on attributes too, and reports the rest as omitted', () => {
    const wide = Array.from({ length: 400 }, (_, i) => {
      const attributes: Record<string, string> = {};
      for (let a = 0; a < XML_MAX_ATTRIBUTES; a++) {
        attributes[`a${a}`] = String(a);
      }
      return el(`row${i}`, attributes);
    });
    const tree = buildXmlTree(doc([el('root', {}, wide)]));

    // 400 rows of 64 attributes is 26,000 nodes with the elements — over the
    // budget, which no per-element cap would have caught.
    expect(tree.nodeCount).toBe(1 + 400 * (1 + XML_MAX_ATTRIBUTES));
    expect(tree.omittedNodes).toBe(tree.nodeCount - XML_MAX_NODES);
    expect(elementAt(tree.nodes, 0).children.length).toBeLessThan(400);
  });

  it('clips a long value, counts the clip, and never splits a surrogate pair', () => {
    const long = 'a'.repeat(XML_MAX_VALUE_CHARS + 10);
    // The pair straddles the cap: its high half is the last unit inside it.
    const straddling = `${'b'.repeat(XML_MAX_VALUE_CHARS - 1)}😀tail`;
    const tree = buildXmlTree(doc([el('root', { note: long }, [text(straddling)])]));

    const root = elementAt(tree.nodes, 0);
    expect(root.attributes[0].value).toBe(`${'a'.repeat(XML_MAX_VALUE_CHARS)}…`);
    const kept = root.children[0];
    expect(kept).toEqual({ type: 'text', text: `${'b'.repeat(XML_MAX_VALUE_CHARS - 1)}…` });
    expect(tree.clippedValues).toBe(2);
  });

  it('walks nesting deeper than a recursive walk could', () => {
    const depth = 100_000;
    let node = el('leaf');
    for (let i = 0; i < depth; i++) {
      node = el(`level${i}`, {}, [node]);
    }

    const tree = buildXmlTree(doc([node]));
    expect(tree.nodeCount).toBe(depth + 1);
    expect(tree.omittedNodes).toBe(depth + 1 - XML_MAX_NODES);
  });

  it('returns an empty tree for a document with nothing to show', () => {
    expect(buildXmlTree(doc([]))).toEqual({ nodes: [], nodeCount: 0, omittedNodes: 0, clippedValues: 0 });
  });
});

describe('xmlErrorInfo', () => {
  it('reads the position out of the WebKit / Chromium wording', () => {
    const info = xmlErrorInfo(
      'This page contains the following errors:error on line 2 at column 6: Opening and ending tag mismatch: a line 1 and b\nBelow is a rendering of the page up to the first error.',
    );
    expect(info.line).toBe(2);
    expect(info.column).toBe(6);
    expect(info.message).toBe('error on line 2 at column 6: Opening and ending tag mismatch: a line 1 and b');
  });

  it('reads the position out of the Gecko wording', () => {
    const info = xmlErrorInfo('XML Parsing Error: mismatched tag\nLocation: file:///t.xml\nLine Number 3, Column 5:');
    expect(info.line).toBe(3);
    expect(info.column).toBe(5);
  });

  // The engine is not required to give a position, and this is the path that
  // takes: the caller must show the banner with no line rather than invent one.
  it('yields a message with no position when the engine names none', () => {
    const info = xmlErrorInfo('  Document is  empty\n');
    expect(info).toEqual({ message: 'Document is empty' });
    expect(info.line).toBeUndefined();
  });
});
