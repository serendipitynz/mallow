// Copies a kinari release into mallow as mallow's copy, and verifies the copy against its release (decision-19 §7).
//
// Run from mallow's root, with the kinari repository (serendipitynz/marp-theme-kinari) checked out beside it:
//   node scripts/kinari.mjs copy <version>
//   node scripts/kinari.mjs verify
//
// Both read kinari.css from the tag v<version> in that checkout, never from its working tree: mallow's copy names
// the one release it came from, and unreleased bytes have none. `verify` takes the version from the copy's first
// line. The unit test beside lib/kinari checks what a release has to carry; this checks the bytes are the release's.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KINARI_REPO = join(ROOT, '..', 'marp-theme-kinari');
const COPY = join(ROOT, 'src', 'slide-themes', 'kinari.css');
const SEMVER = /^\d+\.\d+\.\d+$/;
const STAMP = /^\/\* kinari (\S+) — https:\/\/github\.com\/serendipitynz\/marp-theme-kinari — /;

function released(version) {
  try {
    return execFileSync('git', ['-C', KINARI_REPO, 'show', `refs/tags/v${version}:kinari.css`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return undefined;
  }
}

// Line endings are normalised on both sides: a Windows checkout with core.autocrlf rewrites them without changing
// a value, and reporting that as drift would teach people to ignore the check.
const normalised = (bytes) => bytes.toString('utf8').replaceAll('\r\n', '\n');

const missing = (version) =>
  `v${version} has no kinari.css in ${KINARI_REPO} (check it out there, and git fetch --tags if the tag is missing)`;

function copy(version) {
  if (!SEMVER.test(version)) {
    return `version ${version} is not MAJOR.MINOR.PATCH`;
  }
  const bytes = released(version);
  if (bytes === undefined) {
    return missing(version);
  }
  const stamp = normalised(bytes).split('\n', 1)[0].match(STAMP);
  if (stamp?.[1] !== version) {
    return `v${version}'s kinari.css does not name v${version} on its first line`;
  }
  writeFileSync(COPY, bytes);
  console.log(`wrote ${COPY} from v${version}`);
  return null;
}

function verify() {
  const text = normalised(readFileSync(COPY));
  const version = text.split('\n', 1)[0].match(STAMP)?.[1];
  if (version === undefined || !SEMVER.test(version)) {
    return `${COPY}: the first line does not name a kinari release`;
  }
  const bytes = released(version);
  if (bytes === undefined) {
    return missing(version);
  }
  if (normalised(bytes) !== text) {
    return `${COPY}: differs from v${version}'s kinari.css (edited after it was copied)`;
  }
  console.log(`ok ${COPY}: matches v${version}'s kinari.css`);
  return null;
}

function main([command, ...args]) {
  let error;
  if (command === 'copy' && args.length === 1) {
    error = copy(args[0]);
  } else if (command === 'verify' && args.length === 0) {
    error = verify();
  } else {
    console.error('usage: node scripts/kinari.mjs copy <version> | node scripts/kinari.mjs verify');
    return 2;
  }
  if (error) {
    console.error(`!! ${error}`);
    return 1;
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
