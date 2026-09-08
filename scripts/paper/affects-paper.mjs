#!/usr/bin/env node
// Whether a set of changed files can change the paper.
//
// **Extracted from the workflow rather than written inline there**, because the
// question has a wrong answer that is silent: too narrow a rule skips the paper
// job on a change that alters the paper, and the regression merges unmeasured.
// A rule in a file can be tested; the same rule in a YAML `grep` cannot.
//
// **Deliberately coarse.** The first version listed the files that obviously make
// the paper — the print stylesheet, the three platform arms, MarkdownView — and
// review found two it had already missed (`src/styles/markdown.scss`, which is
// most of what the paper looks like, and `src-tauri/src/lib.rs`, which registers
// the command) and then a third (`index.html`, which owns the element the app
// mounts into). Any list of that shape drifts the same way. So everything that
// builds or renders the document is in, and what stays out is documentation, the
// backlog and the other workflows — which is most of what this repository's pull
// requests touch.
//
// Usage: `affects-paper.mjs < changed-files.txt` — exits 0 if the paper job
// should run, 1 if it can be skipped. `--list` prints the matching paths.

/** Prefixes and exact paths whose change can reach the paper. */
export const PAPER_PATHS = [
  'src/', // every view, style and library the document is rendered by
  'src-tauri/src/', // the export command, the commands it needs, the app menu
  'src-tauri/build.rs', // the build-time switch the unattended mode is behind
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json', // the CSP and the window the paper is made in
  'scripts/paper/', // the fixture, the measurement and this rule
  'index.html', // the document shell the app mounts into
  'package.json',
  'pnpm-lock.yaml',
  'vite.config.ts',
  '.github/workflows/check.yml',
];

export function affectsPaper(changed) {
  return changed.filter((path) => PAPER_PATHS.some((prefix) => path === prefix || path.startsWith(prefix)));
}

// Run only as a script, not when a test imports the rule above.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*?(?=\/scripts\/)/, ''))) {
  const input = await new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
  });
  const matched = affectsPaper(input.split('\n').filter(Boolean));
  if (process.argv.includes('--list')) {
    process.stdout.write(matched.map((path) => `${path}\n`).join(''));
  }
  process.exit(matched.length > 0 ? 0 : 1);
}
