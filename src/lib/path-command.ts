/** What the app menu's Install / Uninstall 'mallow' Command items tell the reader
 *  (TASK-62, macOS only). Rust does the work and answers an outcome; this turns
 *  it into a sentence, or into a question when a file mallow did not write is in
 *  the way of an install.
 *
 *  No Tauri import, so it is testable under Node; the invoke wrappers are in
 *  `lib/tauri`. */

/** Mirrors `path_command::Outcome` in Rust. */
export type PathCommandOutcome =
  | { kind: 'installed'; path: string }
  | { kind: 'removed'; path: string }
  | { kind: 'absent'; path: string }
  | { kind: 'foreign'; path: string }
  | { kind: 'unsettled'; binary: string }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

export type PathCommandStep =
  | { ask: { key: 'pathCommandReplace'; params: { path: string } } }
  | { tell: { key: string; params: Record<string, string>; failure: boolean } }
  | 'nothing';

/** What follows an outcome. **Only an install asks**: replacing a file mallow did
 *  not write is the reader's call, while an uninstall leaves such a file where it
 *  is and says so. A dismissed administrator prompt needs no sentence — the
 *  reader has just said no. */
export function pathCommandStep(action: 'install' | 'uninstall', outcome: PathCommandOutcome): PathCommandStep {
  switch (outcome.kind) {
    case 'installed':
      return { tell: { key: 'pathCommandInstalled', params: { path: outcome.path }, failure: false } };
    case 'removed':
      return { tell: { key: 'pathCommandRemoved', params: { path: outcome.path }, failure: false } };
    case 'absent':
      return { tell: { key: 'pathCommandAbsent', params: { path: outcome.path }, failure: false } };
    case 'foreign':
      return action === 'install'
        ? { ask: { key: 'pathCommandReplace', params: { path: outcome.path } } }
        : { tell: { key: 'pathCommandForeignKept', params: { path: outcome.path }, failure: true } };
    case 'unsettled':
      return { tell: { key: 'pathCommandUnsettled', params: { path: outcome.binary }, failure: true } };
    case 'cancelled':
      return 'nothing';
    case 'failed':
      return {
        tell: {
          key: action === 'install' ? 'pathCommandInstallFailed' : 'pathCommandUninstallFailed',
          params: { error: outcome.message },
          failure: true,
        },
      };
  }
}
