---
id: TASK-32
title: Tell a first-time builder what the build needs before pnpm tauri build
status: In Review
assignee: []
created_date: '2026-09-09 17:46'
updated_date: '2026-09-09 05:55'
labels:
  - documentation
dependencies: []
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-09-09 (macOS, clean clone, `pnpm install` completed): with `cargo`, `rustc` and `rustup` all absent from `PATH`, `pnpm tauri build` stops with `failed to run 'cargo metadata' command to get workspace directory: … No such file or directory (os error 2)`. Nothing in either README says a Rust toolchain is needed at all - the Development section is a command list, and `pnpm install` above it installs only the JS side, so the reader's evidence points at the command rather than at their machine.

**What is missing is the prerequisites, not this one error line.** The same requirement stands behind `pnpm tauri dev`, `cargo check` and `cargo test`, which the Development section also lists, so a note attached to the build command alone would leave the other three unexplained.

**Do not write that Xcode Command Line Tools were the missing piece.** On the machine this was measured on `xcode-select -p` answered `/Applications/Xcode.app/Contents/Developer`, so the toolchain was the only absent requirement and the CLT's necessity was never exercised here. It belongs in the text as an upstream prerequisite with Tauri's own page as the source, not as something this event established. The same applies to every Windows and Linux system dependency: this project ships bundles for all three, and none of their prerequisites were touched by this measurement.

**No Rust version floor is pinned by this repository.** `src-tauri/Cargo.toml` declares `edition = "2021"` and `tauri = "2"`, and there is no `rust-toolchain.toml`, so the README has nothing of its own to state - a number written here would come from Tauri's requirements, which is where the reader should be sent instead.

**The second stop a first-time builder hits is already recorded and must be reachable from the same place.** `tauri.conf.json` carries `createUpdaterArtifacts: true` and the committed updater public key, so a build with no `TAURI_SIGNING_PRIVATE_KEY` in the environment stops (AGENTS.md, "Signed self-update"), and `pnpm tauri build --no-sign` is the contributor path - it skips code signing at the same time, so it is not a release path. That runbook stays in AGENTS.md; what README owes is the sentence that keeps the reader from reading it as a broken build, plus the pointer.

Scope: the Development section of README.md and README.ja.md. No code, no CI, and no new copy of the signing runbook.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and README.ja.md each carry a prerequisites list ahead of the Development commands, naming a stable Rust toolchain installed via rustup (with `cargo` on `PATH`), Node + pnpm, and each platform's system dependencies by reference to Tauri v2's own prerequisites page rather than by restating it
- [x] #2 The text states that `pnpm install` covers only the frontend, and that the Rust toolchain is what `pnpm tauri dev`, `pnpm tauri build`, `cargo check` and `cargo test` all rest on - not the build command alone
- [x] #3 The `cargo metadata … No such file or directory (os error 2)` line appears verbatim enough to be searchable, attributed to a missing toolchain, so a reader who already hit it identifies their own cause without reading further
- [x] #4 The section says a local `pnpm tauri build` stops when `TAURI_SIGNING_PRIVATE_KEY` is unset, names `pnpm tauri build --no-sign` as the contributor path and `pnpm tauri dev` as the option needing no signing at all, and links AGENTS.md's signing runbook instead of duplicating it
- [x] #5 Nothing unmeasured is claimed: no minimum Rust version, no assertion that Xcode Command Line Tools were absent in the measured event, and no claim about which Windows or Linux packages were verified
- [x] #6 The English and Japanese sections carry the same content at the length the rest of the README is written at - a short list plus one or two sentences, with no reasoning about why the updater key is committed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. README.md の ## Development 見出し直後、コマンドブロックの前に前提条件を挿入する: pnpm install がフロントのみである一文 + 3 項目のリスト（rustup 経由の stable Rust と PATH 上の cargo・独自のバージョン指定なし / Node.js と pnpm / 各 OS のシステム依存は Tauri v2 の prerequisites ページを出典に、macOS は Xcode CLT、Windows と Linux はそのページの挙げるパッケージ）。
2. 続けて cargo metadata … (os error 2) の行を検索可能な形で載せ、原因はツールチェイン不在であってコマンド側ではないと書く。
3. 続けて TAURI_SIGNING_PRIVATE_KEY 未設定で止まること、--no-sign が contributor 経路（コード署名も同時にスキップするのでリリース経路ではない）、pnpm tauri dev は署名不要、runbook は AGENTS.md#signed-self-update-the-update-channel へのリンクで済ませる（複製しない）。
4. README.ja.md の ## 開発 に同内容を日本語で入れ、リンク先は AGENTS.ja.md の対応見出しにする。
5. 未計測の主張を入れない: Rust の最小バージョン、CLT が当該計測で欠けていたという記述、Windows/Linux パッケージの検証済み主張。
6. 検証: リンク先 URL の到達性（済: 200）、pnpm lint / pnpm build / pnpm test（Markdown は Biome 対象外なので影響がないことの確認）。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
README.md の `## Development` と README.ja.md の `## 開発` に、コマンドブロックの手前へ前提条件を挿入した。コードも CI も触っていない。

**前提条件の置き方** — 「`pnpm install` はフロントエンドだけを対象とし、`pnpm tauri dev` / `pnpm tauri build` / `cargo check` / `cargo test` はいずれも Rust ツールチェインを土台にしている」の 1 文を先に置き、3 項目のリスト（rustup 経由の stable + `cargo` on `PATH`、Node.js と pnpm、各 OS のシステム依存）を続けた。build コマンド 1 つに注記を付ける形を採らなかったのは、同じ要件が残り 3 コマンドの背後にも立っているためで、タスクの Description がその理由を指定している (AC #1, #2)。

**Rust のバージョンは書いていない** — `rust-toolchain.toml` はリポジトリ直下・`src-tauri/` のどちらにも存在せず、`src-tauri/Cargo.toml` は `edition = "2021"` と `tauri = "2"` のみで `rust-version` を持たない (確認済み)。よって README が自前で述べられる下限はなく、「このリポジトリ独自のバージョン指定はありません」と書いて Tauri のページへ送っている (AC #5)。

**Xcode Command Line Tools は上流の前提条件として置き、当該計測で欠けていたとは書いていない** — 出典は Tauri v2 の prerequisites ページであり、Windows と Linux については「そのページが挙げるパッケージ」と参照するだけで、どのパッケージを検証したかの主張はしていない (AC #1, #5)。

**署名の runbook は複製せずリンクにした** — `TAURI_SIGNING_PRIVATE_KEY` 未設定でローカルの `pnpm tauri build` が停止すること、`pnpm tauri build --no-sign` が contributor 向けの経路であり（コード署名も同時にスキップするのでリリース経路ではない）、`pnpm tauri dev` は署名を一切必要としないことの 3 点だけを書き、手順は AGENTS.md / AGENTS.ja.md の当該節へのリンクで済ませた。更新鍵が commit されている理由には触れていない (AC #4, #6)。前提の確認として `tauri.conf.json` に `createUpdaterArtifacts: true` と `pubkey` があることを見ている。

**リンクは推測ではなく検証した** — `https://v2.tauri.app/start/prerequisites/` は 200。アンカーはリポジトリに前例がなかったため、node_modules に推移的に入っていた `github-slugger` 2.0.0 で両ファイルの全見出しを順に slug 化し、`signed-self-update-the-update-channel` と `署名付きの自己更新更新チャネル` がそれぞれ目的の見出しに一意に対応することを確認した（先行見出しによる重複採番がないことも同時に確認）。

**検証** — `pnpm lint` (biome check: 108 files, no fixes)、`pnpm test` (25 files / 346 tests passed)、`pnpm build` (成功。500 kB のチャンク警告は既存) がいずれも通る。Markdown は Biome の対象外なので README 自体を機械的に検査するものはなく、AC を満たしているかは本文を読んで判断している。日本語版が英語版と同じ内容・同じ長さであることも同様に目視。

**未計測のまま残したもの** — 前提条件を満たさない状態から実際にビルドを通し直す再現は macOS のこの 1 台でしか行われておらず (Description の 2026-09-09 の計測)、Windows・Linux で `pnpm tauri build` が同じ文言で止まるかは確認していない。エラー行の引用はその計測に基づく。
<!-- SECTION:NOTES:END -->
