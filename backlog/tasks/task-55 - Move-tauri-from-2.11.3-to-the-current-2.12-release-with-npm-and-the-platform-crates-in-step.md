---
id: TASK-55
title: >-
  Move tauri from 2.11.3 to the current 2.12 release, with npm and the platform
  crates in step
status: In Review
assignee: []
created_date: '2026-11-13 09:07'
updated_date: '2026-11-13 09:27'
labels:
  - chore
dependencies: []
references:
  - src-tauri/Cargo.toml
  - package.json
  - .github/dependabot.yml
  - src-tauri/.cargo/audit.toml
  - src-tauri/src/pdf.rs
  - src-tauri/src/modifier.rs
  - AGENTS.md
  - AGENTS.ja.md
priority: high
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow has held tauri at 2.11.3 because every tauri source citation in AGENTS.md is pinned to that release (decision-16, which also says "a tauri upgrade lifts" the `~2.4.5` pin on tauri-plugin-single-instance). The hold was never about a defect in 2.12. The current stable line is tauri 2.12.5 with @tauri-apps/api and cli 2.12.4 (checked 2026-11-13), and it carries changes mallow benefits from:

- **Security**: the channel-data IPC queue is bound to the webview that created it and its ids are scoped per webview (2.12.0). 2.11.6 carries only the clean-up half.
- **`asset://` is loaded asynchronously** instead of on the event-loop thread, so a slow or unreachable path no longer freezes every window (2.12.0). MediaView and the rendered views' rewritten references go through it.
- Listener leaks fixed for closed windows and webviews, and Windows focus fixes — mallow is multi-window.
- **tauri-plugin-updater 2.14.1** becomes reachable, the first release declaring zip ^9. That clears the zip entries accepted in `src-tauri/.cargo/audit.toml` and the zip Dependabot alerts dismissed on 2026-11-13 (TASK-53), provided the resolved zip is 9.0.5 or later (GHSA-m665-v7pm-7grj).

This task moves tauri to the current 2.12 release as one migration.

**Why it cannot be a Dependabot merge.** Dependabot's PRs #104 (cargo group) and #107 (npm group) each moved half of tauri: #104's lockfile resolved tauri 2.12.5, wry 0.57, muda 0.20 and tao 0.37 (pulled in by the transitive tauri-plugin-fs 2.7.1, which requires tauri ^2.12, past TASK-54's direct-dependency ignore list), and #107 moved @tauri-apps/api to 2.12.4. The tauri CLI refuses an npm package and a crate on different minors, so the paper build failed on all three platforms in both. Dependabot cannot update npm and cargo in one PR, so every tauri minor will arrive split this way.

What moves together:
- **Rust**: tauri 2.12.x, tauri-build 2.7.x, every tauri-plugin-* to its current release (single-instance to 2.5.x, lifting the `~2.4.5` pin; updater to ≥ 2.14.1). The Windows crates `pdf.rs` and `modifier.rs` use directly have to match wry's: `webview2-com` 0.38 → 0.39 and `windows-core` / `windows-sys` to the 0.62 line (Dependabot's #105 and #106 move them alone, which cannot compile against wry 0.55). The macOS `objc2-*` crates and Linux `gtk` / `webkit2gtk` are checked against what wry 0.57 uses. 2.12 sets MSRV 1.90 and drops Windows 7.
- **npm**: @tauri-apps/api, cli and every @tauri-apps/plugin-* to the matching releases.
- **The hold, restated for 2.12**: `Cargo.toml` and `package.json` pin the tauri crates and packages to `~2.12` so neither package manager can resolve a different minor on its own, and a minor upgrade is a task like this one. That replaces `.github/dependabot.yml`'s per-crate ignore list, which did not hold (above). Patch releases inside 2.12 still arrive through Dependabot.
- **AGENTS.md / AGENTS.ja.md**: every citation into tauri, tauri-runtime-wry, muda and wry source (about 17 file:line references, plus the "2.11.3" labels, 11 in each file) is re-read against the new versions and updated or corrected. The printing notes rest on wry 0.55.1's print implementation per platform and the menu notes on muda 0.19.3's GTK and macOS backends, so a changed behaviour there is a finding, not a renumbering. decision-16's pin paragraph is updated.
- **The accept lists**: the zip entries leave `src-tauri/.cargo/audit.toml` once the resolved zip is ≥ 9.0.5.

Out of scope: adopting 2.12's new APIs (`convert_file_src` in Rust, `limit_navigations_to_app_bound_domains`, `appDirectoriesOverride`, the `exit` command), each of which is its own decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tauri, tauri-build and every tauri-plugin-* crate are on their current releases on the 2.12 line, and @tauri-apps/api, cli and every @tauri-apps/plugin-* on the matching releases
- [ ] #2 webview2-com, windows-core and windows-sys match what wry uses, and the Windows arms of pdf.rs and modifier.rs compile in the paper job
- [x] #3 Cargo.toml and package.json pin every tauri crate and package tauri-cli pairs (tauri, tauri-build, tauri-plugin-*, @tauri-apps/api, cli, @tauri-apps/plugin-*) with ~ to its current minor, and dependabot.yml's per-crate tauri ignore list is replaced by one rule ignoring minor and major updates of tauri* and @tauri-apps/*
- [x] #4 Every AGENTS.md / AGENTS.ja.md citation into tauri, tauri-runtime-wry, muda and wry source is re-read against the new versions, and each one is updated, corrected or removed; decision-16's pin paragraph says what holds now
- [ ] #5 The resolved zip is 9.0.5 or later and the zip entries are gone from src-tauri/.cargo/audit.toml, with cargo audit still passing
- [ ] #6 pnpm lint, pnpm build, pnpm test, cargo fmt --check, cargo check, cargo test, the Audit workflow and the paper job on all three platforms pass
- [ ] #7 On macOS, Windows and Linux by hand: printing (Linux still refused), the menu (CmdOrCtrl+W on Windows, a pointer-chosen menu entry on Linux), restoring several windows, a second launch handing a file over, and opening an image / PDF from a folder behave as before
- [ ] #8 An update from the released v0.13.0 to a build of this branch is installed through the in-app updater on at least one platform, or the task records why it could not be
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時の判定（2026-11-13、オーナー確認済み）

- **AC#3 を改めた**。`~2.12` の固定だけでは足りない: Dependabot は既定の versioning strategy で `~2.12` を新マイナー（`~2.13`）へ書き換える PR を、npm と cargo に分けて出す。そこで dependabot.yml の per-crate の上限リストは消し、`tauri*`（cargo）と `@tauri-apps/*`（npm）の `version-update:semver-minor` / `semver-major` を ignore する規則 1 つに置き換えた。patch は従来どおり届く。
- **プラグインも `~<現マイナー>` で固定した**。tauri-cli 2.12.4 の `info/plugins.rs` は `tauri` ↔ `@tauri-apps/api` だけでなく、既知プラグインの `tauri-plugin-X` ↔ `@tauri-apps/plugin-X` も major.minor で照合し、食い違えば build / dev を止める。プラグインのマイナーも片側だけ届けば同じ割れ方をするため。`tauri-build` も `~2.7`。

## 結果

- Rust: tauri 2.12.5 / tauri-build 2.7.4 / runtime-wry 2.12.3 / wry 0.57.2 / tao 0.37.2 / muda 0.20.0、plugin は opener 2.7.3・dialog 2.8.4・store 2.5.1・window-state 2.5.0・updater 2.14.1・process 2.4.0・single-instance 2.5.5（`~2.4.5` の固定は解除）。推移的な tauri-plugin-fs は 2.7.1。
- npm: api / cli 2.12.4、plugin は dialog 2.8.4・process 2.4.0・updater 2.14.1・window-state 2.5.0、**opener 2.7.2・store 2.5.0**。この 2 つはクレートより patch 1 つ遅い — オーナーのグローバル pnpm 設定 `minimumReleaseAge: 10080`（7 日）が 2026-11-10 公開の 2.7.3 / 2.5.1 を拒否したため。設定は迂回していない。CLI の照合は minor だけなので build は通る。
- Windows: webview2-com 0.38 → 0.39、windows-core 0.61 → 0.62（wry 0.57 / tao 0.37 と同じ）。**windows-sys は 0.61 のまま** — windows-sys の最新は 0.61.2 で、windows 0.62 系と版番号がずれている（muda 0.20 は `>=0.60, <=0.61` を要求）。タスク本文の「windows-sys を 0.62 系へ」はこの番号のずれによる誤記。lockfile に残る windows-core 0.61 は chrono 経由の iana-time-zone のもので tauri とは無関係。
- zip は 9.5.1 に解決（≥ 9.0.5）。`audit.toml` の zip 4 項目を削除し `ignore = []`。
- THIRD-PARTY-NOTICES.md を `pnpm notices` で再生成。

## 引用の再確認（AC#4）

旧版と新版のソースを両方 cargo registry から読み、引用行の内容で突き合わせた。AGENTS.md / AGENTS.ja.md に加え、同じ引用を持つコードコメント（src-tauri/src の handover / lib / menu / modifier / open_recent / print / recent / session / settings / window、src の useWindowEvent / close-window）も同じ基準で直した。

- **挙動が変わったのは muda 0.20 の GTK バックエンドだけ**: 未対応の predefined 種別を append 時に黙って飛ばすのではなく、無効化した項目として描く（`gtk/mod.rs:912-918`、対応判定は `:1180-1190`）。mallow の Linux 構成は Undo / Redo を `cfg` で外し Quit を普通の item にしているので動作は変わらない。「描かれない」「飛ばす」の記述を「選べない項目として描かれる」に改めた。2026-09-12 の Linux での確認は muda 0.19 時点のものと明記。
- 行番号だけ動いたもの: listener.rs の `match_any_or_filter`、app.rs の set_menu / menu event の post と配送 / plugin 初期化と setup / `create` フィルタ、lib.rs の unstable な get_focused_window、menu/mod.rs の main thread marshal、manager/window.rs の window-ready、runtime-wry の Destroyed → ExitRequested / per-window listener / LoopDestroyed / send_user_message、muda の MenuEvent（`menu_event.rs` へ移動）と handler の OnceCell / macOS の windows menu 解決 / predefined の accelerator と "&Exit"、tao の `is_focused`、window-state の private 型・既定 state 挿入・Exit 時保存・map_label、store の build_inner。webview_window.rs:114-116、window/mod.rs:394-398・408-419、manager/window.rs:70-72、app.rs:257-266 は行番号も同じ。
- 中身は同じだが記述を足したもの: store 2.5.1 の `build_inner` は既存 store の返却を 2 度確かめる（ロック外の先読みと write lock 下）— 同一インスタンスを返す結論は不変。wry の印刷 3 経路は 0.55.1 と同一（macOS は `print_with_options` を diff して一致、Windows は `window.print()` の eval、Linux は `run_dialog(None)`）。tauri 2.12.5 の print の doc コメントは今も macOS のみと書く。asset スコープの `require_literal_leading_dot` 既定値と `is_allowed` の canonicalize も同一で、`commands.rs` のテストは固定中の tauri の `Scope` を動かすので 2.12.5 で通ったこと自体が再確認になる。
- 引用は無いが確かめた点: single-instance 2.5.5 も二重起動側は setup 内で `process::exit`（Linux / Windows は `cleanup_before_exit` の後）で、経路は同じ。2.5.5 はロックを resource table に置き `cleanup_before_exit` で解放するようになった（updater の relaunch に効く可能性がある）。runtime-wry の RequestExit は終了コードを渡すようになったが mallow の記述には触れない。
- decision-16 の固定の段落と帰結の項目を「tauri のマイナーと一緒に動き、単独では動かない」に書き換えた。
- 読み直していないもの: decision-16 §2 の関連付け登録（tauri-cli 2.11.4 の bundler を読んだ記述）は AC#4 の対象クレート外なので触れていない。Windows で `Ctrl+W` のアクセラレータが届かなかった実測（2026-09-12）は muda 0.19 時点のもので、0.20 でどうなるかは AC#7 の手動確認で見る。

## 検証

- `cargo fmt --check` / `cargo check` / `cargo test`（114 件）/ `MALLOW_UNATTENDED=1 cargo test`（120 件）が通過。
- `pnpm lint` / `pnpm build` / `pnpm test`（668 件）が通過。
- `MALLOW_UNATTENDED=1 pnpm tauri build --debug --no-bundle --no-sign` が macOS で成功（tauri-cli のバージョン照合も通過）。
- `pnpm audit --prod`: low 1 件（既存の許容済み katex）のみ。
- 未実施: Windows アームのローカル確認（`cargo check --target x86_64-pc-windows-msvc` は ring の C ビルドが Windows SDK のヘッダを要して止まる）→ paper ジョブで確認。cargo-audit はローカルに無いので Audit ワークフローで確認。AC#2 / #5 / #6 は CI の結果、AC#7 / #8 はオーナーの手動確認待ち。
<!-- SECTION:NOTES:END -->
