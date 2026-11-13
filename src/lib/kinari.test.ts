import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import notices from '../../THIRD-PARTY-NOTICES.md?raw';
import css from '../slide-themes/kinari.css?raw';
import { walkDeckCss } from './deck-css';
import { KINARI } from './kinari';
import { readThemeMeta } from './slide-theme-css';

/* What decision-19 §7 takes from a kinari release, checked on mallow's copy so a
   release missing one fails here rather than being patched in mallow's tree.
   Whether the copy is the release's bytes is `node scripts/kinari.mjs verify`,
   which needs the kinari checkout beside this one. */
describe("mallow's copy of kinari", () => {
  it('names the release it came from on its first line', () => {
    expect(css.split('\n', 1)[0]).toMatch(
      /^\/\* kinari \d+\.\d+\.\d+ — https:\/\/github\.com\/serendipitynz\/marp-theme-kinari — MIT License \*\/$/,
    );
  });

  it('is the release THIRD-PARTY-NOTICES.md names, so an update cannot leave the notice behind', () => {
    const version = css.split('\n', 1)[0].match(/^\/\* kinari (\S+) /)?.[1];
    expect(notices).toContain(`### kinari ${version}\n`);
  });

  it('is registered under kinari with its 16:9 and 4:3 sizes', () => {
    expect(readThemeMeta(css)?.name).toBe('kinari');
    expect(KINARI.name).toBe('kinari');
    expect({ ...KINARI.sizes }).toEqual({
      '16:9': { width: '1280px', height: '720px' },
      '4:3': { width: '960px', height: '720px' },
    });
  });

  it('carries nothing the deck CSS walk would remove', () => {
    const walked = walkDeckCss(css, undefined);
    expect(walked.unparsed).toBe(false);
    expect(walked.removedAtRules).toEqual([]);
    expect(walked.refusedAssetUrls).toBe(0);
  });

  it('writes its colours as light-dark() pairs, with an @supports block giving the light side', () => {
    const root = postcss.parse(css);
    const paired = new Set<string>();
    const fallback = new Map<string, string>();
    root.walkDecls(/^--kinari-(?!light-|dark-)/, (decl) => {
      const inFallback = decl.parent?.parent?.type === 'atrule';
      if (inFallback) {
        if ((decl.parent as postcss.Rule).selector === 'section') {
          fallback.set(decl.prop, decl.value);
        }
      } else if ((decl.parent as postcss.Rule).selector === 'section') {
        expect(decl.value).toMatch(/^light-dark\(/);
        paired.add(decl.prop);
      }
    });
    const supports = root.nodes.filter((node) => node.type === 'atrule' && node.name === 'supports');
    expect(supports.map((node) => (node as postcss.AtRule).params)).toEqual(['not (color: light-dark(#000, #fff))']);
    expect(paired.size).toBeGreaterThan(0);
    expect([...fallback.keys()].sort()).toEqual([...paired].sort());
    for (const [prop, value] of fallback) {
      expect(value).toBe(`var(${prop.replace('--kinari-', '--kinari-light-')})`);
    }
  });
});
