import { type CSSProperties, useState } from 'react';
import { BRANCH_INITIAL, initialBranchOpen, nextVisibleCount } from '../lib/config-tree';
import { useT } from '../lib/i18n';
import { ChevronRight } from './icons';

type ValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

function typeOf(value: unknown): ValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'object') return 'object';
  if (t === 'number' || t === 'boolean' || t === 'string') return t;
  // bigint / undefined / function — render as string-ish.
  return 'string';
}

function indent(depth: number): CSSProperties {
  return { '--cfg-indent': `${8 + depth * 14}px` } as CSSProperties;
}

function formatPrimitive(value: unknown, type: ValueType): string {
  if (type === 'string') return JSON.stringify(value);
  if (type === 'null') return 'null';
  return String(value);
}

function entriesOf(value: unknown, type: ValueType): Array<[string, unknown]> {
  if (type === 'array') return (value as unknown[]).map((v, i) => [String(i), v]);
  return Object.entries(value as Record<string, unknown>);
}

interface NodeProps {
  label?: string;
  value: unknown;
  depth: number;
  /** When set, every branch initializes to this open state (expand/collapse all). */
  forceOpen?: boolean;
}

function ValueNode({ label, value, depth, forceOpen }: NodeProps) {
  const type = typeOf(value);
  if (type === 'object' || type === 'array') {
    return <BranchNode label={label} value={value} type={type} depth={depth} forceOpen={forceOpen} />;
  }
  return (
    <div className="cfg-row cfg-leaf" style={indent(depth)}>
      <span className="cfg-chevron is-leaf" aria-hidden="true" />
      {label !== undefined && <span className="cfg-key">{label}</span>}
      {label !== undefined && <span className="cfg-punct">: </span>}
      <span className={`cfg-value cfg-value--${type}`}>{formatPrimitive(value, type)}</span>
    </div>
  );
}

function BranchNode({ label, value, type, depth, forceOpen }: NodeProps & { type: 'object' | 'array' }) {
  const t = useT();
  const [open, setOpen] = useState(() => initialBranchOpen(forceOpen, depth));
  // Cap how many children mount at once; "show more" reveals the rest in chunks.
  // Reset on remount (expand/collapse all bumps the tree key), so "expand all"
  // opens branches without ever bypassing this cap.
  const [visibleCount, setVisibleCount] = useState(BRANCH_INITIAL);
  const entries = entriesOf(value, type);
  const open_b = type === 'array' ? '[' : '{';
  const close_b = type === 'array' ? ']' : '}';
  const summary = type === 'array' ? t('items', { n: entries.length }) : t('keys', { n: entries.length });
  const hidden = entries.length - visibleCount;

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
        {label !== undefined && <span className="cfg-key">{label}</span>}
        {label !== undefined && <span className="cfg-punct">: </span>}
        <span className="cfg-bracket">{open_b}</span>
        {!open && (
          <>
            <span className="cfg-preview"> {summary} </span>
            <span className="cfg-bracket">{close_b}</span>
          </>
        )}
      </button>
      {open && (
        <div className="cfg-children">
          {entries.length === 0 ? (
            <div className="cfg-row cfg-empty" style={indent(depth + 1)}>
              {t('empty')}
            </div>
          ) : (
            <>
              {entries.slice(0, visibleCount).map(([k, v]) => (
                <ValueNode key={k} label={k} value={v} depth={depth + 1} forceOpen={forceOpen} />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  className="cfg-row cfg-more"
                  style={indent(depth + 1)}
                  onClick={() => setVisibleCount((c) => nextVisibleCount(c, entries.length))}
                >
                  <span className="cfg-chevron is-leaf" aria-hidden="true" />
                  <span className="cfg-more-label">{t('showMore', { n: hidden })}</span>
                </button>
              )}
            </>
          )}
          <div className="cfg-row cfg-bracket-row" style={indent(depth)}>
            <span className="cfg-chevron is-leaf" aria-hidden="true" />
            <span className="cfg-bracket">{close_b}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConfigTree({ value, forceOpen }: { value: unknown; forceOpen?: boolean }) {
  return (
    <div className="cfg-tree">
      <ValueNode value={value} depth={0} forceOpen={forceOpen} />
    </div>
  );
}
