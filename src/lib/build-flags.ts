/** Build-time switches, kept in one tiny module so that reading one costs an
 *  ordinary bundle nothing.
 *
 *  `UNATTENDED` is substituted by Vite (`define`) rather than read at runtime,
 *  which is what makes `if (UNATTENDED) { … }` disappear from an ordinary build
 *  along with everything the branch reaches — the discipline `src/probe` set. So
 *  anything this mode needs must be behind that branch and imported dynamically
 *  from inside it; a static import would ship whether the branch survives or not.
 *  The branch holding that dynamic import tests `__MALLOW_UNATTENDED__` itself
 *  (see `App`), because a bundler can drop the branch and still emit the chunk.
 */
export const UNATTENDED: boolean = __MALLOW_UNATTENDED__;

/** The Microsoft Store build (TASK-58), substituted the same way. The Store
 *  updates the package itself, so this build carries no updater; `useUpdater`
 *  reads it at module level so the GitHub updater drops out of the bundle. */
export const STORE: boolean = __MALLOW_STORE__;
