#!/usr/bin/env node
// Bump the release version everywhere it is declared, then commit and tag.
//
// The version lives in four files (package.json, src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml, src-tauri/Cargo.lock). Tauri names the produced bundles
// after tauri.conf.json's version, NOT after the git tag, so bumping the tag
// alone yields a release whose assets carry the previous version's name. Doing
// all four edits plus the tag in one command is what keeps them from drifting.
//
// Usage:
//   pnpm release <patch|minor|major|X.Y.Z> [--push] [--dry-run]
//
// Editing is done with anchored regex replacements rather than parse/serialize
// round-trips, so no formatting or key order in the touched files can change.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const die = (msg) => {
  console.error(`error: ${msg}`)
  process.exit(1)
}

const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

/** git whose failure we handle ourselves, so its own diagnostics are noise. */
const gitQuiet = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

/** git that reports failure instead of throwing (for existence probes). */
const gitOk = (...args) => {
  try {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// --- arguments -------------------------------------------------------------

const usage = 'usage: pnpm release <patch|minor|major|X.Y.Z> [--push] [--dry-run]'

const argv = process.argv.slice(2)
const knownFlags = new Set(['--push', '--dry-run'])

// Reject anything option-shaped that we do not know, rather than ignoring it:
// otherwise a `--dryrun` typo reads as a plain release and commits and tags for
// real — the exact opposite of what the caller asked for.
const unknown = argv.filter((a) => a.startsWith('-') && !knownFlags.has(a))
if (unknown.length > 0) die(`unknown option: ${unknown.join(' ')}\n${usage}`)

const push = argv.includes('--push')
const dryRun = argv.includes('--dry-run')
const positional = argv.filter((a) => !a.startsWith('-'))

if (positional.length !== 1) die(usage)
const spec = positional[0]

// --- files that declare the version ---------------------------------------

const targets = [
  {
    file: 'package.json',
    // First top-level "version" key; the dependency blocks have none.
    find: /^(\s*"version":\s*")([^"]+)(")/m,
  },
  {
    file: 'src-tauri/tauri.conf.json',
    find: /^(\s*"version":\s*")([^"]+)(")/m,
  },
  {
    file: 'src-tauri/Cargo.toml',
    // Only the [package] version — dependency versions come later in the file.
    find: /(\[package\][\s\S]*?\nversion = ")([^"]+)(")/,
  },
  {
    file: 'src-tauri/Cargo.lock',
    // The lock file lists every crate; anchor on our own package entry.
    find: /(name = "mallow"\nversion = ")([^"]+)(")/,
  },
]

const read = (t) => {
  const path = join(root, t.file)
  const text = readFileSync(path, 'utf8')
  const m = text.match(t.find)
  if (!m) die(`could not find a version to replace in ${t.file}`)
  return { path, text, current: m[2] }
}

const states = targets.map((t) => ({ ...t, ...read(t) }))

// package.json is the reference; a mismatch means a previous bump was partial.
const current = states[0].current
const drifted = states.filter((s) => s.current !== current)
if (drifted.length > 0) {
  console.warn(
    `warning: versions differ before the bump (package.json ${current}; ` +
      drifted.map((s) => `${s.file} ${s.current}`).join(', ') +
      ') — all files will be set to the new version',
  )
}

// --- resolve the new version ----------------------------------------------

const semver = /^(\d+)\.(\d+)\.(\d+)$/

let next
if (['patch', 'minor', 'major'].includes(spec)) {
  const m = current.match(semver)
  if (!m) die(`cannot bump non-semver current version "${current}"; pass X.Y.Z`)
  const [major, minor, patch] = m.slice(1).map(Number)
  next =
    spec === 'major'
      ? `${major + 1}.0.0`
      : spec === 'minor'
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`
} else {
  // Tauri rejects non-semver versions at bundle time, so validate here.
  if (!semver.test(spec)) die(`"${spec}" is not X.Y.Z`)
  next = spec
}

const tag = `v${next}`

// --- preflight -------------------------------------------------------------

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
let defaultBranch = 'main'
try {
  defaultBranch = gitQuiet('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
    .split('/')
    .pop()
} catch {
  // No origin/HEAD ref locally; fall back to main.
}
if (branch !== defaultBranch) {
  die(`on branch "${branch}"; release from "${defaultBranch}"`)
}

if (git('status', '--porcelain') !== '') {
  die('working tree is dirty; commit or stash first')
}

if (gitOk('rev-parse', '-q', '--verify', `refs/tags/${tag}`)) {
  die(`tag ${tag} already exists locally`)
}
// Best effort: a network failure here must not block a release.
try {
  if (gitQuiet('ls-remote', '--tags', 'origin', tag) !== '') {
    die(`tag ${tag} already exists on origin`)
  }
} catch {
  console.warn(`warning: could not reach origin to check for ${tag}`)
}

console.log(`${current} -> ${next} (tag ${tag})`)

if (dryRun) {
  for (const s of states) console.log(`  would update ${s.file}`)
  console.log(`  would commit and tag ${tag}`)
  process.exit(0)
}

// --- write, commit, tag ----------------------------------------------------

for (const s of states) {
  writeFileSync(s.path, s.text.replace(s.find, `$1${next}$3`))
  console.log(`  updated ${s.file}`)
}

// Re-read to prove every file actually carries the new version; a silently
// missed file is exactly the failure this script exists to prevent.
for (const t of targets) {
  const after = read(t).current
  if (after !== next) die(`${t.file} still reads ${after} after the update`)
}

git('add', ...targets.map((t) => t.file))
git(
  'commit',
  '-m',
  `chore(release): ${tag}`,
  '-m',
  'Tauri names the release bundles after tauri.conf.json rather than the git\n' +
    'tag, so every version declaration has to move together for the tagged\n' +
    'release to ship assets that match its tag.',
)
git('tag', '-a', tag, '-m', `mallow ${tag}`)
console.log(`  committed and tagged ${tag}`)

if (push) {
  git('push', 'origin', branch)
  git('push', 'origin', tag)
  console.log(`  pushed ${branch} and ${tag}; the release workflow will start`)
} else {
  console.log(`\nnext: git push origin ${branch} && git push origin ${tag}`)
}
