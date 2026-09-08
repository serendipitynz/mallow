import { describe, expect, it } from 'vitest';
import { affectsPaper } from './affects-paper.mjs';

/* The rule's wrong answer is silent: skipping the paper job on a change that
   alters the paper merges the regression unmeasured. These are the three files
   review caught the first two versions missing, plus the cases the rule exists to
   skip. */
describe('affectsPaper', () => {
  it('runs for the files that obviously make the paper', () => {
    expect(affectsPaper(['src/styles/print.scss'])).toHaveLength(1);
    expect(affectsPaper(['src-tauri/src/pdf.rs'])).toHaveLength(1);
    expect(affectsPaper(['src/components/MarkdownView.tsx'])).toHaveLength(1);
  });

  it('runs for the three that earlier versions of this rule missed', () => {
    // Most of what the paper looks like.
    expect(affectsPaper(['src/styles/markdown.scss'])).toHaveLength(1);
    // Registers the command the paper is written by.
    expect(affectsPaper(['src-tauri/src/lib.rs'])).toHaveLength(1);
    // Owns the element the app mounts into, so a sibling of #root can reach paper.
    expect(affectsPaper(['index.html'])).toHaveLength(1);
  });

  it('runs for the instrument itself and for the workflow', () => {
    expect(affectsPaper(['scripts/paper/measure.mjs'])).toHaveLength(1);
    expect(affectsPaper(['scripts/paper/print-pagebreaks.md'])).toHaveLength(1);
    expect(affectsPaper(['.github/workflows/check.yml'])).toHaveLength(1);
  });

  it('runs for a dependency change, which can move a renderer under the document', () => {
    expect(affectsPaper(['pnpm-lock.yaml'])).toHaveLength(1);
    expect(affectsPaper(['src-tauri/Cargo.lock'])).toHaveLength(1);
  });

  // What the rule is for: the changes this repository makes most often.
  it('skips documentation, the backlog and the other workflows', () => {
    expect(
      affectsPaper([
        'AGENTS.md',
        'AGENTS.ja.md',
        'README.md',
        'backlog/tasks/task-30 - x.md',
        'backlog/decisions/decision-14 - y.md',
        '.github/workflows/release.yml',
        'THIRD-PARTY-NOTICES.md',
      ]),
    ).toEqual([]);
  });

  it('runs when one paper file rides along with documentation', () => {
    expect(affectsPaper(['AGENTS.md', 'src/styles/print.scss'])).toEqual(['src/styles/print.scss']);
  });

  // A prefix must not match a sibling that merely starts with the same letters.
  it('matches whole path segments rather than name prefixes', () => {
    expect(affectsPaper(['src-tauri/gen/schemas/desktop-schema.json'])).toEqual([]);
    expect(affectsPaper(['scripts/gen-third-party-notices.mjs'])).toEqual([]);
  });
});
