/** Build-time switches, kept in one tiny module so that reading one costs an
 *  ordinary bundle nothing.
 *
 *  `UNATTENDED` is substituted by Vite (`define`) rather than read at runtime,
 *  which is what makes `if (UNATTENDED) { … }` disappear from an ordinary build
 *  along with everything the branch reaches — the discipline `src/probe` set. So
 *  anything this mode needs must be behind that branch and imported dynamically
 *  from inside it; a static import would ship whether the branch survives or not.
 */
export const UNATTENDED: boolean = __MALLOW_UNATTENDED__;
