/** The unattended export's frontend half: open the document the command line
 *  named, wait for it to finish rendering, write the PDF, and end the process
 *  with what happened.
 *
 *  **Nothing here is in an ordinary build.** It is reached only through
 *  `if (UNATTENDED)` in `App`, whose condition Vite replaces with `false`, so
 *  this module and everything it imports are dropped along with the branch.
 *
 *  **It is not the PDF export's entry** (decision-14's `CmdOrCtrl+E`, its gate and
 *  its save dialog): it calls `write_window_pdf` as a second caller. So it can
 *  measure the paper — AC #1, #5 and #9 — and says nothing about the entry, the
 *  chord, the gate or the absence of a print UI, which stay with a person.
 *
 *  **It writes nothing a reader owns.** The settings store holds the restored
 *  session and the rest under the same identifier an installed mallow uses, so a
 *  run of this must not touch it: the document is opened directly rather than
 *  through `selectFile`, the theme is applied to `<html>` rather than through
 *  `setTheme`, no watcher is started, and nothing reports what this window shows.
 *  An unattended build registers no session on the Rust side either.
 */
import { invoke } from '@tauri-apps/api/core';
import { fileEntryFromPath, kindFromName } from '../lib/file';
import { basename, dirname } from '../lib/path';
import { nextRenderSettled } from '../lib/render-signal';
import { allowMediaDir, pathExists, writeWindowPdf } from '../lib/tauri';
import type { FileEntry } from '../lib/types';

/** What the Rust side parsed out of the command line. */
interface Request {
  document: string;
  out: string;
  theme: 'light' | 'dark';
}

/** The parts of `App` this needs, passed in rather than reached for: the driver
 *  runs inside the real app so that the paper is the real app's paper, shell and
 *  height chain and all. */
export interface AppSeam {
  openTree: (dir: string) => Promise<void>;
  select: (entry: FileEntry) => void;
}

/** How long a document may take to settle before the run is called failed.
 *
 *  **A safety valve, not the wait.** The wait is the render-settled event; this
 *  only decides when to stop waiting for it, so that a hung run ends as exit 2
 *  with a reason rather than as a CI job that times out with none. */
const RENDER_TIMEOUT_MS = 60_000;

const EXIT_WROTE = 0;
const EXIT_EXPORT_REFUSED = 1;
const EXIT_NEVER_RENDERED = 2;
const EXIT_BAD_REQUEST = 3;

function finish(code: number, message = ''): void {
  // The process exits inside this call, so nothing may be pending afterwards.
  void invoke('unattended_finish', { code, message });
}

/** Why this document cannot be exported, or null.
 *
 *  **Checked before anything waits.** Without it a missing file and a `.csv` both
 *  end the same way: no markdown preview ever mounts, so nothing reports a render,
 *  and the run spends the full minute before failing as "never rendered" — which
 *  says the paper timed out when the truth is that the argument was wrong. Split
 *  out of the flow because the two cases are worth testing and the flow is not
 *  testable under Node. */
export function documentProblem(path: string, exists: boolean): string | null {
  if (!exists) {
    return `${path} does not exist`;
  }
  const kind = kindFromName(basename(path));
  if (kind !== 'markdown') {
    return `${path} is ${kind === null ? 'not a file kind mallow opens' : `a ${kind} document`}, and only markdown has a paper`;
  }
  return null;
}

export async function runUnattendedExport(app: AppSeam): Promise<void> {
  let request: Request;
  try {
    request = await invoke<Request>('unattended_request');
  } catch (error) {
    finish(EXIT_BAD_REQUEST, `could not read the request: ${String(error)}`);
    return;
  }

  // Applied to the element rather than through `lib/theme`, which persists to
  // localStorage — shared with the installed app, so a measurement run would
  // change the reader's theme.
  document.documentElement.dataset.theme = request.theme;

  const problem = documentProblem(request.document, await pathExists(request.document));
  if (problem) {
    finish(EXIT_BAD_REQUEST, problem);
    return;
  }
  const entry = fileEntryFromPath(request.document) as FileEntry;

  const folder = dirname(request.document);
  try {
    await allowMediaDir(folder);
    await app.openTree(folder);
  } catch (error) {
    finish(EXIT_BAD_REQUEST, `could not open ${folder}: ${String(error)}`);
    return;
  }

  // Armed before the document is selected, because the event it waits for is the
  // one this selection causes: subscribing afterwards can miss it entirely on a
  // document that renders in a single frame.
  const settled = nextRenderSettled();
  app.select(entry);

  const timedOut = Symbol('timed out');
  const outcome = await Promise.race([
    settled,
    new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), RENDER_TIMEOUT_MS)),
  ]);
  if (outcome === timedOut) {
    finish(EXIT_NEVER_RENDERED, `${request.document} did not finish rendering within ${RENDER_TIMEOUT_MS}ms`);
    return;
  }

  try {
    await writeWindowPdf(request.out);
    finish(EXIT_WROTE);
  } catch (error) {
    finish(EXIT_EXPORT_REFUSED, String(error));
  }
}
