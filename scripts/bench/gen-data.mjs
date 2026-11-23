#!/usr/bin/env node
// Generate TASK-70's test documents and folder layouts.
//
// Usage: node scripts/bench/gen-data.mjs [outDir]   (default: _sandbox/bench/data)
//
// Generated rather than committed so that a 1 MB document and 1,000 files never
// enter the repository, and seeded so that every run, and every later re-run of
// the measurement, reads byte-identical input.
//
// Each document sits alone in its own folder: an app that lists the folder of
// the file it opens (mallow does) then lists one file, so the document's size and
// not its neighbours is what the render time measures.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = resolve(process.argv[2] ?? join(repoRoot, '_sandbox', 'bench', 'data'));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = (
  'viewer document folder render window tree outline source table code block heading link image ' +
  'measure launch memory process theme palette preview export print setting session restore ' +
  'width column paragraph quote list item value key file path change watch update release ' +
  'quickly slowly simply clearly every other first last small large plain local remote ' +
  'reads writes opens shows keeps takes gives finds moves holds returns builds'
).split(' ');
const JA = [
  'この文書は計測用に生成したものです。',
  '表示速度とメモリ使用量を比較します。',
  '見出しや表、コードブロックを含みます。',
  '同じ入力をすべてのアプリに与えます。',
];

function makeWriter(seed) {
  const random = rng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));

  const sentence = () => {
    const words = Array.from({ length: int(8, 18) }, () => pick(WORDS));
    if (random() < 0.15) {
      words[int(0, words.length - 1)] = `**${pick(WORDS)}**`;
    }
    if (random() < 0.1) {
      words[int(0, words.length - 1)] = `\`${pick(WORDS)}()\``;
    }
    if (random() < 0.08) {
      words[int(0, words.length - 1)] = `[${pick(WORDS)}](https://example.com/${pick(WORDS)})`;
    }
    const text = words.join(' ');
    return `${text[0].toUpperCase()}${text.slice(1)}.`;
  };
  const paragraph = () => {
    const parts = Array.from({ length: int(3, 7) }, sentence);
    if (random() < 0.3) {
      parts.push(pick(JA));
    }
    return parts.join(' ');
  };
  const list = () => Array.from({ length: int(3, 7) }, () => `- ${sentence()}`).join('\n');
  const table = (rows, columns) => {
    const header = Array.from({ length: columns }, (_, i) => `${pick(WORDS)} ${i + 1}`);
    const lines = [`| ${header.join(' | ')} |`, `|${' --- |'.repeat(columns)}`];
    for (let r = 0; r < rows; r += 1) {
      lines.push(
        `| ${Array.from({ length: columns }, () => (random() < 0.4 ? int(0, 99999) : pick(WORDS))).join(' | ')} |`,
      );
    }
    return lines.join('\n');
  };
  const code = () => {
    const lang = pick(['ts', 'rust', 'sh', 'json', 'python']);
    const n = int(8, 24);
    const lines = [];
    for (let i = 0; i < n; i += 1) {
      const name = `${pick(WORDS)}_${int(1, 99)}`;
      switch (lang) {
        case 'ts':
          lines.push(`const ${name} = await ${pick(WORDS)}(${int(0, 999)}, '${pick(WORDS)}'); // ${pick(WORDS)}`);
          break;
        case 'rust':
          lines.push(`let ${name}: Vec<u32> = ${pick(WORDS)}.iter().map(|x| x * ${int(2, 9)}).collect();`);
          break;
        case 'sh':
          lines.push(`${pick(['ls', 'grep', 'cat', 'echo'])} --${pick(WORDS)} "${pick(WORDS)}/${name}" | wc -l`);
          break;
        case 'json':
          lines.push(`  "${name}": { "${pick(WORDS)}": ${int(0, 9999)}, "on": ${random() < 0.5} },`);
          break;
        default:
          lines.push(`def ${name}(${pick(WORDS)}): return ${pick(WORDS)}[${int(0, 9)}] + ${int(0, 99)}`);
      }
    }
    return `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``;
  };
  const quote = () => `> ${sentence()} ${sentence()}`;

  return { random, pick, int, sentence, paragraph, list, table, code, quote };
}

// Blocks are appended section by section until the document reaches its target
// size; `mix` decides how often each kind of block appears.
function document(seed, title, targetBytes, mix) {
  const w = makeWriter(seed);
  const parts = [`# ${title}`, w.paragraph()];
  let section = 0;
  while (Buffer.byteLength(parts.join('\n\n')) < targetBytes) {
    section += 1;
    parts.push(`## ${section}. ${w.sentence().slice(0, 40)}`);
    for (let i = 0; i < mix.blocksPerSection; i += 1) {
      const roll = w.random();
      if (roll < mix.code) {
        parts.push(w.code());
      } else if (roll < mix.code + mix.table) {
        parts.push(w.table(w.int(4, mix.tableRows), w.int(3, 6)));
      } else if (roll < mix.code + mix.table + 0.1) {
        parts.push(w.list());
      } else if (roll < mix.code + mix.table + 0.15) {
        parts.push(w.quote());
      } else {
        if (w.random() < 0.3) {
          parts.push(`### ${w.sentence().slice(0, 32)}`);
        }
        parts.push(w.paragraph());
      }
    }
  }
  return `${parts.join('\n\n')}\n`;
}

const MERMAID = `# Mermaid diagrams

A flowchart.

\`\`\`mermaid
flowchart TD
  A[Open folder] --> B{Has markdown?}
  B -- yes --> C[Render preview]
  B -- no --> D[Show source]
  C --> E[Outline]
  D --> E
  E --> F[(Settings)]
\`\`\`

A sequence diagram.

\`\`\`mermaid
sequenceDiagram
  participant U as Reader
  participant A as App
  participant F as File system
  U->>A: open file
  A->>F: read
  F-->>A: text
  A->>A: render
  A-->>U: document
  U->>A: scroll
\`\`\`

A class diagram.

\`\`\`mermaid
classDiagram
  class Viewer { +render() +scroll() }
  class Tree { +expand() +refresh() }
  class Settings { +load() +save() }
  Viewer --> Settings
  Tree --> Settings
\`\`\`

A state diagram.

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: open
  Loading --> Shown: rendered
  Loading --> Failed: error
  Shown --> Loading: change
  Failed --> Idle
\`\`\`

A Gantt chart.

\`\`\`mermaid
gantt
  dateFormat YYYY-MM-DD
  title Measurement
  section Prepare
  Install apps :a1, 2026-11-23, 1d
  Generate data :a2, after a1, 1d
  section Measure
  Launch :b1, after a2, 1d
  Memory :b2, after b1, 1d
  Render :b3, after b2, 1d
\`\`\`
`;

// P2's folders: nested `fan` wide and `depth` deep, `perLeaf` documents in every
// folder, so 100 and 1,000 files differ in breadth and not only in count.
function tree(root, seed, { fan, depth, perLeaf }) {
  let count = 0;
  const w = makeWriter(seed);
  const fill = (dir, level) => {
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < perLeaf; i += 1) {
      count += 1;
      writeFileSync(join(dir, `note-${String(i + 1).padStart(2, '0')}.md`), `# Note ${count}\n\n${w.paragraph()}\n`);
    }
    if (level < depth) {
      for (let i = 0; i < fan; i += 1) {
        fill(join(dir, `dir-${i + 1}`), level + 1);
      }
    }
  };
  fill(root, 0);
  return count;
}

rmSync(outDir, { recursive: true, force: true });
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return Buffer.byteLength(text);
};

const small = document(1, 'Small: a README-like document', 20 * 1024, {
  blocksPerSection: 4,
  code: 0.15,
  table: 0.05,
  tableRows: 6,
});
const medium = document(2, 'Medium: headings, tables and code blocks', 200 * 1024, {
  blocksPerSection: 6,
  code: 0.25,
  table: 0.15,
  tableRows: 12,
});
const large = document(3, 'Large: long prose, tables and many code blocks', 1024 * 1024, {
  blocksPerSection: 8,
  code: 0.2,
  table: 0.1,
  tableRows: 20,
});

const sizes = {
  'docs/small/small.md': write(join(outDir, 'docs/small/small.md'), small),
  'docs/medium/medium.md': write(join(outDir, 'docs/medium/medium.md'), medium),
  'docs/large/large.md': write(join(outDir, 'docs/large/large.md'), large),
  'docs/mermaid/mermaid.md': write(join(outDir, 'docs/mermaid/mermaid.md'), MERMAID),
  'switch/small.md': write(join(outDir, 'switch/small.md'), small),
  'switch/large.md': write(join(outDir, 'switch/large.md'), large),
};
const files100 = tree(join(outDir, 'tree-100'), 4, { fan: 3, depth: 2, perLeaf: 8 });
const files1000 = tree(join(outDir, 'tree-1000'), 5, { fan: 6, depth: 2, perLeaf: 23 });

for (const [path, bytes] of Object.entries(sizes)) {
  console.log(`${path}\t${(bytes / 1024).toFixed(1)} KiB`);
}
console.log(`tree-100\t${files100} files`);
console.log(`tree-1000\t${files1000} files`);
console.log(`→ ${outDir}`);
