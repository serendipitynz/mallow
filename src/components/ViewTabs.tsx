import { type ReactNode, useRef } from 'react';
import { tabKeyTarget } from '../lib/tab-nav';

export interface ViewTab<M extends string> {
  mode: M;
  label: string;
  icon: ReactNode;
}

interface ViewTabsProps<M extends string> {
  /** From the view's `useId()`; ties the tabs to the panel `ViewPanel` draws. */
  idBase: string;
  label: string;
  tabs: ViewTab<M>[];
  selected: M;
  onSelect: (mode: M) => void;
}

function tabId(idBase: string, mode: string): string {
  return `${idBase}-tab-${mode}`;
}

function panelId(idBase: string): string {
  return `${idBase}-panel`;
}

/** The switch between the views of one document. It swaps what the same place
 *  shows, which makes it a tab list rather than a row of toggles, and so it is one
 *  Tab stop that the arrows move inside (snz-design doc-9 §6.7). */
export function ViewTabs<M extends string>({ idBase, label, tabs, selected, onSelect }: ViewTabsProps<M>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const target = tabKeyTarget(event.key, index, tabs.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    tabRefs.current[target]?.focus();
  }

  return (
    <div className="view-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.mode}
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          type="button"
          role="tab"
          id={tabId(idBase, tab.mode)}
          className="view-tabs__tab"
          title={tab.label}
          aria-label={tab.label}
          aria-selected={tab.mode === selected}
          aria-controls={panelId(idBase)}
          tabIndex={tab.mode === selected ? 0 : -1}
          onClick={() => onSelect(tab.mode)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}

/** What the selected tab shows. A Tab stop of its own, so the keyboard reaches a
 *  view with nothing focusable inside — the source view, the table — and can
 *  scroll it from there. */
export function ViewPanel({ idBase, selected, children }: { idBase: string; selected: string; children: ReactNode }) {
  return (
    <div
      className="view-panel"
      role="tabpanel"
      id={panelId(idBase)}
      aria-labelledby={tabId(idBase, selected)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel is where Tab goes after the tab list; see above.
      tabIndex={0}
    >
      {children}
    </div>
  );
}
