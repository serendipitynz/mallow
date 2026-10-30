import { useId, useMemo, useRef, useState } from 'react';
import { useLeaveReport, useRememberedScroll, type ViewMemory } from '../hooks/useViewMemory';
import { configFormat, parseConfig, shikiLangFor } from '../lib/config-parse';
import { useI18n } from '../lib/i18n';
import { captureScrollAnchor } from '../lib/scroll';
import type { FileEntry } from '../lib/types';
import { rememberedMode } from '../lib/visit-history';
import { ConfigTree } from './ConfigTree';
import { ErrorBanner } from './ErrorBanner';
import { CodeIcon, ListChevronsDownUpIcon, ListChevronsUpDownIcon, ListTreeIcon } from './icons';
import { Segmented } from './Segmented';
import { SourceView } from './SourceView';
import { ViewPanel } from './ViewPanel';

interface ConfigViewProps {
  source: string;
  file: FileEntry;
  memory: ViewMemory;
}

const MODES = ['tree', 'source'] as const;

export function ConfigView({ source, file, memory }: ConfigViewProps) {
  const { t } = useI18n();
  const format = useMemo(() => configFormat(file.name), [file.name]);
  const outcome = useMemo(() => parseConfig(source, format), [source, format]);
  // A document that no longer parses has no tree to come back to, whatever was
  // remembered.
  const [mode, setMode] = useState<'tree' | 'source'>(() =>
    outcome.ok ? (rememberedMode(memory.remembered, MODES) ?? 'tree') : 'source',
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  useRememberedScroll(scrollRef, memory.remembered?.anchor ?? null);
  useLeaveReport(memory, scrollRef, (scroller) => ({ mode, anchor: captureScrollAnchor(scroller, []) }));
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
    <div className="doc-scroll" ref={scrollRef}>
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
