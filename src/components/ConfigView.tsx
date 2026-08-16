import { useMemo, useState } from 'react';
import { configFormat, parseConfig, shikiLangFor } from '../lib/config-parse';
import { useI18n } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { ConfigTree } from './ConfigTree';
import { ErrorBanner } from './ErrorBanner';
import { CodeIcon, ListChevronsDownUpIcon, ListChevronsUpDownIcon, ListTreeIcon } from './icons';
import { SourceView } from './SourceView';

interface ConfigViewProps {
  source: string;
  file: FileEntry;
}

export function ConfigView({ source, file }: ConfigViewProps) {
  const { t } = useI18n();
  const format = useMemo(() => configFormat(file.name), [file.name]);
  const outcome = useMemo(() => parseConfig(source, format), [source, format]);
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

  return (
    <div className="doc-scroll">
      <div className="doc cfg">
        <div className="doc__bar">
          {outcome.ok && mode === 'tree' && (
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
          {outcome.ok && (
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

        {!outcome.ok && <ErrorBanner format={format} error={outcome.error} />}

        {outcome.ok && mode === 'tree' ? (
          <ConfigTree key={treeKey} value={outcome.value} forceOpen={forceOpen} />
        ) : (
          <SourceView
            source={source}
            lang={shikiLangFor(format)}
            errorLine={outcome.ok ? undefined : outcome.error.line}
          />
        )}
      </div>
    </div>
  );
}
