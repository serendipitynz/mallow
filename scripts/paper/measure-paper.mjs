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
//                                        [--baseline <path>] [--max-bytes <n>]
//
// Exit codes: 0 every check passed, 1 a check failed, 3 it could not measure
// (poppler missing, unreadable PDF) — the same three-way split the unattended
// export uses, so a CI step can tell "the paper is wrong" from "the instrument is
// not here".

import { execFileSync } from 'node:child_process';
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
    } else if (arg === '--os' || arg === '--theme' || arg === '--baseline' || arg === '--max-bytes') {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        fail(3, `${arg} needs a value`);
      }
      if (arg === '--max-bytes') {
        args.maxBytes = Number(value);
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
  return args;
}

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
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
    `**${args.os} / ${args.theme}** — ${result.ok ? 'PASS' : 'FAIL'}`,
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

const info = poppler('pdfinfo', [args.pdf]);
const bbox = poppler('pdftotext', ['-bbox', args.pdf, '-']);
const result = judgePaper({
  os: args.os,
  bytes: statSync(args.pdf).size,
  maxBytes: args.maxBytes,
  pages: pagesOf(info),
  pageSize: pageSizeOf(info),
  words: parseBboxWords(bbox),
  baseline: readBaseline(args.baseline),
});

process.stdout.write(
  args.json
    ? `${JSON.stringify({ os: args.os, theme: args.theme, pdf: args.pdf, ...result }, null, 2)}\n`
    : `${render(result, args)}\n`,
);
process.exit(result.ok ? 0 : 1);
