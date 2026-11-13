---
id: TASK-54
title: Scan the dependencies for published advisories on a schedule
status: Done
assignee: []
created_date: '2026-11-13 05:08'
updated_date: '2026-11-13 08:46'
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
- [x] #1 Dependabot alerts and security updates are on for the repository (the owner's setting), and the task records that they are
- [x] #2 .github/dependabot.yml schedules grouped version updates for npm, cargo (/src-tauri) and github-actions
- [x] #3 An audit workflow separate from check.yml runs the npm and Rust scans weekly, on workflow_dispatch, and on pull requests that change a lockfile
- [x] #4 The tool for the Rust scan and the threshold that fails each scan are settled and written in the task
- [x] #5 Each advisory TASK-53 left unfixed is accepted by an ignore entry naming the advisory and its reason, and no other advisory is ignored
- [x] #6 A run of the workflow on workflow_dispatch passes on main, and fails when an ignore entry is removed
- [x] #7 AGENTS.md's Verifying changes section describes the workflow, and biome ci passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の判定 (2026-11-13、オーナー判断):
- Rust のスキャンは cargo-audit。脆弱性だけで落とし、unmaintained / unsound は警告として表示する。ignore が要るのは zip の 4 件だけで、src-tauri/.cargo/audit.toml にそれぞれ理由のコメント付きで置く。CI へは taiki-e/install-action のビルド済みバイナリで入れる
- npm は本番依存を全重大度で落とす (`pnpm audit --prod`、snz_studio の audit.yml と同じ)。ignore は katex の 1 件で、pnpm 11 が読む pnpm-workspace.yaml の auditConfig.ignoreGhsas に置く (手元で ignore あり exit 0 / なし exit 1 を確認済み)
- dependabot.yml は tauri 2.11.3 の据え置きを ignore で明示する。tauri 2.12 を要求し始める版 (tauri ≥2.12、tauri-build ≥2.7、opener ≥2.6、dialog ≥2.8、store ≥2.5、window-state ≥2.5、updater ≥2.13、process ≥2.4、single-instance ≥2.5) を crates.io の依存宣言から割り出した。tauri-action も AGENTS.md の理由で action-v0.6.2 に固定なので ignore する
- Dependabot alerts と自動セキュリティ更新は gh api で有効化した (2026-11-13、vulnerability-alerts 204、automated-security-fixes enabled:true)

1. pnpm-workspace.yaml に auditConfig.ignoreGhsas (katex) を足す
2. src-tauri/.cargo/audit.toml に zip の 4 件を足す。手元の cargo-audit で、ignore ありで通り、外すと落ちることを確かめる
3. .github/workflows/audit.yml: schedule (週次)、workflow_dispatch、ロックファイル類を変える PR と main への push。npm と Rust の 2 ジョブ
4. .github/dependabot.yml: npm / cargo (/src-tauri) / github-actions を週次、minor と patch をグループ化、メジャーは個別 PR、コミットの接頭辞は chore(deps)
5. AGENTS.md / AGENTS.ja.md の Verifying changes に audit.yml と Dependabot を書く
6. biome ci、actionlint 相当の確認 (YAML の構文)、PR 上で audit.yml が走って通ること
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時の判定の結果

- AC #1: 2026-11-13 に gh api で有効化した。`PUT repos/serendipitynz/mallow/vulnerability-alerts` の後で GET が 204、`automated-security-fixes` が `{"enabled":true,"paused":false}`。着手前はそれぞれ 404 と `enabled:false` だった
- AC #4: Rust は cargo-audit。脆弱性だけで落とし、unmaintained / unsound / yanked は警告として出す。npm は `pnpm audit --prod` を重大度を問わず落とす (snz_studio の audit.yml と同じ)。devDependencies は同梱されないので対象外で、手元の `pnpm audit` と Dependabot alerts で見える
- AC #5: ignore は katex の 1 件 (pnpm-workspace.yaml の auditConfig.ignoreGhsas) と zip の 4 件 (src-tauri/.cargo/audit.toml) で、それぞれ理由と解消条件をコメントに書いた。TASK-53 で残した unmaintained / unsound (glib、proc-macro-error、unic-*、zbus 系) は、この閾値では警告に留まり落ちないので ignore を置いていない。「置かなくても落ちない項目は ignore しない」はオーナーと決めた cargo-audit 案の前提 (ignore は zip の 4 件だけ)

## 検証 (2026-11-13、手元)

- `pnpm audit --prod`: auditConfig ありで exit 0 (`1 low (1 ignored)`)、外すと exit 1。pnpm 11 は package.json の pnpm 欄を読まないので pnpm-workspace.yaml に置いた
- cargo-audit 0.23.0 (scratchpad に `cargo install --root` でビルドしたもの。ユーザー環境には入れていない) を src-tauri で実行: audit.toml ありで exit 0、脆弱性 0 件、警告 11 件。audit.toml を退避すると `error: 4 vulnerabilities found!` で exit 1。src-tauri/.cargo/audit.toml が読まれることもこれで確認できた
- 警告 11 件のうち async-executor 1.14.0 (zbus 経由) は yanked。脆弱性ではないので TASK-53 の範囲外だが、`cargo update -p async-executor` で外せるかは別途見る価値がある
- biome ci: 通過。YAML 3 ファイルは構文として読めることを確認
- dependabot.yml の tauri の ignore 境界は、crates.io の各版の依存宣言から割り出した (tauri 2.12 を要求し始める最初の版)

## 未確認

- AC #6 のうち「main で workflow_dispatch の実行が通る」はマージ後にしか試せない (dispatch はデフォルトブランチにあるワークフローに対してだけ打てる)。「ignore を外すと落ちる」は上の手元の確認まで
- Dependabot が pnpm 11 の lockfile (lockfileVersion 9.0) で版更新を作れるかは、マージ後の最初の実行で分かる
- `on:` の paths に YAML アンカー (`&audited` / `*audited`) を使っている。Actions は 2025 年からアンカーを受け付けるが、この PR の audit.yml の実行が通ることで確かめる

AC #6: マージ後の 2026-11-13、main (ec3d8e3) で workflow_dispatch を実行し npm・rust とも success (run 43395797215)。ignore を外すと落ちることは上の手元の確認 (pnpm audit --prod と cargo-audit 0.23.0 でともに exit 1) による。
<!-- SECTION:NOTES:END -->
