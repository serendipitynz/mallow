/**
 * Guards that keep the config tree from flooding the DOM when a document has a
 * huge flat object/array or very deep nesting. Kept as pure logic + tunables,
 * separate from the React component, so they can be unit-tested in a Node
 * environment (no jsdom/React needed).
 */

/** How many direct children a branch renders before a "show more" control. */
export const BRANCH_INITIAL = 100;
/** How many more children each "show more" click reveals. */
export const BRANCH_STEP = 200;
/** Branches shallower than this auto-open on first render (the default view). */
export const AUTO_EXPAND_DEPTH = 1;
/**
 * "Expand all" auto-opens only branches shallower than this, so a deeply nested
 * document can't recurse without bound when every node is forced open.
 */
export const FORCE_EXPAND_MAX_DEPTH = 6;

/**
 * Initial open state for a branch at `depth`.
 * - `forceOpen === true`  → open, but only down to {@link FORCE_EXPAND_MAX_DEPTH}
 *   ("expand all" must not open an unbounded tree).
 * - `forceOpen === false` → closed ("collapse all").
 * - `undefined`           → default: only the top {@link AUTO_EXPAND_DEPTH} levels.
 */
export function initialBranchOpen(forceOpen: boolean | undefined, depth: number): boolean {
  if (forceOpen === true) {
    return depth < FORCE_EXPAND_MAX_DEPTH;
  }
  if (forceOpen === false) {
    return false;
  }
  return depth < AUTO_EXPAND_DEPTH;
}

/** Advance a branch's visible-children count by `step`, clamped to `total`. */
export function nextVisibleCount(current: number, total: number, step: number = BRANCH_STEP): number {
  return Math.min(current + step, total);
}
