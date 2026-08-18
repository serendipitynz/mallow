---
id: TASK-5.1
title: 'Build the frame: markup transform, sandbox, base style, toggle'
status: Done
assignee: []
created_date: '2026-07-30 10:25'
updated_date: '2026-08-18 12:15'
labels:
  - feature
milestone: m-1
dependencies:
  - TASK-2
  - TASK-7
  - TASK-9
  - TASK-10
parent_task_id: TASK-5
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Part 1 of 3 for TASK-5 (see decision-3). Everything needed to put a document on screen safely, with no navigation or outline behavior yet.

1. Read the file as text through the existing read_file path (the 10 MiB cap applies). Never point the frame at an asset: URL - that would escape the CSP.
2. Decide up front whether to render at all: 10 MiB of HTML can hold hundreds of thousands of elements, and the rendered view is the default, so a large or hostile document can stall the WebView. Pick a render threshold well below the byte cap (node count, or bytes plus node count) and fall back to the capped source view from TASK-9 with a message when it is exceeded.
3. Transform the markup with DOMParser, not string surgery. Build with new DOMParser().parseFromString(text, 'text/html'), operate on the DOM, and serialise into srcdoc. Regex over HTML fails on uppercase tags, newlines inside tags, attribute order and srcset descriptor commas - and this transform holds the network boundary, so it has to be exact. Keep the DOMParser call at the component boundary and factor the decisions (relative-to-asset URL resolution, srcset descriptor splitting, counting) into string-in/string-out pure functions under src/lib/ so they are testable under Node - see doc-1.
4. Preserve the doctype. documentElement.outerHTML does NOT include it (DOMParser keeps it on doc.doctype), and a srcdoc document without one parses in quirks mode - which changes layout and shifts which element reports the scroll height, breaking TASK-5.2's measurement in a way AC #1 would not catch. Emit '<!DOCTYPE html>' ahead of the serialised element, or carry the doctype in the transform result.
5. Define the transform's return contract in one place, since 5.2 and 5.3 both consume it: at least { html, counts, title, hadDoctype }. Returning the title here means 5.3 does not parse the document a second time.
6. Remove nested iframe and frame elements: a nested frame pointed at an asset: URL loads a document that carries NO CSP (decision-1, fact 1), so its subresource loads would sit outside both the CSP and the notice-bar count. object and embed need no handling - the CSP already sets object-src 'none'.
7. Remove the base element, which would otherwise redirect every relative reference.
8. Rewrite local media references to convertFileSrc URLs: img src, img srcset, source src, source srcset, video src, video poster. srcset is a comma-separated list with optional descriptors (1x, 320w) and the paths themselves may contain commas, so parse it rather than splitting.
   Do NOT touch, and unit-test that they survive untouched: data: URIs (base64-embedded images are the most typical shape of AI-generated single-file HTML, and img-src already allows data:), http(s) URLs, protocol-relative //host/... URLs, blob:, empty values, and bare #fragments.
   Out of scope, to be stated rather than left silently broken: relative url() inside CSS, relative link rel=stylesheet and local fonts (decision-3 explains why rewriting those would need a CSP change), and audio src, track src, input type=image src, inline SVG image/use href. Note the asymmetry that <audio><source src> IS rewritten while <audio src> is not, and either accept it explicitly or align the two.
9. Resolving relative paths needs a dirname helper in lib/path.ts, which today has only basename/join/isInside/ancestorDirs and does not normalise '..'. Add it with tests, and decide what happens for document-absolute paths (/x.png), for '..' escapes above the opened folder, and for dot-prefixed directories such as ./.assets/x.png - the asset scope sets require_literal_leading_dot on unix (tauri-2.11.3/src/scope/fs.rs), so a recursive ** grant does not match those and they fail silently unless handled.
10. Force a light canvas for the frame from the parent side rather than fighting the document's own styles: set color-scheme and a background on the iframe ELEMENT in the app's SCSS. The embedding element's used colour scheme becomes the embedded document's preferred scheme (css-color-adjust-1), so this also settles what prefers-color-scheme evaluates to inside, and it keeps working when the app theme changes - a srcdoc-baked style would not, since theme.ts:52 only notifies on resolved light/dark changes and not on palette-only switches. See decision-3.
11. Feed the markup to an iframe via srcdoc with sandbox=allow-same-origin and NO allow-scripts. Do not add allow-forms, allow-popups or allow-top-navigation. allow-same-origin is only safe because allow-scripts is absent - decision-3 explains why adding it later is not a small change.
12. Rendered/source toggle in the position ConfigView uses, rendered by default.

Verify in a built app, not only in pnpm tauri dev: there is no CSP under dev on desktop (see TASK-7), so the second containment layer is simply absent there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A self-contained HTML file with an inline style element renders with its styling applied
- [x] #2 An inline script does not execute, and neither does an on-star attribute, a javascript: URL, a form submission, nor a meta refresh - checked in a built app, where the CSP actually exists
- [x] #3 A nested iframe or frame element is removed from the document, and a base element is ignored
- [x] #4 The frame's canvas is light under every theme, and a document that declares color-scheme support with a text colour but no background stays readable
- [x] #5 The rendered document is in standards mode (compatMode is CSS1Compat), so the doctype survived the transform
- [x] #6 Local media loads through every rewritten attribute: img src, img srcset, source src, source srcset, video src, video poster
- [x] #7 A document whose images are data: URIs renders unchanged, and unit tests pin data:, http(s), protocol-relative, blob:, empty and fragment-only values as untouched
- [x] #8 srcset values with descriptors and with commas inside paths survive the rewrite, covered by unit tests
- [x] #9 The transform returns the documented contract, including the title, so no consumer parses the document again
- [x] #10 The path helpers the rewriting introduced have unit tests: dirname and resolvePath in lib/path.ts for '..' above the opened folder and for dot-prefixed directories, and classifyRef in lib/html-doc.ts for document-absolute paths - which are answered there rather than in lib/path because the decision is what to do with a URL, not how to join a path
- [x] #11 A document above the render complexity threshold falls back to the capped source view instead of stalling the WebView
- [x] #12 The rendered/source toggle is present and the rendered view is the default
- [x] #13 The CSP in tauri.conf.json is unchanged
- [x] #14 pnpm build and pnpm test pass
- [x] #15 The URL-resolution, srcset-splitting and counting helpers are unit-tested as pure functions under Node
- [x] #16 The complete parse-mutate-serialize transform is exercised in a DOM-capable environment - a browser or built-WebView fixture, or a deliberately adopted DOM test environment - since browser normalization of malformed markup and the actual base/frame removal cannot be observed from pure helpers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Visual round, 2026-08-18, macOS (WKWebView), on a built app - there is no CSP under 'pnpm tauri dev' on desktop, so the containment criteria could not have been answered there.

Probe ('MALLOW_PROBE=1 pnpm tauri build --debug --no-bundle', then the TASK-5.1 - markup transform section): 11 of 11 checks pass, which is every check runTransformChecks emits. Notably 'rewrites' reports 8 references rewritten with none left as written, which covers every attribute AC #6 names; 'counts' reports unresolvedLocalRefs 3 / externalRefs 1 / links 1 / scripts 1 against the fixture; compatMode is CSS1Compat; a 30,004-element document is neither serialized nor rendered.

The first probe run reported 'rewrites' as FAIL, and the transform was not what was wrong: the fixture writes src=img/logo.png while the expectation asked for /probe/docs/logo.png. Fixed in fc2afbd, which also added the converse assertion - a local path still present as written now fails the check, since 'the asset URL is in there somewhere' passes vacuously when an attribute is walked past.

In the app, over _sandbox/samples/: rendered.html shows its own styling and loads img src, both img srcset candidates, picture > source srcset and the video poster; the data: image renders and /absolute.png stays broken by design. That was four of the six attributes AC #6 enumerates: on that look 'source src' and 'video src' were rewritten (the probe's 'rewrites' row covers all eight references) but nothing had fetched them, since the sample carried no video file. A second look, after rendered.html gained one, watched both draw the file's first frame - 'video src' from a <video> with no poster, so the frame is attributable to that attribute and not to a poster - which closes #6 on all six.

What that second look also showed, and what is NOT this task's: the controls on a video inside the frame do not start playback, while the same file plays when opened directly in mallow. Recorded in TASK-19, which documents what the rendered view leaves inert. rendered-inert.html leaves the window title unchanged (inline script), the background unpainted (on* attribute), the page where it was (meta refresh), shows no nested frame, and renders the relative image the removed <base> would have redirected; the javascript: link and the form's submit button were both pressed and did nothing. rendered-colorscheme.html keeps a white canvas with readable dark text under a dark palette. rendered-huge.html (36,006 elements) falls back to the source view with its notice.
<!-- SECTION:NOTES:END -->
