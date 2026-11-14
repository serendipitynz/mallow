import { describe, expect, it } from 'vitest';
import { codeSideOf, compositeGround, type Rgba, relativeLuminance } from './code-side';

const hex = (value: string, a = 1): Rgba => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
  a,
];

const TRANSPARENT: Rgba = [0, 0, 0, 0];

describe('codeSideOf', () => {
  it("reads kinari's two code grounds as their own sides", () => {
    expect(codeSideOf(hex('#fbfaf6'))).toBe('light');
    expect(codeSideOf(hex('#2b2724'))).toBe('dark');
  });

  it("reads Shiki's own two theme grounds as their sides", () => {
    expect(codeSideOf(hex('#ffffff'))).toBe('light');
    expect(codeSideOf(hex('#24292e'))).toBe('dark');
  });

  it('puts the line where black and white ink contrast alike', () => {
    // #767676 is 0.181, just above; #757575 is 0.178, just below.
    expect(codeSideOf(hex('#767676'))).toBe('light');
    expect(codeSideOf(hex('#757575'))).toBe('dark');
  });
});

describe('relativeLuminance', () => {
  it('spans 0 to 1', () => {
    expect(relativeLuminance(hex('#000000'))).toBe(0);
    expect(relativeLuminance(hex('#ffffff'))).toBeCloseTo(1, 10);
  });
});

describe('compositeGround', () => {
  it('takes an opaque innermost layer as it is', () => {
    expect(compositeGround([hex('#2b2724'), hex('#f4f2ec')])).toEqual(hex('#2b2724'));
  });

  it('looks through transparent layers to the first opaque one', () => {
    expect(compositeGround([TRANSPARENT, TRANSPARENT, hex('#2b2724')])).toEqual(hex('#2b2724'));
  });

  it('lays a translucent layer over the ground outside it', () => {
    const ground = compositeGround([[255, 255, 255, 0.5], hex('#000000')]);
    expect(ground).toEqual([127.5, 127.5, 127.5, 1]);
  });

  it('lays translucent layers innermost last', () => {
    // Black at half over white is mid-grey; white at half over that is 3/4.
    const ground = compositeGround([[255, 255, 255, 0.5], [0, 0, 0, 0.5], hex('#ffffff')]);
    expect(ground).toEqual([191.25, 191.25, 191.25, 1]);
  });

  it('answers null where nothing up to the slide is opaque', () => {
    expect(compositeGround([TRANSPARENT, [0, 0, 0, 0.4]])).toBeNull();
    expect(compositeGround([])).toBeNull();
  });
});
