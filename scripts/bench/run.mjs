#!/usr/bin/env node
// Drive TASK-70's launch, render and memory runs, and summarise them.
//
//   node scripts/bench/run.mjs measure --apps mallow,marky --targets small,large
//        [--runs 5] [--cold] [--route open|args] [--settle 20] [--out <file.jsonl>]
//   node scripts/bench/run.mjs summary <file.jsonl>...
//   node scripts/bench/run.mjs restore-mallow
//
// One run is: quit the app, launch it with `open -a <App> <target>` under
// launchwatch, which times when its window stops changing on screen, then read
// the memory of every process macOS holds the app responsible for once
// `--settle` seconds have passed since the launch. Runs are interleaved — run 1
// of every app and target, then run 2 — so a drift in the machine's state over
// the session lands on every app rather than on whichever was measured last.
//
// `--cold` runs `sudo purge` before each launch, so it is run by a person in a
// terminal of their own: purge needs root and an agent does not hold it.
//
// Needs scripts/bench/launchwatch.swift built at _sandbox/bench/launchwatch, and
// data from gen-data.mjs at _sandbox/bench/data.

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const benchDir = join(repoRoot, '_sandbox', 'bench');
const launchwatch = join(benchDir, 'launchwatch');
const dataDir = join(benchDir, 'data');

const APPS = {
  mallow: '/Applications/mallow.app',
  marky: '/Applications/Marky.app',
  mdviewer: '/Applications/mdviewer.app',
  skimdown: '/Applications/SkimDown.app',
};

const TARGETS = {
  small: 'docs/small/small.md',
  medium: 'docs/medium/medium.md',
  large: 'docs/large/large.md',
  mermaid: 'docs/mermaid/mermaid.md',
  'tree-100': 'tree-100',
  'tree-1000': 'tree-1000',
};

// mallow restores every window open at quit and checks for an update at launch;
// both would make a run measure something other than opening one document. The
// reader's own settings are kept aside once and a copy with neither is put in
// place before every run, since mallow writes its session back as it runs.
const mallowSettings = join(homedir(), 'Library', 'Application Support', 'net.serenebach.mallow', 'settings.json');
const mallowBackup = join(benchDir, 'mallow-settings.backup.json');

function prepareMallow() {
  if (!existsSync(mallowBackup)) {
    copyFileSync(mallowSettings, mallowBackup);
  }
  const settings = JSON.parse(readFileSync(mallowBackup, 'utf8'));
  settings.windows = [];
  settings.autoCheckUpdates = false;
  writeFileSync(mallowSettings, JSON.stringify(settings, null, 2));
}

function restoreMallow() {
  if (!existsSync(mallowBackup)) {
    console.log('no backup to restore');
    return;
  }
  copyFileSync(mallowBackup, mallowSettings);
  console.log(`restored ${mallowSettings}`);
}

// Marky keeps every folder it was handed in a settings file it reopens at launch,
// and SkimDown remembers the file last selected per folder; each run starts from
// the state a fresh install has, so a run is not measuring the runs before it.
const markySettings = join(homedir(), 'Library', 'Application Support', 'marky', 'settings.json');

function resetState(app) {
  if (app === 'mallow') {
    prepareMallow();
  } else if (app === 'marky') {
    rmSync(markySettings, { force: true });
  } else if (app === 'skimdown') {
    spawnSync('defaults', ['delete', 'dev.jp27.SkimDown', 'lastSelectedMarkdownByFolder'], { stdio: 'ignore' });
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function appPids(appPath) {
  const out = execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
    .filter((m) => m?.[2].startsWith(`${appPath}/Contents/MacOS/`))
    .map((m) => Number(m[1]));
}

function responsiblePids(pid) {
  const out = execFileSync(launchwatch, ['procs', String(pid)], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map(Number);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// The WebKit services outlive the app by a moment; a launch while they are still
// up would find them warm, so a run waits for them too.
async function quit(appPath) {
  const pids = appPids(appPath);
  const all = pids.flatMap(responsiblePids);
  for (const pid of pids) {
    process.kill(pid, 'SIGTERM');
  }
  for (let waited = 0; all.some(alive) && waited < 10_000; waited += 100) {
    await sleep(100);
  }
  for (const pid of all.filter(alive)) {
    process.kill(pid, 'SIGKILL');
  }
  await sleep(2000);
}

function memory(pid) {
  const pids = responsiblePids(pid);
  const tmp = join(benchDir, 'footprint.json');
  spawnSync('footprint', ['-j', tmp, '--noCategories', ...pids.flatMap((p) => ['-p', String(p)])], {
    stdio: 'ignore',
  });
  const footprint = JSON.parse(readFileSync(tmp, 'utf8'));
  const rss = Object.fromEntries(
    execFileSync('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number)),
  );
  const procs = footprint.processes.map((p) => ({
    name: p.name,
    pid: p.pid,
    footprintMiB: p.footprint / 2 ** 20,
    rssMiB: (rss[p.pid] ?? 0) / 1024,
  }));
  return {
    footprintMiB: footprint['total footprint'] / 2 ** 20,
    rssMiB: procs.reduce((sum, p) => sum + p.rssMiB, 0),
    procs,
  };
}

function version(appPath) {
  return execFileSync('defaults', ['read', join(appPath, 'Contents', 'Info'), 'CFBundleShortVersionString'], {
    encoding: 'utf8',
  }).trim();
}

function flag(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

async function measure(args) {
  const apps = flag(args, '--apps', 'mallow').split(',');
  const targets = flag(args, '--targets', 'small').split(',');
  const runs = Number(flag(args, '--runs', '5'));
  const settle = Number(flag(args, '--settle', '20'));
  const cold = args.includes('--cold');
  const route = flag(args, '--route', 'open');
  const out = resolve(flag(args, '--out', join(benchDir, 'results', `${new Date().toISOString().slice(0, 10)}.jsonl`)));
  mkdirSync(join(dirname(out), 'png'), { recursive: true });

  for (const app of apps) {
    if (!APPS[app] || !existsSync(APPS[app])) {
      throw new Error(`unknown or missing app: ${app}`);
    }
  }
  for (const target of targets) {
    if (!TARGETS[target]) {
      throw new Error(`unknown target: ${target}`);
    }
  }
  const versions = Object.fromEntries(apps.map((app) => [app, version(APPS[app])]));

  for (let run = 1; run <= runs; run += 1) {
    for (const target of targets) {
      for (const app of apps) {
        const appPath = APPS[app];
        await quit(appPath);
        resetState(app);
        if (cold) {
          spawnSync('sudo', ['purge'], { stdio: 'inherit' });
          await sleep(3000);
        }
        const png = join(dirname(out), 'png', `${app}-${target}-${cold ? 'cold' : 'warm'}-${route}-${run}.png`);
        const started = Date.now();
        const watched = spawnSync(
          launchwatch,
          [
            'watch',
            '--app',
            appPath,
            '--file',
            join(dataDir, TARGETS[target]),
            '--route',
            route,
            '--seconds',
            '12',
            '--png',
            png,
          ],
          { encoding: 'utf8' },
        );
        const record = { app, version: versions[app], target, route, cold, run, at: new Date(started).toISOString() };
        if (watched.status !== 0) {
          record.error = watched.stderr.trim();
        } else {
          const { app: appPathWatched, ...watchedResult } = JSON.parse(watched.stdout);
          Object.assign(record, watchedResult, { appPath: appPathWatched });
          await sleep(Math.max(0, settle * 1000 - (Date.now() - started)));
          record.memory = memory(record.pid);
        }
        appendFileSync(out, `${JSON.stringify(record)}\n`);
        console.log(
          `${app} ${target} ${cold ? 'cold' : 'warm'} #${run}: ` +
            (record.error ??
              `paint ${record.firstPaintMs} ms, complete ${record.completeMs} ms${record.settled ? '' : ' (unsettled)'}, ` +
                `footprint ${record.memory.footprintMiB.toFixed(0)} MiB, rss ${record.memory.rssMiB.toFixed(0)} MiB`),
        );
      }
    }
  }
  for (const app of apps) {
    await quit(APPS[app]);
  }
  if (apps.includes('mallow')) {
    restoreMallow();
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summary(files) {
  const records = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const groups = new Map();
  for (const r of records) {
    // Records written before appPath was split out carry the bundle path in app.
    const name = r.app
      .split('/')
      .pop()
      .replace(/\.app$/, '')
      .toLowerCase();
    const key = `${name}\t${r.target}\t${r.route ?? 'open'}\t${r.cold ? 'cold' : 'warm'}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const cell = (values, digits = 0) =>
    values.length === 0
      ? 'N/A'
      : `${median(values).toFixed(digits)} (${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)})`;
  console.log(
    '| app | target | route | start | n | first paint ms | complete ms | footprint MiB | RSS sum MiB | WebKit procs |',
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [key, group] of groups) {
    const ok = group.filter((r) => !r.error);
    const unsettled = ok.filter((r) => !r.settled).length;
    const webkit = ok.map((r) => r.memory.procs.filter((p) => p.name.startsWith('com.apple.WebKit')).length);
    console.log(
      `| ${key.split('\t').join(' | ')} | ${ok.length}${group.length > ok.length ? ` (+${group.length - ok.length} failed)` : ''}` +
        `${unsettled ? `, ${unsettled} unsettled` : ''} | ${cell(ok.map((r) => r.firstPaintMs))} | ${cell(ok.map((r) => r.completeMs))} | ` +
        `${cell(ok.map((r) => r.memory.footprintMiB))} | ${cell(ok.map((r) => r.memory.rssMiB))} | ${webkit.length ? median(webkit) : 'N/A'} |`,
    );
  }
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'measure') {
  await measure(rest);
} else if (command === 'summary') {
  summary(rest);
} else if (command === 'restore-mallow') {
  restoreMallow();
} else {
  console.error('usage: run.mjs measure|summary|restore-mallow …');
  process.exit(2);
}
