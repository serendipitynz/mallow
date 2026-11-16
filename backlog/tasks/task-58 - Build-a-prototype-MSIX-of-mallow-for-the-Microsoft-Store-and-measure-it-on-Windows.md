---
id: TASK-58
title: >-
  Build a prototype MSIX of mallow for the Microsoft Store and measure it on
  Windows
status: In Review
assignee: []
created_date: '2026-11-13 19:41'
updated_date: '2026-11-16 21:21'
labels:
  - feature
dependencies: []
references:
  - src-tauri/tauri.conf.json
  - src-tauri/src/lib.rs
  - src/hooks/useUpdater.ts
  - src/lib/build-flags.ts
  - >-
    backlog/decisions/decision-16 -
    Forward-a-second-launch-to-the-running-process-and-register-mallow-for-markdown-as-a-candidate-opener-never-as-the-default.md
  - 'https://v2.tauri.app/distribute/microsoft-store/'
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow reaches Windows only as the NSIS and MSI bundles on GitHub Releases, unsigned, so every reader meets SmartScreen's download-time warning (README names it). The Microsoft Store takes an MSIX package and signs it itself, which needs no code-signing certificate of mallow's own, and delivers updates through the Store. This task builds a prototype MSIX of mallow and measures it on Windows, so that whether to submit one can be decided on what a packaged mallow actually does rather than on what it should do.

**Tauri produces no MSIX.** The package is built from what `pnpm tauri build` already produces: the release `mallow.exe` and its resources laid out in a folder, an `AppxManifest.xml` written for mallow, and `makeappx pack` from the Windows SDK. The tile and store logos `pnpm tauri icon` generates (`Square44x44Logo.png`, `Square150x150Logo.png`, `StoreLogo.png` and the rest in `src-tauri/icons/`) are the assets the manifest names. The package declares `runFullTrust`, so mallow runs as an ordinary desktop app with no AppContainer around it: plain `std::fs`, the `notify` watcher and `editors.rs`'s processes are expected to work unchanged, which this task measures rather than assumes.

**A packaged mallow carries no updater.** The Store updates an MSIX itself, so a Store build must neither check GitHub nor install anything over itself. That makes this the first build variant mallow ships to readers: `tauri_plugin_updater` in `lib.rs`, the launch check in `App.tsx`, the `autoCheckUpdates` preference and its control in `SettingsModal`, and `UpdateDialog` all have to be absent from it, while the GitHub Releases build keeps every one. The unattended export is the precedent for the switch (`build.rs`'s `cfg(unattended)` and `lib/build-flags`' Vite substitution), not necessarily its shape.

**File associations come back on Windows.** decision-16 registers nothing on Windows because tauri's NSIS and MSI registrations take the extension's default. An MSIX `uap:FileTypeAssociation` adds mallow to "Open with" without taking the default, which is what decision-16 asks for on the other two platforms. Whether a file opened that way reaches `handover.rs` as an argument, and whether a second launch is still forwarded by single-instance inside a package, are measured.

Measured on a Windows machine, with the package installed locally (a self-signed certificate trusted on that machine, or `Add-AppxPackage -Register` under developer mode):
- **Where settings live.** An MSIX redirects writes under AppData to a per-package location, so `settings.json` (the restored session, recent folders, preferences), `.window-state.json` and the WebView2 user data may not be where the MSI build put them. Whether a reader moving from the MSI build keeps any of it is the question.
- **WebView2.** A package cannot run the WebView2 bootstrapper, so the runtime the OS carries is what mallow gets. Windows 11 always has one.
- What a reader does every day: opening a folder, the tree and the watch, the asset protocol's images and PDF, Open Recent, Open With and Reveal, Print and PDF export, a new window, quit and restore.

Out of scope: submitting to the Store (reserving the name in Partner Center and the identity it gives the manifest are the owner's, and the prototype may carry a placeholder identity), code signing of the NSIS / MSI bundles (Azure Artifact Signing is a separate task), building the package in CI, and ARM64 Windows, which mallow does not build.

To settle at the start:
- How the Store variant is switched: a cargo feature, a `cfg` set from `build.rs` the way `unattended` is, or both, and how the frontend half reads it.
- How the package is assembled: a script under `scripts/` that runs on a Windows machine, or steps written in the task alone until submission is decided.
- The version mapping: the Store wants four parts with the last one 0, so `0.14.0` becomes `0.14.0.0`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 How the Store variant is switched and how the package is assembled are settled and written in the task
- [x] #2 A Store build carries no updater: tauri_plugin_updater is not registered, and neither the launch check, the autoCheckUpdates control nor UpdateDialog is reachable, while the GitHub Releases build keeps all of them
- [x] #3 An MSIX built from pnpm tauri build's output installs and launches on a Windows machine, and the steps that built it are recorded
- [x] #4 The manifest declares the markdown and mermaid extensions as file type associations; whether mallow appears under Open with without becoming the default, and whether a file opened that way reaches handover.rs, are measured and recorded
- [x] #5 Where settings.json, .window-state.json and the WebView2 user data land inside the package, and whether an MSI install's settings carry over, are measured and recorded
- [x] #6 The everyday paths (folder open and watch, media via the asset protocol, Open Recent, Open With and Reveal, Print and PDF export, a second window, a second launch forwarded, quit and restore) are measured inside the package and the result recorded
- [x] #7 No production dependency is added, and pnpm lint, pnpm build, pnpm test, cargo check and cargo test pass for both variants
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 切り替え: MALLOW_STORE=1 を build.rs (cfg(store)) と vite.config.ts (__MALLOW_STORE__ → lib/build-flags の STORE) の両方が読む。unattended と同じ形で、一つの変数を両側が読むので片側だけ有効にはならない。cargo feature にしない理由: フロント側に別の変数が要り二つの切り替えが食い違いうる上、updater:default の capability を Store 版だけ外す仕組みが別途要る。
2. Rust: lib.rs で tauri_plugin_updater の登録を cfg(not(store)) にする。crate は依存に残る (登録されないので IPC は届かない)。process プラグインは updater ではないので残す。
3. フロント: useUpdater を STORE で GitHub 版と Store 版 (版数だけ読む) に分け、定数畳み込みで plugin-updater の check / relaunch を Store 版のバンドルから落とす。App の起動時チェックは STORE で止め、UpdateDialog は描画しない。SettingsModal は Store 版で自動確認の切り替えと「今すぐ確認」を出さず、版数と「更新は Microsoft Store から届く」旨だけを出す。
4. 組み立て: scripts/msix/build-msix.ps1 (Windows で実行) と src-tauri/windows/msix/AppxManifest.xml (テンプレート)。MALLOW_STORE=1 pnpm tauri build --no-bundle → レイアウト (mallow.exe, THIRD-PARTY-NOTICES.md, Assets/) → 版数 X.Y.Z.0 と仮の identity を埋めたマニフェスト → makeappx pack → signtool (証明書の拇印を渡したとき)。runFullTrust、md/markdown と mmd/mermaid の uap:FileTypeAssociation。
5. 両方の変種で pnpm lint / build / test、cargo fmt --check / check / test を通し、Store 版の dist に plugin:updater が残らないことを確かめる。
6. AC #3〜#6 の Windows 実機計測はオーナーの計測ラウンド。手順と計測項目をノートに書いて渡す。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手時に決めたこと (AC #1)

- **切り替え**: `MALLOW_STORE=1` を `build.rs` (`cfg(store)`) と `vite.config.ts` (`__MALLOW_STORE__` → `lib/build-flags` の `STORE`) の両方が読む。unattended と同じ形で、一つの変数を両側が読むので片側だけ有効にはならない (オーナー確認済み、2026-11-17)。cargo feature にしなかった理由: フロント側に別の変数が要って二つの切り替えが食い違いうるうえ、`updater:default` の capability は crate が依存にある間しか解決しないので、crate を optional にすると Store 版だけ capability を外す仕組みが別途要る。crate は依存に残し、登録だけしない。
- **組み立て**: `scripts/msix-build.ps1` (Windows で実行) とテンプレート `src-tauri/windows/msix/AppxManifest.xml` (オーナー確認済み)。スクリプトは毎回 `MALLOW_STORE=1 pnpm tauri build --no-bundle --no-sign` からやり直す。ビルドを省く選択肢を置かないのは、通常ビルドが `target\release` に残した mallow.exe は updater を持っていて、バイナリからは二つを見分けられないため。
- **版数**: `tauri.conf.json` の `X.Y.Z` に `.0` を足す。プレリリース接尾辞は MSIX の版数に入らないので、落とさずに止める。

## Store 版から外したもの (AC #2)

- Rust: `tauri_plugin_updater` の登録を `cfg(not(store))` にした。process プラグインは updater ではないので残す。
- フロント: `useUpdater` をモジュールの読み込み時に `STORE ? useStoreUpdater : useReleaseUpdater` で選ぶ。定数畳み込みで使わない側が落ち、`check` / `relaunch` もバンドルから消える。起動時チェックの effect は `STORE` で止め、`UpdateDialog` は描画しない。設定画面では自動確認の切り替えと「今すぐ確認」を出さず、版数と「更新は Microsoft Store から届きます。」だけを出す。
- 計測: 通常ビルドの dist には `plugin:updater|check` / `download` / `download_and_install` / `install` と `plugin:process|restart` が入っていて、`MALLOW_STORE=1` の dist にはどれも入っていない。

## 検証 (AC #7)

- 本番依存の追加なし (package.json / Cargo.toml は無変更)。
- 両方の変種で: biome ci 通過 (info 1 件は main にもともとある)、tsc + vite build 通過、Vitest 56 ファイル 706 件通過、cargo fmt --check / cargo check 通過 (警告なし)、cargo test 128 件通過。
- `pnpm <script>` は実行前の依存チェックで止まる (lockfile の `@tauri-apps/plugin-opener@2.7.3`、`@tauri-apps/plugin-store@2.5.1`、`electron-to-chromium@1.5.479` が `minimumReleaseAge` の期限内)。このため、同じコマンドを `node_modules/.bin` から直接実行した。この作業とは関係ない。

## Windows での計測 (AC #3〜#6、2026-11-17、オーナーの計測ラウンド)

- **組み立てとインストール (#3)**: スクリプト冒頭のヘルプどおりに自己署名証明書 `CN=mallow-prototype` を作り、管理者のシェルで `Cert:\LocalMachine\TrustedPeople` に取り込んだ。リポジトリのルートで `.\scripts\msix-build.ps1 -Thumbprint <拇印>` を実行し (Windows PowerShell 5.1 では先に `Set-ExecutionPolicy -Scope Process Bypass` が要る)、`MALLOW_STORE=1` のビルド、makeappx 10.0.26100.9457 によるパック (6 ファイル)、signtool の署名がどれも通った。`Add-AppxPackage src-tauri\target\msix\mallow_0.14.0.0_x64.msix` でインストールでき、PackageFamilyName は `mallow.prototype_8hzcgmcm5em22`、インストール先は `C:\Program Files\WindowsApps\mallow.prototype_0.14.0.0_x64__8hzcgmcm5em22`。`explorer.exe "shell:AppsFolder\<PFN>!mallow"` で起動し、WebView2 は OS のランタイムで動いた。設定画面の更新欄は版数と「Updates arrive through the Microsoft Store.」だけで、自動確認の切り替えと「今すぐ確認」は出なかった (#2 の実機確認。動いているのが Store 版のバイナリであることもこれで分かる)。
- **ファイルの関連付け (#4)**: `.md` と `.mmd` の「プログラムから開く」に mallow が出て、既定のアプリは変わらなかった。そこから開いたファイルが表示された (パスが引数として handover.rs に届く)。起動中にもう一度開くと、新しいプロセスは立ち上がらず既存のプロセスへ転送された。
- **設定の置き場所 (#5)**:
  - 既存の設定がない場合 (通常版の `%APPDATA%\net.serenebach.mallow` と `%LOCALAPPDATA%\net.serenebach.mallow` を退避して計測): `settings.json` と `.window-state.json` は `%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming\net.serenebach.mallow\`、WebView2 のデータは `…\LocalCache\Local\net.serenebach.mallow\EBWebView\` に作られ、元の二か所には何も作られなかった。
  - 通常版の設定がある場合 (GitHub の NSIS 版で計測。MSI 版は計測していないが置き場所は同じ): パッケージ版の初回起動で、セッション (開いていたフォルダとファイル)、ウィンドウの大きさと位置、言語とカラー (WebView2 の localStorage) がすべて引き継がれた。書き込みも元のファイルに行き (`%APPDATA%\net.serenebach.mallow` の 2 ファイルと `EBWebView` の更新時刻が進み、`LocalCache` には何も作られなかった)、二つの版が同じ設定を共有する。
  - 帰結: Store から初めて入れた人の設定はパッケージ専用の場所に入り、後から通常版を入れてもそれは見えない。通常版から移った人は設定を引き継ぎ、両方を残せば共有し続ける。
- **ふだんの操作 (#6)**: フォルダを開くことと監視、asset protocol の画像と PDF、Open Recent (メニューと空のウィンドウの一覧)、Open With と Reveal、Print と PDF 書き出し、`Ctrl+N` の二つ目のウィンドウ、二度目の起動の転送、二つのウィンドウでの終了と復元が、どれも通常版と同じに動いた。
- **計測の前提**: 通常版とパッケージ版は識別子 `net.serenebach.mallow` を共有するので、二重起動の判定も共有している可能性がある (未計測)。計測は通常版を終了してから行った。
- **計測していないもの**: パッケージのアンインストールで `LocalCache` のデータが消えるか、MSI 版からの移行、スタートメニューのパッケージ版のエントリからの起動。
- 意図して外したもの: `mallow` コマンド。NSIS / MSI の PATH 登録は MSIX には入らない。パッケージで同じことをするなら `uap5:AppExecutionAlias` になるが、このタスクの範囲外なので未宣言。
<!-- SECTION:NOTES:END -->
