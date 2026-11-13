---
id: TASK-54
title: Scan the dependencies for published advisories on a schedule
status: To Do
assignee: []
created_date: '2026-11-13 05:08'
labels:
  - chore
dependencies:
  - TASK-53
references:
  - .github/workflows/check.yml
  - AGENTS.md
priority: medium
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing in the repository checks dependencies for published advisories: `.github/` has no `dependabot.yml`, and neither `check.yml` nor `release.yml` runs an audit. The scan that found TASK-53's advisories was run by hand. This task makes the scan recur without anyone remembering to run it.

The shape proposed, to be confirmed at the start:
- **Dependabot alerts and security updates**, switched on in the repository settings. They watch `pnpm-lock.yaml` and `src-tauri/Cargo.lock` continuously and open a PR when a fixed version exists. This is a repository setting rather than a file, so it is the owner's action.
- **`.github/dependabot.yml` for version updates** of `npm`, `cargo` (directory `/src-tauri`) and `github-actions`, weekly and grouped so a week's updates arrive as few PRs. Whether the npm and cargo groups take minor and patch only, leaving majors to their own PRs, is to be settled.
- **A separate audit workflow** (`audit.yml`) on `schedule:` (weekly) and `workflow_dispatch`, and on pull requests that change a lockfile. It is kept out of `check.yml` on purpose: an advisory is published independently of the code, so a gate inside `check.yml` would turn every unrelated pull request red the day one appears.

To settle at the start:
- The Rust tool: `cargo audit` (rustsec/audit-check, advisories only) or `cargo deny` (advisories plus licences, bans and sources, at the cost of a `deny.toml` to maintain — the licence half overlaps with `pnpm notices`), or OSV-Scanner covering both lockfiles with one tool. Each runs in CI only and adds no production dependency.
- The threshold that fails the job: for example `pnpm audit --prod --audit-level=high` for npm, and every RustSec vulnerability (not the unmaintained / unsound warnings) for Rust.
- How the advisories TASK-53 could not fix are accepted: each ignore entry names the advisory and the reason it was accepted (katex, quick-xml, zip, the unmaintained GTK3 / Tauri transitives), so an accepted advisory is visible rather than silently skipped, and is revisited when its upstream moves.
- How a failure reaches the owner: a red scheduled run notifies only by GitHub's workflow-failure mail.

AGENTS.md's "Verifying changes" section and the workflow are updated together, as that section requires.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dependabot alerts and security updates are on for the repository (the owner's setting), and the task records that they are
- [ ] #2 .github/dependabot.yml schedules grouped version updates for npm, cargo (/src-tauri) and github-actions
- [ ] #3 An audit workflow separate from check.yml runs the npm and Rust scans weekly, on workflow_dispatch, and on pull requests that change a lockfile
- [ ] #4 The tool for the Rust scan and the threshold that fails each scan are settled and written in the task
- [ ] #5 Each advisory TASK-53 left unfixed is accepted by an ignore entry naming the advisory and its reason, and no other advisory is ignored
- [ ] #6 A run of the workflow on workflow_dispatch passes on main, and fails when an ignore entry is removed
- [ ] #7 AGENTS.md's Verifying changes section describes the workflow, and biome ci passes
<!-- AC:END -->
