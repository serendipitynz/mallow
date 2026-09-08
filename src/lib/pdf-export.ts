/** PDF export's chord: the key, the gate, and the reason for each (decision-14).
 *
 *  **`CmdOrCtrl+E` is consumed even where the export is refused**, on the rule
 *  printing paid for twice and `lib/chord` now holds: registering no handler does
 *  not make a chord inert, it concedes it to the platform. **Whether any of the
 *  three engines binds `Ctrl+E` is unmeasured**, and consuming it means that never
 *  has to be answered.
 *
 *  **The gate is printing's sentence with a different reason behind it.** The
 *  entry is disabled unless the active view is markdown in preview — not because
 *  the body worth exporting is markdown, which is printing's reason, but because
 *  **`styles/print.scss` is markdown-only**: a PDF of a table view or an XML tree
 *  would be paginated by rules written for `.markdown-body`, and nothing has looked
 *  at that paper. **So a later request to export other views is a request to widen
 *  the stylesheet, not the entry** — decision-6 makes the source view where that
 *  would start.
 */
import { createChordHandler, type HandledChordEvent } from './chord';
import { isMarkdownPreviewActive } from './markdown-preview';
import { basename, dirname, join } from './path';

/** `CmdOrCtrl+E`, as the native menu layer resolves it. */
export const PDF_EXPORT_CHORD_KEY = 'e';

export function createPdfExportChordHandler(deps: {
  onMac: boolean;
  exportPdf: () => void;
}): (event: HandledChordEvent) => void {
  return createChordHandler({
    key: PDF_EXPORT_CHORD_KEY,
    onMac: deps.onMac,
    isAllowed: isMarkdownPreviewActive,
    act: deps.exportPdf,
  });
}

/** The path the save dialog opens with: the document's own name carrying a `.pdf`
 *  extension, beside the document itself.
 *
 *  A leading dot is a name and not an extension (`.eslintrc` → `.eslintrc.pdf`),
 *  which is the same reading `kindFromName` takes of one. */
export function pdfDestinationFor(documentPath: string): string {
  const name = basename(documentPath);
  const dot = name.lastIndexOf('.');
  const file = `${dot > 0 ? name.slice(0, dot) : name}.pdf`;
  const dir = dirname(documentPath);
  return dir ? join(dir, file) : file;
}

/** The chosen path with a `.pdf` extension, since the dialog's filter does not
 *  guarantee one: on the platforms whose save dialog lets a name be typed, what
 *  comes back is what was typed. */
export function withPdfExtension(path: string): string {
  return path.toLowerCase().endsWith('.pdf') ? path : `${path}.pdf`;
}
