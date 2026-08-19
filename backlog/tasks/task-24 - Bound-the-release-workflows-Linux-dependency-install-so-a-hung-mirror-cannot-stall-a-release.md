---
id: TASK-24
title: >-
  Bound the release workflow's Linux dependency install so a hung mirror cannot
  stall a release
status: To Do
assignee: []
created_date: '2026-08-19 21:44'
labels:
  - bug
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
- [ ] #1 The Linux dependency step cannot hang indefinitely: it carries a bound (step or job timeout-minutes) chosen and stated, so a stalled mirror fails the job instead of leaving it in progress
- [ ] #2 apt is told not to wait forever on the dpkg lock, and a transient failure is retried rather than failing the release on one bad response
- [ ] #3 The chosen bound is recorded with its reason where the workflow declares it, including that a fix on the default branch does not apply to a re-run of an already-tagged release
<!-- AC:END -->
