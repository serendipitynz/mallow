/** When the rendered markdown has finished becoming what it will be on paper.
 *
 *  **The unattended export cannot ask the DOM this question.** The article's HTML
 *  is injected first and then enhanced: mermaid diagrams replace their own
 *  `<pre>` asynchronously, and images load after that. Printing a moment too
 *  early puts a diagram's source on the paper — which is also what TASK-29 looks
 *  like from the outside, so a timer here would produce papers nobody could tell
 *  apart from that bug.
 *
 *  So `MarkdownView` reports the event instead, and only in an unattended build:
 *  the call site is inside `if (UNATTENDED)`, so an ordinary bundle carries
 *  neither the notification nor the wait for images that precedes it. Nothing
 *  subscribes there either.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Called by the view once its pass over the rendered article has settled. */
export function notifyRenderSettled(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Resolves the next time a render settles. Deliberately not "resolve if one has
 *  already happened": the caller arms this before it selects the document, and a
 *  stale earlier render is exactly what it must not accept. */
export function nextRenderSettled(): Promise<void> {
  return new Promise((resolve) => {
    const listener = () => {
      listeners.delete(listener);
      resolve();
    };
    listeners.add(listener);
  });
}
