#!/usr/bin/env node
// Measure one exported PDF against procedure.md §3, and say pass or fail.
//
// This exists because TASK-30's "Nothing automated will verify the paper" lost
// its premise: `write_window_pdf` means mallow can put a PDF through the print
// pipeline itself, so the paper can be produced without a person at the keyboard
// (the unattended export) and the countable half of §3 can be read off it here.
// **The other half stays with a person** — whether the type reads comfortably and
// how a straddling table actually looks.
//
// Usage:
//   node scripts/paper/measure-paper.mjs <pdf> [--os macos|windows|linux]
//                                        [--theme light|dark] [--json]
//                                        [--baseline-key <key>]
//                                        [--baseline <path>] [--max-bytes <n>]
//
// Exit codes: 0 every check passed, 1 a check failed, 3 it could not measure
// (poppler missing, unreadable PDF) — the same three-way split the unattended
// export uses, so a CI step can tell "the paper is wrong" from "the instrument is
// not here".

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMarkersAreAbsentFromFixture, judgePaper, parseBboxWords } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const FIXTURE = resolve(here, 'print-pagebreaks.md');
// The original stays outside git (`_sandbox/` is ignored), which is why the copy
// beside this script exists at all — CI can only read the copy. Keeping the two
// in step is this script's job, so it says so rather than letting them drift.
const FIXTURE_ORIGIN = resolve(repoRoot, '_sandbox', 'samples', 'print-pagebreaks.md');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const PLATFORMS = ['macos', 'windows', 'linux'];
const THEMES = ['light', 'dark'];

const POPPLER_HINT = `poppler is required (pdfinfo, pdftotext):
  macOS    brew install poppler
  Linux    sudo apt-get install -y poppler-utils
  Windows  winget install --id oschwartz10612.Poppler  (or scoop install poppler)`;

function parseArgs(argv) {
  const args = { json: false, maxBytes: DEFAULT_MAX_BYTES, baseline: resolve(here, 'baseline.json') };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (
      arg === '--os' ||
      arg === '--theme' ||
      arg === '--baseline' ||
      arg === '--baseline-key' ||
      arg === '--max-bytes'
    ) {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        fail(3, `${arg} needs a value`);
      }
      if (arg === '--max-bytes') {
        args.maxBytes = Number(value);
      } else if (arg === '--baseline-key') {
        args.key = value;
      } else {
        args[arg.slice(2)] = value;
      }
    } else {
      rest.push(arg);
    }
  }
  args.pdf = rest[0];
  args.os ??= { darwin: 'macos', win32: 'windows' }[process.platform] ?? 'linux';
  args.theme ??= 'light';
  // An unknown platform is not a platform with no baseline: it would silently
  // skip the type-size check *and* the Windows header check and report PASS, so a
  // typo in the CI matrix would read as a good paper.
  if (!PLATFORMS.includes(args.os)) {
    fail(3, `--os must be one of ${PLATFORMS.join(', ')} — not ${args.os}`);
  }
  if (!THEMES.includes(args.theme)) {
    fail(3, `--theme must be one of ${THEMES.join(', ')} — not ${args.theme}`);
  }
  // **The key is the environment, not the platform.** Two machines running the
  // same OS substitute different fonts for this document, so a baseline taken on
  // one is not a measurement of the other — and a wrong baseline is worse than
  // none, because it can pass the very shrink the check is for. CI passes
  // `ci-<platform>`; a local run defaults to the platform and keeps its own.
  args.key ??= args.os;
  return args;
}

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

/** That the `pdftotext` on PATH is poppler's, and not another program with the
 *  same name.
 *
 *  **Measured on a CI runner**: it carries Xpdf's `pdftotext` 4.06, which has no
 *  `-bbox`, so the measurement ended in a usage screen and an exit code that says
 *  nothing about the paper. An instrument that cannot tell whose implementation it
 *  is reports the wrong thing confidently, which is worse than not running. */
function requirePoppler() {
  // `spawnSync` rather than `execFileSync`, because **poppler prints its banner
  // on stderr and exits 0** — reading stdout alone finds an empty string and
  // rejects the very implementation this is looking for.
  const probe = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') {
    fail(3, `pdftotext not found.\n${POPPLER_HINT}`);
  }
  const version = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
  if (!/poppler/i.test(version)) {
    fail(
      3,
      `the pdftotext on PATH is not poppler's, so it has no -bbox to measure with:\n${version.trim()}\n${POPPLER_HINT}`,
    );
  }
}

function poppler(tool, toolArgs) {
  try {
    return execFileSync(tool, toolArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail(3, `${tool} not found.\n${POPPLER_HINT}`);
    }
    fail(3, `${tool} could not read the PDF: ${error.message}`);
  }
}

function readBaseline(path) {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(3, `${path} is not readable JSON: ${error.message}`);
  }
}

function checkFixtureCopy() {
  if (!existsSync(FIXTURE)) {
    fail(3, `the fixture copy is missing: ${FIXTURE}`);
  }
  const fixture = readFileSync(FIXTURE, 'utf8');
  try {
    assertMarkersAreAbsentFromFixture(fixture);
  } catch (error) {
    fail(3, error.message);
  }
  if (existsSync(FIXTURE_ORIGIN) && readFileSync(FIXTURE_ORIGIN, 'utf8') !== fixture) {
    process.stderr.write(
      `warning: ${FIXTURE} and ${FIXTURE_ORIGIN} differ — the paper was measured against a document that is no longer the one you edit by hand\n`,
    );
  }
}

function pageSizeOf(info) {
  const line = info.split('\n').find((row) => row.startsWith('Page size:'));
  return line ? line.replace('Page size:', '').trim() : 'unknown';
}

function pagesOf(info) {
  const line = info.split('\n').find((row) => row.startsWith('Pages:'));
  return line ? Number(line.replace('Pages:', '').trim()) : 0;
}

function render(result, args) {
  const rows = result.checks
    .map((check) => `| ${check.ok ? (check.skipped ? '–' : '✓') : '✗'} | ${check.id} | ${check.detail} |`)
    .join('\n');
  const { records } = result;
  const extent = records.textExtentX;
  return [
    `**${args.os} / ${args.theme}** (baseline \`${args.key}\`) — ${result.ok ? 'PASS' : 'FAIL'}`,
    '',
    '| | check | detail |',
    '|---|---|---|',
    rows,
    '',
    `records: pages ${records.pages}, page size ${records.pageSize}, median word height ${
      records.medianWordHeight === null ? 'n/a' : records.medianWordHeight.toFixed(2)
    }, text x ${extent ? `${extent.min.toFixed(1)}–${extent.max.toFixed(1)}` : 'n/a'}, words on page 2 ${
      records.wordsOnPage2
    }, ${records.bytes} bytes`,
  ].join('\n');
}

const args = parseArgs(process.argv.slice(2));
if (!args.pdf) {
  fail(3, 'usage: measure-paper.mjs <pdf> [--os macos|windows|linux] [--theme light|dark] [--json]');
}
if (!existsSync(args.pdf)) {
  fail(3, `no such PDF: ${args.pdf}`);
}
checkFixtureCopy();
requirePoppler();

const info = poppler('pdfinfo', [args.pdf]);
const bbox = poppler('pdftotext', ['-bbox', args.pdf, '-']);
const result = judgePaper({
  os: args.os,
  key: args.key,
  bytes: statSync(args.pdf).size,
  maxBytes: args.maxBytes,
  pages: pagesOf(info),
  pageSize: pageSizeOf(info),
  words: parseBboxWords(bbox),
  baseline: readBaseline(args.baseline),
});

process.stdout.write(
  args.json
    ? `${JSON.stringify({ os: args.os, theme: args.theme, baselineKey: args.key, pdf: args.pdf, ...result }, null, 2)}\n`
    : `${render(result, args)}\n`,
);
process.exit(result.ok ? 0 : 1);
