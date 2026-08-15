---
id: decision-5
title: >-
  Report read failures as a typed ReadError the frontend resolves rather than
  rejects
date: '2026-08-16 10:30'
status: accepted
---
## Context

decision-2 declined encoding conversion but required the two common failures —
a CP932 CSV and a binary plist — to reach the user as messages that name the
cause. `read_file` was `fs::read_to_string` returning `Result<String, String>`,
so both arrived as one `io::Error` string and the frontend could only tell them
apart by matching on its text, which is brittle across Rust versions.

Every remaining file-kind task renders that failure, so the shape is fixed once
here rather than per task.

Two shapes were on the table for the value, and two for how the frontend
receives it. `read_file` is the only text-reading path in the app: `Viewer` and
`custom-emoji` are its sole callers.

## Decision

### The failure is a tagged value, discriminated by `kind`

`read_file` returns `Result<String, ReadError>`, where `ReadError` is a
serde-tagged enum serialized as `{ "kind": "...", "path": "...", ... }`. A code
plus a free message was the alternative; the tagged enum was taken because Rust
then makes an unhandled cause a compile error on the backend side rather than a
string nobody matched.

Four causes, not the two the tasks strictly needed:

| `kind` | Cause | Who words it |
|---|---|---|
| `invalidUtf8` | the bytes are not UTF-8 once the BOM is off | the frontend, via `lib/i18n` |
| `binary` | the leading bytes match a known magic (`bplist00` for now) | the frontend, via `lib/i18n` |
| `tooLarge` | the file exceeds the 10 MiB cap | the backend, message unchanged |
| `io` | the OS refused the read (missing, permissions, other I/O) | the backend, message unchanged |

`tooLarge` and `io` are kept apart rather than folded into one catch-all: one
message is mallow's own and the other is the OS's, and a single name would stop
pointing at either. The two backend-worded causes carry their message in the
value, because their wording is required to stay exactly as it was.

### The wrapper resolves a discriminated result instead of rejecting

`readFile` in `lib/tauri.ts` returns
`Promise<{ ok: true; text } | { ok: false; error: ReadError }>`.

TypeScript's `Promise` has no type parameter for a rejection value, so a
rejecting wrapper cannot state the failure shape as a static contract at all —
a runtime type guard would work, but nothing forces a caller to call it, and
four new views are about to be written against this. Resolving a discriminated
union makes `tsc` reject a caller that does not handle the failure branch.

`lib/read-error.ts` holds the mirrored type, the decoder that narrows whatever
`invoke` rejected with, and the message selector. It imports no Tauri API, so it
is unit-tested under the Node environment the rest of the suite uses. Anything
that is not a well-formed variant is folded into `io` carrying its
stringification: a malformed value means the IPC layer failed, not the read.

### The BOM is stripped in `read_file`, once

Before the decode, and after the magic check. Every text-reading kind therefore
receives text with no BOM, so a CSV header cell and an XML declaration do not
each need their own strip.

## Consequences

- decision-2's account of the mechanism ("`read_file` is `fs::read_to_string`,
  so a file that is not valid UTF-8 fails to read at all") no longer describes
  the code. Its actual decision — no encoding-conversion dependency — is
  unchanged and still holds; only the failure's shape changed.
- Adding a binary format is one entry in the magic table, not a new code path.
  The frontend prints whatever format name the entry carries.
- `binary` cannot be reached from the UI until some task maps a binary-prone
  extension into `file_kind`; `.plist` is not mapped, and whether to map it is
  TASK-4's decision. Until then the cause is exercised only by the Rust unit
  tests.
- A cause the frontend words is added by extending the union in
  `lib/read-error.ts` and adding keys to both `ja` and `en`. A cause the backend
  words needs neither.
