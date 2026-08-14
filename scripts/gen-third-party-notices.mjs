#!/usr/bin/env node
// Generate THIRD-PARTY-NOTICES.md by collecting the licenses (and, where
// available, the full license texts) of every bundled dependency:
//   - npm production dependencies (the JS bundled into the WebView), via `pnpm licenses`
//   - Rust/Cargo dependencies (the native backend), via `cargo metadata`
//
// mallow itself is MIT (see LICENSE). All bundled deps are permissive
// (MIT / ISC / BSD / Apache-2.0 / CC0 / MPL-2.0 / etc.) — no GPL/LGPL/AGPL copyleft.
// This file satisfies the attribution requirement when distributing the built app.
//
// Identical license texts are stored once in the "License texts" appendix and
// referenced by id (T1, T2, …) to keep the file small.
//
// Run with: pnpm notices   (or: node scripts/gen-third-party-notices.mjs)

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'mallow';

// Common license-file names. Matched case-insensitively; dual-licensed packages
// (e.g. LICENSE-MIT + LICENSE-APACHE) contribute all matches.
const LICENSE_RE = /^(licen[sc]e|copying|notice|unlicense)([._-].*)?$/i;

// Registry of unique license texts -> { id, text }. Keyed by content hash.
const textRegistry = new Map();
let textSeq = 0;

function internText(text) {
  const key = createHash('sha1').update(text).digest('hex');
  let entry = textRegistry.get(key);
  if (!entry) {
    entry = { id: `T${++textSeq}`, text };
    textRegistry.set(key, entry);
  }
  return entry.id;
}

function readLicenseTextIds(dir) {
  if (!dir || !existsSync(dir)) {
    return [];
  }
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => LICENSE_RE.test(f)).sort();
  const ids = [];
  for (const f of files) {
    const p = join(dir, f);
    try {
      if (!statSync(p).isFile()) {
        continue;
      }
      const text = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trimEnd();
      if (text) {
        ids.push(internText(text));
      }
    } catch {
      /* ignore unreadable files */
    }
  }
  return [...new Set(ids)];
}

// Fence text so it renders verbatim; widen the fence if the text contains
// a triple backtick (standard license texts never do, but be safe).
function fence(text) {
  let ticks = '```';
  while (text.includes(ticks)) {
    ticks += '`';
  }
  return `${ticks}text\n${text}\n${ticks}`;
}

function renderEntry({ name, version, license, extra, textIds }) {
  const lines = [`### ${name}${version ? ` ${version}` : ''}`, ''];
  lines.push(`- License: ${license || 'See bundled text'}`);
  for (const [k, v] of Object.entries(extra || {})) {
    if (v) {
      lines.push(`- ${k}: ${v}`);
    }
  }
  if (textIds.length) {
    lines.push(`- License text: ${textIds.map((id) => `[${id}](#${id.toLowerCase()})`).join(', ')}`);
  } else {
    lines.push('- License text: _(none shipped in package; see SPDX identifier above)_');
  }
  lines.push('');
  return lines.join('\n');
}

// ---- npm production dependencies -------------------------------------------
function collectNpm() {
  const raw = execSync('pnpm licenses list --prod --json', {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  });
  const byLicense = JSON.parse(raw);
  const pkgs = [];
  for (const [, list] of Object.entries(byLicense)) {
    for (const e of list) {
      if (e.name === SELF) {
        continue;
      }
      const path0 = (e.paths || []).find(Boolean);
      const textIds = readLicenseTextIds(path0);
      let license = e.license && e.license !== 'Unknown' ? e.license : null;
      if (!license && path0 && existsSync(join(path0, 'package.json'))) {
        try {
          const pj = JSON.parse(readFileSync(join(path0, 'package.json'), 'utf8'));
          license = typeof pj.license === 'string' ? pj.license : license;
        } catch {
          /* ignore */
        }
      }
      pkgs.push({
        name: e.name,
        version: (e.versions || []).join(', '),
        license: license || 'Unknown (see bundled text)',
        extra: { Author: e.author, Homepage: e.homepage },
        textIds,
      });
    }
  }
  pkgs.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return pkgs;
}

// ---- Rust / Cargo dependencies ---------------------------------------------
function collectCargo() {
  const raw = execSync('cargo metadata --format-version 1', {
    cwd: join(root, 'src-tauri'),
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
  const meta = JSON.parse(raw);
  const pkgs = [];
  for (const p of meta.packages) {
    if (p.name === SELF) {
      continue;
    }
    const dir = p.manifest_path ? dirname(p.manifest_path) : null;
    pkgs.push({
      name: p.name,
      version: p.version,
      license: p.license || (p.license_file ? `See ${p.license_file}` : null),
      extra: { Authors: (p.authors || []).join(', '), Repository: p.repository },
      textIds: readLicenseTextIds(dir),
    });
  }
  pkgs.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return pkgs;
}

function licenseSummary(pkgs) {
  const counts = {};
  for (const p of pkgs) {
    counts[p.license] = (counts[p.license] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([lic, n]) => `  - ${lic}: ${n}`)
    .join('\n');
}

const npm = collectNpm();
const cargo = collectCargo();

const out = [];
out.push('# Third-Party Notices');
out.push('');
out.push(
  'mallow is distributed under the MIT License (see [LICENSE](LICENSE)). It bundles the',
  'open-source components listed below. Each entry gives the component’s license and links',
  'to the full license text (collected in the [License texts](#license-texts) appendix;',
  'identical texts are stored once and shared).',
);
out.push('');
out.push('All bundled dependencies are under permissive or weak-copyleft licenses');
out.push('(MIT / ISC / BSD / Apache-2.0 / CC0 / Unlicense / Unicode / MPL-2.0). None are strong');
out.push('copyleft (no GPL / LGPL / AGPL).');
out.push('');
out.push('> This file is generated. Regenerate with `pnpm notices` after changing dependencies.');
out.push('');
out.push('## Summary');
out.push('');
out.push(`- npm (production) dependencies: ${npm.length}`);
out.push(licenseSummary(npm));
out.push(`- Rust (Cargo) dependencies: ${cargo.length}`);
out.push(licenseSummary(cargo));
out.push('');
out.push('---');
out.push('');
out.push('## npm dependencies');
out.push('');
for (const p of npm) {
  out.push(renderEntry(p));
}
out.push('---');
out.push('');
out.push('## Rust (Cargo) dependencies');
out.push('');
for (const p of cargo) {
  out.push(renderEntry(p));
}
out.push('---');
out.push('');
out.push('## License texts');
out.push('');
out.push('Shared full license texts, referenced by id from the entries above.');
out.push('');
for (const { id, text } of textRegistry.values()) {
  out.push(`### ${id}`, '', fence(text), '');
}

const target = join(root, 'THIRD-PARTY-NOTICES.md');
writeFileSync(
  target,
  `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`,
);
console.log(
  `Wrote ${target}\n  npm deps:   ${npm.length}\n  cargo deps: ${cargo.length}\n  unique license texts: ${textRegistry.size}`,
);
