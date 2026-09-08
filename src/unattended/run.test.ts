import { describe, expect, it } from 'vitest';
import { documentProblem } from './run';

/* Without this check a missing file and a `.csv` both end the same way: no
   markdown preview mounts, nothing reports a render, and the run spends its full
   minute before failing as "never rendered" — which says the paper timed out when
   the truth is that the argument was wrong. */
describe('documentProblem', () => {
  it('passes a markdown document that exists', () => {
    expect(documentProblem('/docs/report.md', true)).toBeNull();
    expect(documentProblem('/docs/report.markdown', true)).toBeNull();
  });

  it('names a document that is not there', () => {
    expect(documentProblem('/docs/missing.md', false)).toContain('does not exist');
  });

  // A supported kind that is not markdown is the case a kind check alone would
  // pass: mallow opens it, and it still has no paper.
  it('names a supported kind that has no paper', () => {
    const problem = documentProblem('/docs/sales.csv', true);
    expect(problem).toContain('csv');
    expect(problem).toContain('only markdown');
  });

  it('names a kind mallow does not open at all', () => {
    expect(documentProblem('/docs/archive.zip', true)).toContain('not a file kind mallow opens');
  });

  // Existence is checked first: a missing `.csv` is missing, and saying it has no
  // paper would send the reader looking at the wrong thing.
  it('reports absence before kind', () => {
    expect(documentProblem('/docs/sales.csv', false)).toContain('does not exist');
  });
});
