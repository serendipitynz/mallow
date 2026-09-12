---
id: TASK-33
title: Give the settings ordering one authority instead of one per window
status: To Do
assignee: []
created_date: '2026-09-12 07:31'
labels:
  - bug
dependencies: []
priority: medium
type: bug
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-12.8 gave a changed preference an ordering so that two windows cannot settle on different values: each window stamps a change with `{at, origin}` before applying it to itself, and ignores anything not newer. The ordering is correct for the windows that are open. It has two holes, both raised by the external reviewer on PR #57 and neither fixed there — the pull request was merged while the round was still running.

## What is wrong

**The persisted value can disagree with every open window.** `saveSetting` (`src/lib/settings.ts`) stamps before the store write, which is what makes the live ordering right: the caller has already applied the value, so a stamp taken after the write would judge a change broadcast during that write to be the newer of the two. But the write itself joins no order. Window A stamps T1 and starts writing; window B stamps T2 (later) and its write completes first; A's write lands afterwards. Every open window is on B's value and settings.json holds A's. A window opened after that, and the next launch, read A's.

**The two are in tension, and the merged code picked a side.** Before the stamp moved ahead of the write, the last writer to complete was also the last to stamp, so the file and the windows agreed — at the cost of the live divergence the stamp exists to close. Neither position is right on its own: the write has to be ordered by the same stamp the windows are ordered by.

**The high-water mark is per WebView, so a new window cannot participate after a clock rollback.** `mintAt` takes the maximum of the wall clock and one past what *this window* already knows for the key, which is what stops a window stamping itself into silence when the clock steps backwards. A window opened after the step knows nothing: its map starts empty, so it mints from the low wall clock, and every window that lived through the step refuses its first change to that key while it applies the change to itself. It stays refused until real time passes the mark.

## Where this should go

Rust is already the authority for the two settings keys several windows write - `recentFolders` (`recent.rs`) and `windows` (`session.rs`) - and the reason recorded in AGENTS.md is this one: several windows writing one key from JS cannot order themselves. The ordering here is the same shape.

Rust sees every broadcast, so it can hold the per-key high-water mark for the process and raise a stamp that arrives below it. The originating window does not need to know: it records its optimistic stamp, receives its own broadcast carrying the raised one, and records that instead - the value is unchanged, so re-applying it is invisible. That closes the second hole without making the mint asynchronous, which it cannot be (the stamp has to exist before the window applies the change to itself, which is why it is not minted in Rust today).

The first hole needs the write to be refused when it is stale rather than merely late. Whether that means moving the store write for propagated preferences into Rust behind the same lock, or keeping it in JS and gating it on the stamp still being the newest, is the choice this task makes - a JS gate narrows the window without closing it, since a write already handed to the plugin cannot be recalled.

## What this is not

Neither hole is reachable in ordinary single-user use. The first needs two windows writing one preference with store writes that complete out of order; the second needs the wall clock stepped backwards and then a new window. TASK-12.8's acceptance criteria are met and its manual round passed, including the relaunch. This is hardening the ordering it introduced, not a correction to what it claimed.

## Where the evidence is

PR #57's review rounds, by the bot account: the round that raised these two is the fourth, posted against `3704b8c` after the merge. Rounds 1-3 are on the same pull request, and the author replies record which findings were refuted and why one refutation was wrong.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A preference written while another window is writing the same one leaves settings.json holding the value every open window is showing, whichever write completes last
- [ ] #2 A window opened after the wall clock has stepped backwards can change a preference and have every window that lived through the step follow it
- [ ] #3 The stamp is still minted before the originating window applies the change to itself, so no preference waits on a round trip to take effect
- [ ] #4 Whichever way the stale write is refused, the choice is written down with why the other was not taken
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 With two windows, one preference changed in each within the same second, settings.json and both windows agree afterwards and a third window opened next reads the same value
- [ ] #3 AGENTS.md and AGENTS.ja.md describe where the ordering authority now lives, replacing what TASK-12.8 wrote about the per-window high-water mark
<!-- DOD:END -->
