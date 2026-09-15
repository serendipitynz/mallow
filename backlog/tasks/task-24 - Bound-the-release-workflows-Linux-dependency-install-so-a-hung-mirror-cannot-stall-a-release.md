---
id: TASK-24
title: >-
  Bound the release workflow's Linux dependency install so a hung mirror cannot
  stall a release
status: Done
assignee: []
created_date: '2026-08-19 21:44'
updated_date: '2026-09-15 22:21'
labels:
  - bug
milestone: m-3
dependencies: []
type: bug
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During the v0.6.0 release round (2026-08-20) the x86_64 Linux build job sat in 'Install Linux system dependencies' twice in a row - 31 minutes on the first attempt, then again on a re-run of that job alone - while the arm64 job ran the same step in under a minute at the same moment. The same step took 48 seconds in the v0.5.0 run, and GitHub reported no Actions incident, so the cause is on the Ubuntu mirror side rather than in the workflow. What the workflow contributes is that nothing bounds it: the step is a bare 'sudo apt-get update && sudo apt-get install -y ...' with no retries and no lock timeout, and neither the job nor the step sets timeout-minutes, so the default 360-minute job timeout is what would eventually end it. A release cut into that state has no failure to react to - it has a job that looks like it is still working.

The release is not blocked by this on its own: the draft holds the other seven assets, and re-running the one job is what the round did. The cost is the time spent deciding whether to wait, and the risk of a round that publishes a draft missing a platform because the job was still 'in progress' when someone stopped watching.

Two mechanisms are worth separating, because a fix that only adds retries does not address the second. apt can block on the dpkg lock (unattended-upgrades on the runner) and it can block on a mirror that accepts the connection and then stalls; -o DPkg::Lock::Timeout covers the first, and a step timeout plus retry covers the second. Note also that re-running a tagged run uses the workflow file from the tagged commit, so a fix landing on the default branch does not reach a release already in flight - it reaches the next tag, or a workflow_dispatch run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Linux dependency step cannot hang indefinitely: it carries a bound (step or job timeout-minutes) chosen and stated, so a stalled mirror fails the job instead of leaving it in progress
- [x] #2 apt is told not to wait forever on the dpkg lock, and a transient failure is retried rather than failing the release on one bad response
- [x] #3 The chosen bound is recorded with its reason where the workflow declares it, including that a fix on the default branch does not apply to a re-run of an already-tagged release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The bound is a step-level timeout-minutes: 10 on 'Install Linux system dependencies' in release.yml, with three bounded attempts inside it.

Sizing. A healthy run of this step was 48s in v0.5.0 and under a minute on arm64 during the v0.6.0 stall, against 31 minutes for the stall itself; 10 minutes is ten times healthy and a third of the stall. Inside that, each attempt is 45s for apt-get update and 135s for the install, so three attempts plus 30s of backoff is 9.5 minutes and the loop cannot be cut off mid-attempt by its own step bound.

What stalled was never identified, and the description's attribution to the Ubuntu mirror is an inference rather than a finding. Neither arm64 finishing in under a minute at the same moment nor v0.5.0's 48 seconds rules anything out on its own: package resolution, versions, maintainer scripts and repository paths all differ by architecture, and versions move between releases. A mirror, the runner's networking, DNS, a proxy and the x86_64 package closure itself all fit what was seen. The fix does not rest on knowing which, since a bound is worth having whichever it was.

Both stalls named in the description are still covered separately. -o DPkg::Lock::Timeout=60 bounds the dpkg lock; the per-command timeout bounds a connection that is accepted and then stops answering, which a retry alone would not, since one stalled connection would otherwise spend the whole budget on a single attempt.

It is 'sudo timeout' and not 'timeout sudo' so the timeout runs as root and signals apt directly. The first wording of this said the other order would kill only the wrapper and leave the lock held, and that is wrong: sudo relays the signals it receives to its command (sudo(8), 'Signal handling'), so a SIGTERM would arrive. What sudo cannot relay is SIGKILL, so this order is what keeps a hard kill available if a SIGTERM ever proves not to be enough.

Scope is release.yml alone, per the description. check.yml has the same bare apt-get in two jobs; a stall there turns a PR red without blocking a release, so it is left alone rather than widened past the AC.

Verification. The workflow only runs in CI, so the loop was extracted and replayed locally under bash -e with apt stubbed: healthy exits 0 on the first attempt, a transient failure recovers on the third, and a timeout (124) on every attempt exits 1 with no sleep after the last one. The YAML parses and the step script passes bash -n. What no local check can show is the bound firing against a real stall — that needs one to happen, so a green release round says the step still works, not that the timeout was exercised.

Review history worth keeping: all three findings across two rounds were comment accuracy, none was behaviour, and each was a claim wider than its evidence. The third one survived the first correction — 'this rules out the workflow and the package list' replaced 'the mirror stalled', and was itself unsupported for the same reason. Narrowing an overclaim is where the next overclaim gets written.
<!-- SECTION:NOTES:END -->
