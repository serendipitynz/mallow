import { useId, useMemo, useState } from 'react';
import { configFormat, parseConfig, shikiLangFor } from '../lib/config-parse';
import { useI18n } from '../lib/i18n';
import type { FileEntry } from '../lib/types';
import { ConfigTree } from './ConfigTree';
import { ErrorBanner } from './ErrorBanner';
import { CodeIcon, ListChevronsDownUpIcon, ListChevronsUpDownIcon, ListTreeIcon } from './icons';
import { Segmented } from './Segmented';
import { SourceView } from './SourceView';
import { ViewPanel } from './ViewPanel';

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
  const idBase = useId();

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
            <Segmented
              idBase={idBase}
              label={t('viewMode')}
              options={[
                { value: 'tree', label: t('tree'), icon: <ListTreeIcon /> },
                { value: 'source', label: t('source'), icon: <CodeIcon /> },
              ]}
              value={mode}
              onSelect={setMode}
            />
          )}
        </div>

        {outcome.ok ? (
          <ViewPanel idBase={idBase} selected={mode}>
            {mode === 'tree' ? (
              <ConfigTree key={treeKey} value={outcome.value} forceOpen={forceOpen} />
            ) : (
              <SourceView source={source} lang={shikiLangFor(format)} />
            )}
          </ViewPanel>
        ) : (
          <>
            <ErrorBanner format={format} error={outcome.error} />
            <SourceView source={source} lang={shikiLangFor(format)} errorLine={outcome.error.line} />
          </>
        )}
      </div>
    </div>
  );
}
