import { beforeEach, describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import { setMarkdownPreviewActive } from './markdown-preview';
import { createPdfExportChordHandler, PDF_EXPORT_CHORD_KEY, pdfDestinationFor, withPdfExtension } from './pdf-export';
import { createPrintChordHandler } from './print';

function harness(onMac = true) {
  const calls = { prevented: 0, exported: 0 };
  const handler = createPdfExportChordHandler({
    onMac,
    exportPdf: () => {
      calls.exported += 1;
    },
  });
  const fire = (over: Partial<ChordEvent> = {}) => {
    const event: HandledChordEvent = {
      key: 'e',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...over,
      preventDefault: () => {
        calls.prevented += 1;
      },
    };
    handler(event);
  };
  return { calls, fire };
}

describe('the PDF export chord', () => {
  beforeEach(() => {
    setMarkdownPreviewActive(false);
  });

  it('is CmdOrCtrl+E', () => {
    expect(PDF_EXPORT_CHORD_KEY).toBe('e');
  });

  it('exports where a markdown preview is on screen', () => {
    setMarkdownPreviewActive(true);
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, exported: 1 });
  });

  /* Whether any of the three engines binds Ctrl+E is unmeasured, and consuming
     the chord is what means it never has to be answered — the rule printing paid
     for with a `.csv` that WebView2 printed. */
  it('consumes the chord without exporting where no markdown preview is on screen', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, exported: 0 });
  });

  it('leaves the print chord alone', () => {
    setMarkdownPreviewActive(true);
    const { calls, fire } = harness();
    fire({ key: 'p', metaKey: true });
    expect(calls).toEqual({ prevented: 0, exported: 0 });
  });

  /* decision-14 requires the two entries to enable and disable together, which is
     a property of them reading one flag rather than each keeping its own. A copy
     would pass every other test in both files and drift on the first view that
     set one and not the other. */
  it('opens and closes with the print chord, on the one gate both read', () => {
    const calls = { printed: 0, exported: 0 };
    const printChord = createPrintChordHandler({
      onMac: true,
      print: () => {
        calls.printed += 1;
      },
    });
    const exportChord = createPdfExportChordHandler({
      onMac: true,
      exportPdf: () => {
        calls.exported += 1;
      },
    });
    const press = (key: string) => {
      const handler = key === 'p' ? printChord : exportChord;
      handler({ key, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => {} });
    };

    press('p');
    press('e');
    expect(calls).toEqual({ printed: 0, exported: 0 });

    setMarkdownPreviewActive(true);
    press('p');
    press('e');
    expect(calls).toEqual({ printed: 1, exported: 1 });

    setMarkdownPreviewActive(false);
    press('p');
    press('e');
    expect(calls).toEqual({ printed: 1, exported: 1 });
  });
});

describe('pdfDestinationFor', () => {
  it('offers the document its own name, beside the document', () => {
    expect(pdfDestinationFor('/docs/notes/report.md')).toBe('/docs/notes/report.pdf');
    expect(pdfDestinationFor('C:\\docs\\report.md')).toBe('C:\\docs\\report.pdf');
  });

  it('reads a leading dot as a name rather than an extension', () => {
    expect(pdfDestinationFor('/docs/.eslintrc')).toBe('/docs/.eslintrc.pdf');
  });

  it('appends to a name with no extension at all', () => {
    expect(pdfDestinationFor('/docs/README')).toBe('/docs/README.pdf');
  });

  it('answers a bare name with a bare name, so nothing invents a directory', () => {
    expect(pdfDestinationFor('report.md')).toBe('report.pdf');
  });
});

describe('withPdfExtension', () => {
  // The dialog's filter is not a guarantee: where a name can be typed, what comes
  // back is what was typed.
  it('adds the extension the dialog may not have', () => {
    expect(withPdfExtension('/docs/report')).toBe('/docs/report.pdf');
  });

  it('leaves one that is already there, in either case', () => {
    expect(withPdfExtension('/docs/report.pdf')).toBe('/docs/report.pdf');
    expect(withPdfExtension('/docs/report.PDF')).toBe('/docs/report.PDF');
  });
});
