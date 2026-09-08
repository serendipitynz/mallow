import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'measure-paper.mjs');

function run(args) {
  try {
    execFileSync('node', [script, ...args], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, stderr: '' };
  } catch (error) {
    return { code: error.status, stderr: error.stderr ?? '' };
  }
}

/* These cases end before poppler is reached, which is what lets them run
   anywhere. Exit 3 throughout: the instrument could not measure, which a CI step
   has to be able to tell from a paper that failed (1). */
describe('measure-paper argument handling', () => {
  // The finding this test exists for: an unknown platform skipped both the
  // type-size check and the Windows header check and reported PASS, so a typo in
  // the CI matrix would have read as a good paper.
  it('refuses an unknown --os rather than measuring nothing', () => {
    const { code, stderr } = run(['x.pdf', '--os', 'macosx']);
    expect(code).toBe(3);
    expect(stderr).toContain('--os must be one of');
  });

  it('refuses an unknown --theme', () => {
    expect(run(['x.pdf', '--os', 'macos', '--theme', 'sepia']).code).toBe(3);
  });

  it('refuses a flag with no value', () => {
    expect(run(['x.pdf', '--os']).code).toBe(3);
  });

  it('refuses a PDF that is not there, before trying to read it', () => {
    const { code, stderr } = run(['no-such-file.pdf', '--os', 'linux']);
    expect(code).toBe(3);
    expect(stderr).toContain('no such PDF');
  });

  it('asks for a PDF when given none', () => {
    expect(run([]).code).toBe(3);
  });
});
