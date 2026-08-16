import { useMemo, useState } from 'react';
import { useT } from '../lib/i18n';
import { buildXmlTree, XML_MAX_VALUE_CHARS, type XmlErrorInfo, xmlErrorInfo } from '../lib/xml-tree';
import { ErrorBanner } from './ErrorBanner';
import { CodeIcon, ListChevronsDownUpIcon, ListChevronsUpDownIcon, ListTreeIcon } from './icons';
import { SourceView } from './SourceView';
import { XmlTree } from './XmlTree';

/**
 * XML (and the plist / xsd / xsl that are XML) as a tree, with the source view
 * as the other half of the toggle. The parse is the WebView's own `DOMParser`,
 * which adds no dependency and executes nothing it reads; this component is the
 * only place that touches it, so everything downstream stays testable under Node
 * — see `lib/xml-tree`.
 */

const MIME = 'text/xml';

type ParseOutcome = { ok: true; doc: Document } | { ok: false; error: XmlErrorInfo };

/**
 * The namespace this engine puts its `<parsererror>` in, learned by parsing a
 * document that cannot be valid. Nothing in the DOM reports that a parse failed,
 * and the element's name alone cannot stand in for it: a document is free to
 * contain an element called `parsererror` of its own, and it would then be read
 * as an error against a document that parsed. Learned once, since the answer is
 * the engine's and cannot change while the app runs.
 */
let errorNamespace: string | null | undefined;

function parserErrorNamespace(parser: DOMParser): string | null {
  if (errorNamespace === undefined) {
    errorNamespace = parser.parseFromString('<', MIME).getElementsByTagName('parsererror')[0]?.namespaceURI ?? null;
  }
  return errorNamespace;
}

function parseXml(source: string): ParseOutcome {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, MIME);
  const namespace = parserErrorNamespace(parser);
  // Without a namespace to match on, the name is all there is — a worse test,
  // but a better outcome than reporting nothing on an engine we did not expect.
  const failure =
    namespace === null
      ? doc.getElementsByTagName('parsererror')[0]
      : doc.getElementsByTagNameNS(namespace, 'parsererror')[0];
  if (failure) {
    return { ok: false, error: xmlErrorInfo(failure.textContent ?? '') };
  }
  return { ok: true, doc };
}

export function XmlView({ source }: { source: string }) {
  const t = useT();
  const outcome = useMemo(() => parseXml(source), [source]);
  const tree = useMemo(() => (outcome.ok ? buildXmlTree(outcome.doc) : null), [outcome]);
  const [mode, setMode] = useState<'tree' | 'source'>(outcome.ok ? 'tree' : 'source');
  // Bumping the key remounts the tree so a new forceOpen applies to every node.
  const [treeKey, setTreeKey] = useState(0);
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);

  function expandAll() {
    setForceOpen(true);
    setTreeKey((k) => k + 1);
  }
  function collapseAll() {
    setForceOpen(false);
    setTreeKey((k) => k + 1);
  }

  const notice: string[] = [];
  if (tree !== null && tree.omittedNodes > 0) {
    notice.push(t('xmlNodesOmitted', { n: tree.omittedNodes }));
  }
  if (tree !== null && tree.clippedValues > 0) {
    notice.push(t('xmlClippedValues', { n: tree.clippedValues, chars: XML_MAX_VALUE_CHARS }));
  }
  if (notice.length > 0) {
    notice.push(t('xmlTruncatedHint'));
  }

  return (
    <div className="doc-scroll">
      <div className="doc xml-doc">
        <div className="doc__bar">
          {tree !== null && mode === 'tree' && (
            /* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
               button cluster; <fieldset> is for form controls and requires a <legend>, while the
               label is already carried by aria-label. */
            <div className="cfg-expand" role="group" aria-label={t('expandControls')}>
              <button
                type="button"
                className="icon-btn"
                title={t('expandAll')}
                aria-label={t('expandAll')}
                onClick={expandAll}
              >
                <ListChevronsUpDownIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t('collapseAll')}
                aria-label={t('collapseAll')}
                onClick={collapseAll}
              >
                <ListChevronsDownUpIcon />
              </button>
            </div>
          )}
          {tree !== null && (
            /* biome-ignore lint/a11y/useSemanticElements: see the expand-controls group above. */
            <div className="seg" role="group" aria-label={t('viewMode')}>
              <button
                type="button"
                className={`btn${mode === 'tree' ? ' is-active' : ''}`}
                title={t('tree')}
                aria-label={t('tree')}
                aria-pressed={mode === 'tree'}
                onClick={() => setMode('tree')}
              >
                <ListTreeIcon />
              </button>
              <button
                type="button"
                className={`btn${mode === 'source' ? ' is-active' : ''}`}
                title={t('source')}
                aria-label={t('source')}
                aria-pressed={mode === 'source'}
                onClick={() => setMode('source')}
              >
                <CodeIcon />
              </button>
            </div>
          )}
        </div>

        {!outcome.ok && <ErrorBanner format="XML" error={outcome.error} />}

        {tree !== null && mode === 'tree' ? (
          <>
            {/* A plain <p>, like the source and table notices: the text is
                computed once per mount, so a live region has nothing to announce. */}
            {notice.length > 0 && <p className="xml-notice">{notice.join(' ')}</p>}
            {tree.nodes.length === 0 ? (
              <p className="xml-empty">{t('empty')}</p>
            ) : (
              <XmlTree key={treeKey} nodes={tree.nodes} forceOpen={forceOpen} />
            )}
          </>
        ) : (
          // `errorLine` is undefined whenever the engine's message named no
          // position, and nothing is then flagged — the view must not point at a
          // line it was not told about.
          <SourceView source={source} lang="xml" errorLine={outcome.ok ? undefined : outcome.error.line} />
        )}
      </div>
    </div>
  );
}
