/** TASK-46's section: whether the CSS Custom Highlight API works on this engine,
 *  in the app document and inside the rendered HTML view's frame.
 *
 *  TASK-47 paints find matches with `CSS.highlights` rather than by wrapping them
 *  in `<mark>`, because two views must not be written to: `MarkdownView` writes
 *  the article only when its enhancements re-run (TASK-29), and `HtmlView`'s
 *  `MutationObserver` turns any write into the frame into a restart that throws
 *  the reader to the top. This section is what says the API is there to lean on.
 *
 *  **What it can and cannot settle.** Whether the API exists, whether a
 *  `::highlight()` rule survives the engine's parser, whether registration throws
 *  and whether it mutates the frame's document are all readable from here.
 *  Whether a highlight *painted* is not — no API reports it — so those answers
 *  are a screenshot and a hand-recorded field, and the automatic rows only
 *  establish that a missing paint is not explained by something earlier.
 *
 *  **The frame is measured twice**, with the Highlight built from the frame's own
 *  realm and from the parent's. decision-9 is why neither can be assumed from the
 *  other: a document with scripting disabled runs no parent-registered listener on
 *  either WebKit engine, so "the parent can drive the frame" has already turned
 *  out to be more than one property once. */

import { highlightFixture, highlightSpecimen } from './fixtures';
import { mountFrame, sleep, type Verdict } from './harness';

export const MATCH_HIGHLIGHT = 'probe-match';
export const CURRENT_HIGHLIGHT = 'probe-current';

/** One rule text for both documents, so a paint that differs between the parent
 *  and the frame cannot be a difference in what was asked for. */
export const HIGHLIGHT_CSS = [
  `::highlight(${MATCH_HIGHLIGHT}) { background-color: #ffd400; color: #000000; }`,
  `::highlight(${CURRENT_HIGHLIGHT}) { background-color: #ff5f00; color: #ffffff; }`,
].join('\n');

const LOAD_TIMEOUT_MS = 5000;

/** Long enough for every pending `MutationObserver` callback to have been
 *  delivered; `takeRecords()` collects anything still queued regardless. */
const SETTLE_MS = 150;

const FRAME_HEIGHT_PX = 200;

export type HighlightWhere = 'parent' | 'frame, frame realm' | 'frame, parent realm';

/** The parts of a window this section touches, every one optional: an engine
 *  without the API is the case being measured, so the types must not assume it. */
interface HighlightRealm {
  CSS?: {
    highlights?: HighlightRegistry;
    supports?: (conditionText: string) => boolean;
  };
  Highlight?: typeof Highlight;
}

export interface MutationCount {
  /** Records produced while highlights were registered, changed, cleared and
   *  registered again. */
  during: number;
  /** Records produced by one deliberate attribute write afterwards. Zero means
   *  the observer was not hearing this document at all, so `during` being zero
   *  says nothing. */
  control: number;
}

export interface HighlightReading {
  where: HighlightWhere;
  registryPresent: boolean;
  constructorPresent: boolean;
  /** `null` where `CSS.supports` itself is missing. */
  selectorSupported: boolean | null;
  /** Whether a `::highlight()` rule is still in the document's stylesheets after
   *  parsing. An engine that does not know the pseudo-element drops the rule. */
  ruleParsed: boolean;
  registered: boolean;
  error: string | null;
  registrySize: number | null;
  /** Frames only: the parent writes nothing into its own document while this
   *  section runs, so the parent has nothing to count. */
  mutations: MutationCount | null;
}

export interface HighlightCheck {
  id: string;
  /** TASK-46 acceptance criteria this check is evidence for. */
  ac: number[];
  title: string;
  verdict: Verdict;
  detail: string;
}

export interface HighlightRun {
  readings: HighlightReading[];
  checks: HighlightCheck[];
}

export interface HighlightHosts {
  parent: HTMLElement;
  frameRealm: HTMLElement;
  parentRealm: HTMLElement;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** Every occurrence of `needle` in `root`'s text, as ranges that may start and
 *  end in different text nodes — the per-block join TASK-47 will match over,
 *  done here by hand so a range spanning inline elements is what gets painted. */
function rangesOf(doc: Document, root: Element, needle: string): Range[] {
  const nodes: Text[] = [];
  // 4 is NodeFilter.SHOW_TEXT, written as the number so the frame's document is
  // not handed a constant from another realm.
  const walker = doc.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  const starts: number[] = [];
  let joined = '';
  for (const node of nodes) {
    starts.push(joined.length);
    joined += node.data;
  }
  const locate = (offset: number, isEnd: boolean): [Text, number] => {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      // An end offset falling exactly on a node boundary belongs to the node
      // before it, so a range never ends at offset 0 of the following node.
      if (isEnd ? starts[i] < offset : starts[i] <= offset) {
        return [nodes[i], offset - starts[i]];
      }
    }
    return [nodes[0], 0];
  };
  const ranges: Range[] = [];
  for (let at = joined.indexOf(needle); at !== -1; at = joined.indexOf(needle, at + needle.length)) {
    const range = doc.createRange();
    range.setStart(...locate(at, false));
    range.setEnd(...locate(at + needle.length, true));
    ranges.push(range);
  }
  return ranges;
}

interface SpecimenRanges {
  matches: Range[];
  current: Range;
  /** A range added to and removed from the match highlight in the middle of the
   *  run, since TASK-47 updates a registered highlight's ranges as well as
   *  replacing it. */
  extra: Range;
}

function specimenRanges(doc: Document): SpecimenRanges {
  const byId = (id: string): Element => {
    const element = doc.getElementById(id);
    if (element === null) {
      throw new Error(`the specimen has no #${id}`);
    }
    return element;
  };
  const single = rangesOf(doc, byId('hl-single'), 'NEEDLE');
  const across = rangesOf(doc, byId('hl-across'), 'foobarbazqux');
  const alphas = rangesOf(doc, byId('hl-current'), 'alpha');
  const extra = rangesOf(doc, byId('hl-single'), 'needle');
  if (single.length !== 1 || across.length !== 1 || alphas.length !== 3 || extra.length !== 1) {
    throw new Error('the specimen text does not hold the matches this section paints');
  }
  return { matches: [...single, ...across, ...alphas], current: alphas[1], extra: extra[0] };
}

function ruleParsedIn(doc: Document): boolean {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      // Duck-typed rather than `instanceof CSSStyleRule`: a rule in the frame's
      // sheets is an instance of the frame realm's class, not the parent's.
      if ('selectorText' in rule && String(rule.selectorText).includes(`highlight(${MATCH_HIGHLIGHT})`)) {
        return true;
      }
    }
  }
  return false;
}

function selectorSupported(realm: HighlightRealm): boolean | null {
  const supports = realm.CSS?.supports;
  if (typeof supports !== 'function') {
    return null;
  }
  try {
    return supports.call(realm.CSS, `selector(::highlight(${MATCH_HIGHLIGHT}))`);
  } catch {
    return false;
  }
}

/** Register, change, clear and register again, with a paint between each step,
 *  ending registered so the screenshot shows the final state. The intermediate
 *  steps are what TASK-47 will do on every keystroke and every move between
 *  matches, and the frame's observer has to stay silent through all of them. */
async function exercise(
  registry: HighlightRegistry,
  build: (ranges: Range[]) => Highlight,
  ranges: SpecimenRanges,
): Promise<void> {
  const register = () => {
    const matches = build(ranges.matches);
    const current = build([ranges.current]);
    current.priority = 1;
    registry.set(MATCH_HIGHLIGHT, matches);
    registry.set(CURRENT_HIGHLIGHT, current);
    return matches;
  };
  const first = register();
  await nextFrame();
  first.add(ranges.extra);
  await nextFrame();
  first.delete(ranges.extra);
  await nextFrame();
  registry.delete(CURRENT_HIGHLIGHT);
  await nextFrame();
  registry.clear();
  await nextFrame();
  register();
  await nextFrame();
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function apiReading(where: HighlightWhere, realm: HighlightRealm, doc: Document): HighlightReading {
  return {
    where,
    registryPresent: realm.CSS?.highlights !== undefined,
    constructorPresent: typeof realm.Highlight === 'function',
    selectorSupported: selectorSupported(realm),
    ruleParsed: ruleParsedIn(doc),
    registered: false,
    error: null,
    registrySize: null,
    mutations: null,
  };
}

/** The parent document: the positive control (AC #2) and the cross-element
 *  range (AC #3) where `MarkdownView` would paint. The rule goes in as a
 *  `<style>` element rather than through the probe's stylesheet so the parent
 *  and the frame are handed the same text. */
async function runParent(host: HTMLElement): Promise<HighlightReading> {
  host.replaceChildren();
  document.getElementById('probe-highlight-style')?.remove();
  const style = document.createElement('style');
  style.id = 'probe-highlight-style';
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
  host.innerHTML = highlightSpecimen();

  const realm = window as unknown as HighlightRealm;
  const reading = apiReading('parent', realm, document);
  const registry = realm.CSS?.highlights;
  const Ctor = realm.Highlight;
  if (registry === undefined || Ctor === undefined) {
    reading.error = 'the API is missing from the app document';
    return reading;
  }
  try {
    await exercise(registry, (ranges) => new Ctor(...ranges), specimenRanges(document));
    reading.registered = registry.has(MATCH_HIGHLIGHT) && registry.has(CURRENT_HIGHLIGHT);
    reading.registrySize = registry.size;
  } catch (e) {
    reading.error = errorText(e);
  }
  return reading;
}

/** Resolve with the fixture's document from inside the frame element's `load`,
 *  having already done what `HtmlView`'s load pass does: written into the frame
 *  first, and attached the observer only afterwards. */
function loadFrame(
  host: HTMLElement,
  onLoadPass: (doc: Document) => void,
): Promise<{ frame: HTMLIFrameElement; doc: Document }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the highlight fixture never loaded into its frame'));
    }, LOAD_TIMEOUT_MS);
    let settled = false;
    const frame = mountFrame(host, highlightFixture(), () => {
      // A later `load` would be a navigation away from the fixture, and running
      // the load pass on it would attach a second observer to another document.
      if (settled) {
        return;
      }
      let doc: Document | null = null;
      try {
        doc = frame.contentDocument;
      } catch {
        // Reported below as the premise failing, like a null document.
      }
      if (doc === null) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('contentDocument is not readable: the frame is not same-origin with the parent'));
        return;
      }
      if (doc.getElementById('alive') === null) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      onLoadPass(doc);
      resolve({ frame, doc });
    });
    frame.style.height = `${FRAME_HEIGHT_PX}px`;
  });
}

async function runFrame(host: HTMLElement, constructorRealm: 'frame' | 'parent'): Promise<HighlightReading> {
  let records = 0;
  // Constructed in the parent and observing the frame's document with at least
  // the options `HtmlView` uses, `characterData` added: a reading of zero has to
  // cover every kind of mutation, not only the kinds that restart the view.
  const observer = new MutationObserver((list) => {
    records += list.length;
  });
  const { frame, doc } = await loadFrame(host, (frameDoc) => {
    const style = frameDoc.createElement('style');
    style.textContent = HIGHLIGHT_CSS;
    frameDoc.head.appendChild(style);
    observer.observe(frameDoc, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const where: HighlightWhere = constructorRealm === 'frame' ? 'frame, frame realm' : 'frame, parent realm';
  const realm = frame.contentWindow as unknown as HighlightRealm | null;
  if (realm === null) {
    observer.disconnect();
    throw new Error('the frame has no window');
  }
  const reading = apiReading(where, realm, doc);
  const registry = realm.CSS?.highlights;
  const Ctor = constructorRealm === 'frame' ? realm.Highlight : (window as unknown as HighlightRealm).Highlight;
  try {
    if (registry === undefined || Ctor === undefined) {
      reading.error =
        registry === undefined
          ? "the frame's window has no CSS.highlights"
          : `the ${constructorRealm} realm has no Highlight constructor`;
    } else {
      await exercise(registry, (ranges) => new Ctor(...ranges), specimenRanges(doc));
      reading.registered = registry.has(MATCH_HIGHLIGHT) && registry.has(CURRENT_HIGHLIGHT);
      reading.registrySize = registry.size;
    }
  } catch (e) {
    reading.error = errorText(e);
  }
  await sleep(SETTLE_MS);
  const during = records + observer.takeRecords().length;
  records = 0;
  doc.body.setAttribute('data-probe-mutation-control', '1');
  await sleep(SETTLE_MS);
  const control = records + observer.takeRecords().length;
  observer.disconnect();
  reading.mutations = { during, control };
  return reading;
}

function check(id: string, ac: number[], title: string, verdict: Verdict, detail: string): HighlightCheck {
  return { id, ac, title, verdict, detail };
}

function apiCheck(reading: HighlightReading, ac: number[]): HighlightCheck {
  const present = reading.registryPresent && reading.constructorPresent;
  return check(
    `api.${reading.where}`,
    ac,
    `${reading.where}: CSS.highlights and Highlight exist, and the ::highlight() rule survives parsing`,
    present && reading.ruleParsed ? 'pass' : 'fail',
    `CSS.highlights: ${reading.registryPresent}; Highlight constructor: ${reading.constructorPresent}; CSS.supports('selector(::highlight(…))'): ${reading.selectorSupported ?? 'CSS.supports missing'}; rule present in the document's stylesheets after parsing: ${reading.ruleParsed}.`,
  );
}

function registerCheck(reading: HighlightReading, ac: number[]): HighlightCheck {
  return check(
    `register.${reading.where}`,
    ac,
    `${reading.where}: register, change, clear and register again without an exception, ending registered`,
    reading.registered && reading.error === null ? 'pass' : 'fail',
    reading.error === null
      ? `both highlights registered at the end; registry size ${reading.registrySize ?? '?'}. Whether they PAINTED is the screenshot's to say, not this row's.`
      : `failed: ${reading.error}`,
  );
}

function mutationCheck(reading: HighlightReading): HighlightCheck {
  const m = reading.mutations;
  // A run that stopped part-way registered less than it claims to have, so its
  // silence is not the silence of the full sequence.
  const completed = reading.registered && reading.error === null;
  let verdict: Verdict;
  if (m === null || m.control === 0 || !completed) {
    verdict = 'inconclusive';
  } else {
    verdict = m.during === 0 ? 'pass' : 'fail';
  }
  const caveats = [
    m !== null && m.control === 0 ? ' — the observer heard nothing, so a zero above is not evidence' : '',
    completed
      ? ''
      : ' — the highlight sequence did not complete (see the register row), so a zero above covers less than it says',
  ].join('');
  return check(
    `mutation.${reading.where}`,
    [5],
    `${reading.where}: registering and clearing highlights produces no MutationObserver record`,
    verdict,
    m === null
      ? 'not measured'
      : `records while highlights were registered, changed, cleared and registered again: ${m.during}; records from one deliberate attribute write afterwards (the control): ${m.control}${caveats}.`,
  );
}

/** Each location is run on its own and a failure in one is reported rather than
 *  ending the run: an engine lacking the API in the frame alone is exactly the
 *  outcome the parent's positive control exists to tell apart. */
export async function runHighlightChecks(hosts: HighlightHosts): Promise<HighlightRun> {
  const failed = (where: HighlightWhere, e: unknown): HighlightReading => ({
    where,
    registryPresent: false,
    constructorPresent: false,
    selectorSupported: null,
    ruleParsed: false,
    registered: false,
    error: errorText(e),
    registrySize: null,
    mutations: null,
  });
  const parent = await runParent(hosts.parent).catch((e: unknown) => failed('parent', e));
  const frameRealm = await runFrame(hosts.frameRealm, 'frame').catch((e: unknown) => failed('frame, frame realm', e));
  const parentRealm = await runFrame(hosts.parentRealm, 'parent').catch((e: unknown) =>
    failed('frame, parent realm', e),
  );

  return {
    readings: [parent, frameRealm, parentRealm],
    checks: [
      apiCheck(parent, [2, 3]),
      registerCheck(parent, [2, 3]),
      apiCheck(frameRealm, [4]),
      registerCheck(frameRealm, [4]),
      mutationCheck(frameRealm),
      registerCheck(parentRealm, [4]),
      mutationCheck(parentRealm),
    ],
  };
}
