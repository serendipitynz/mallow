import { describe, expect, it } from 'vitest';
import {
  classifyRef,
  countDocument,
  type DocNodeLike,
  navigatesAppOrigin,
  parseSrcset,
  RENDER_MAX_ELEMENTS,
  RENDER_MAX_TEXT_CHARS,
  refTally,
  renderSkipReason,
  rewriteRef,
  serializeSrcset,
} from './html-doc';

const resolver = { dir: '/Users/me/docs', toAssetUrl: (p: string) => `asset://localhost/${encodeURIComponent(p)}` };

describe('classifyRef', () => {
  it('leaves references that already resolve, or resolve to nothing, alone', () => {
    // These are the shapes a rewrite would break rather than fix: base64 images
    // are the common form of AI-generated single-file HTML, and `img-src`
    // already allows `data:`.
    expect(classifyRef('data:image/png;base64,iVBORw0KGgo=')).toBe('untouched');
    expect(classifyRef('blob:12345678-90ab')).toBe('untouched');
    expect(classifyRef('//cdn.example.com/logo.png')).toBe('untouched');
    expect(classifyRef('mailto:someone@example.com')).toBe('untouched');
    expect(classifyRef('#section')).toBe('untouched');
    expect(classifyRef('')).toBe('untouched');
    expect(classifyRef('   ')).toBe('untouched');
  });

  it('names http(s) references so they can be counted', () => {
    expect(classifyRef('https://example.com/logo.png')).toBe('external');
    expect(classifyRef('HTTP://example.com/logo.png')).toBe('external');
  });

  it('names document-relative references, which are the only ones rewritten', () => {
    expect(classifyRef('logo.png')).toBe('local');
    expect(classifyRef('./img/logo.png')).toBe('local');
    expect(classifyRef('../assets/logo.png')).toBe('local');
  });

  it('names a document-absolute path, which is deliberately not rewritten', () => {
    expect(classifyRef('/logo.png')).toBe('unresolvable');
  });
});

describe('rewriteRef', () => {
  it('rewrites a document-relative reference to an asset URL', () => {
    expect(rewriteRef('img/logo.png', resolver)).toBe(
      `asset://localhost/${encodeURIComponent('/Users/me/docs/img/logo.png')}`,
    );
  });

  it('leaves every other kind as written', () => {
    expect(rewriteRef('data:image/png;base64,iVBORw0KGgo=', resolver)).toBeNull();
    expect(rewriteRef('https://example.com/logo.png', resolver)).toBeNull();
    expect(rewriteRef('//cdn.example.com/logo.png', resolver)).toBeNull();
    expect(rewriteRef('blob:12345678-90ab', resolver)).toBeNull();
    expect(rewriteRef('#section', resolver)).toBeNull();
    expect(rewriteRef('', resolver)).toBeNull();
    expect(rewriteRef('/logo.png', resolver)).toBeNull();
  });

  it('addresses the file, not the part of it a query or fragment names', () => {
    expect(rewriteRef('logo.png?v=2#top', resolver)).toBe(
      `asset://localhost/${encodeURIComponent('/Users/me/docs/logo.png')}`,
    );
  });

  it('decodes percent-escapes, because the name on disk is the decoded one', () => {
    expect(rewriteRef('my%20photo.png', resolver)).toBe(
      `asset://localhost/${encodeURIComponent('/Users/me/docs/my photo.png')}`,
    );
  });

  it('treats a stray percent as a literal, rather than failing the whole rewrite', () => {
    expect(rewriteRef('100%.png', resolver)).toBe(`asset://localhost/${encodeURIComponent('/Users/me/docs/100%.png')}`);
  });
});

describe('parseSrcset', () => {
  it('keeps descriptors with their candidates', () => {
    expect(parseSrcset('small.png 1x, large.png 2x')).toEqual([
      { url: 'small.png', descriptor: '1x' },
      { url: 'large.png', descriptor: '2x' },
    ]);
    expect(parseSrcset('a.png 320w, b.png 640w')).toEqual([
      { url: 'a.png', descriptor: '320w' },
      { url: 'b.png', descriptor: '640w' },
    ]);
  });

  it('keeps a comma that sits inside a path', () => {
    // The attribute is split on whitespace first, so a comma with no whitespace
    // after it belongs to the URL — which is why splitting on ',' is wrong.
    expect(parseSrcset('img/a,1.png 1x, img/b,2.png 2x')).toEqual([
      { url: 'img/a,1.png', descriptor: '1x' },
      { url: 'img/b,2.png', descriptor: '2x' },
    ]);
  });

  it('accepts candidates without descriptors, and commas without spaces', () => {
    expect(parseSrcset('a.png, b.png')).toEqual([
      { url: 'a.png', descriptor: '' },
      { url: 'b.png', descriptor: '' },
    ]);
    expect(parseSrcset('a.png 1x,b.png 2x')).toEqual([
      { url: 'a.png', descriptor: '1x' },
      { url: 'b.png', descriptor: '2x' },
    ]);
  });

  it('tolerates stray whitespace and empty input', () => {
    expect(parseSrcset('   a.png   1x  ,   b.png   ')).toEqual([
      { url: 'a.png', descriptor: '1x' },
      { url: 'b.png', descriptor: '' },
    ]);
    expect(parseSrcset('')).toEqual([]);
    expect(parseSrcset('   ')).toEqual([]);
  });

  it('round-trips through serializeSrcset', () => {
    const value = 'img/a,1.png 1x, b.png 2x, c.png';
    expect(serializeSrcset(parseSrcset(value))).toBe(value);
  });
});

/** DOM stand-ins, so the walk is exercised without a browser (doc-1). */
function element(name: string, children: DocNodeLike[] = []): DocNodeLike {
  return { nodeType: 1, nodeName: name, nodeValue: null, childNodes: children };
}
function text(value: string): DocNodeLike {
  return { nodeType: 3, nodeName: '#text', nodeValue: value, childNodes: [] };
}

describe('countDocument', () => {
  it('counts elements and the text they lay out', () => {
    const doc = element('HTML', [element('BODY', [element('P', [text('hello')]), element('P', [text('world')])])]);
    expect(countDocument(doc)).toEqual({ elements: 4, textChars: 10 });
  });

  it('does not count text the engine never lays out', () => {
    const doc = element('HTML', [
      element('HEAD', [element('TITLE', [text('a title')]), element('STYLE', [text('body { color: red }')])]),
      element('BODY', [element('SCRIPT', [text('let x = 1;')]), element('P', [text('shown')])]),
    ]);
    expect(countDocument(doc).textChars).toBe('shown'.length);
  });

  it('does not count whitespace between tags, which lays out no glyphs', () => {
    const doc = element('HTML', [element('BODY', [text('\n    '), element('P', [text('  hi  ')]), text('\n')])]);
    expect(countDocument(doc).textChars).toBe(2);
  });
});

describe('renderSkipReason', () => {
  it('renders a document that sits exactly on both ceilings', () => {
    expect(renderSkipReason({ elements: RENDER_MAX_ELEMENTS, textChars: RENDER_MAX_TEXT_CHARS })).toBeNull();
  });

  it('names the ceiling that was passed', () => {
    expect(renderSkipReason({ elements: RENDER_MAX_ELEMENTS + 1, textChars: 0 })).toBe('elements');
    expect(renderSkipReason({ elements: 0, textChars: RENDER_MAX_TEXT_CHARS + 1 })).toBe('text');
  });

  // Neither number bounds the other: the corpus these were measured against holds
  // a 16-element document carrying 0.8 MB of text and a 19,041-element one
  // carrying 65 KB.
  it('catches a document that is small by one measure and huge by the other', () => {
    expect(renderSkipReason({ elements: 16, textChars: 2_000_000 })).toBe('text');
    expect(renderSkipReason({ elements: 200_000, textChars: 1_000 })).toBe('elements');
  });
});

describe('refTally', () => {
  // The whole reason the site is a parameter: one value, two answers.
  // `img-src` carries `https:` / `http:` / `data:`; `media-src` is `'self'
  // asset:` and nothing else, so the same URL arrives on an image and is refused
  // on a video.
  it('answers the same reference differently on an image and on a video', () => {
    expect(refTally('https://cdn.example.com/a.png', 'imgSrc')).toBeNull();
    expect(refTally('https://cdn.example.com/a.mp4', 'mediaSrc')).toBe('blocked');
    expect(refTally('data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'imgSrc')).toBeNull();
    expect(refTally('data:video/mp4;base64,AAAA', 'mediaSrc')).toBe('blocked');
  });

  // On `<link rel=…>` and `<script src>` nothing is rewritten, so a relative path
  // resolves against the app's own URL and 404s — the reversal that makes the
  // same value lost here and fine on a media attribute.
  it('loses a relative path only where nothing rewrites it', () => {
    expect(refTally('./site.css', 'unrewritten')).toBe('unresolvedLocal');
    expect(refTally('img/logo.png', 'imgSrc')).toBeNull();
    expect(refTally('clip.mp4', 'mediaSrc')).toBeNull();
  });

  // Neither `style-src 'self' 'unsafe-inline'` nor `script-src 'self'
  // 'wasm-unsafe-eval'` carries a host or a scheme, so a protocol-relative or
  // `data:` stylesheet is refused as surely as a remote one — and each was
  // counted nowhere while the rule keyed on `http(s)` alone.
  it('counts every reference the policy refuses where nothing rewrites it', () => {
    expect(refTally('https://cdn.example.com/x.css', 'unrewritten')).toBe('blocked');
    expect(refTally('//cdn.example.com/x.css', 'unrewritten')).toBe('blocked');
    expect(refTally('data:text/css,body{}', 'unrewritten')).toBe('blocked');
    expect(refTally('blob:1234', 'unrewritten')).toBe('blocked');
  });

  // A document-absolute path is answered by neither the opened folder nor the
  // asset grant, wherever it sits.
  it('loses a document-absolute path on every site', () => {
    for (const site of ['imgSrc', 'mediaSrc', 'unrewritten'] as const) {
      expect(refTally('/absolute.png', site)).toBe('unresolvedLocal');
    }
  });

  // Nothing is fetched for either, so counting them would tell the reader
  // something was lost when nothing was.
  it('charges nothing for a value that addresses nothing to fetch', () => {
    for (const site of ['imgSrc', 'mediaSrc', 'unrewritten'] as const) {
      expect(refTally('', site)).toBeNull();
      expect(refTally('#frag', site)).toBeNull();
    }
  });
});

describe('navigatesAppOrigin', () => {
  it('answers true for what resolves against the parent document URL', () => {
    // A srcdoc document's base URL is the parent's, so none of these is a
    // same-document link: each loads the app's own URL into the frame.
    for (const href of ['#section', '#', '', 'other.html', './a/b.html', '../up.html', '/root.png']) {
      expect(navigatesAppOrigin(href)).toBe(true);
    }
  });

  it('answers false where the scheme decides instead, and the CSP answers for it', () => {
    for (const href of [
      'https://example.com/',
      'http://example.com/',
      'mailto:a@b.c',
      'javascript:void 0',
      'data:text/html,x',
      'asset://x',
      '//example.com/x',
    ]) {
      expect(navigatesAppOrigin(href)).toBe(false);
    }
  });

  it('ignores surrounding whitespace, as the parser does', () => {
    expect(navigatesAppOrigin('  #top  ')).toBe(true);
    expect(navigatesAppOrigin('  https://example.com/  ')).toBe(false);
  });
});
