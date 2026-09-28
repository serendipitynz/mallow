import type { ReactNode } from 'react';
import { segmentedOptionId } from './Segmented';

/** What the view switch shows, named by the option that is chosen. A Tab stop of
 *  its own, so the keyboard reaches a view with nothing focusable inside — the
 *  source view, the table — and can scroll it from there. */
export function ViewPanel({ idBase, selected, children }: { idBase: string; selected: string; children: ReactNode }) {
  return (
    <section
      className="view-panel"
      aria-labelledby={segmentedOptionId(idBase, selected)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the focus is what lets the keyboard scroll this view; see above.
      tabIndex={0}
    >
      {children}
    </section>
  );
}
