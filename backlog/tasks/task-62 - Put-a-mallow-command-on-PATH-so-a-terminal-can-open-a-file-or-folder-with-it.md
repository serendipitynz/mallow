---
id: TASK-62
title: Put a mallow command on PATH so a terminal can open a file or folder with it
status: In Review
assignee: []
created_date: '2026-11-14 00:42'
updated_date: '2026-11-14 10:12'
labels:
  - feature
dependencies: []
references:
  - src-tauri/src/handover.rs
  - README.md
  - backlog/tasks/task-38 - Open-a-file-or-folder-the-OS-hands-to-mallow.md
priority: low
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
mallow already takes a path as an argument (TASK-38, decision-16): `handover.rs` resolves argv in the first process, and a second launch forwards its argv to the running one through tauri-plugin-single-instance and exits. What is missing is **a `mallow` command a terminal can find**. README's "Command line: `mallow path/to/file.md`" holds only where the binary is on `PATH`:
- **macOS**: the binary sits inside the bundle (`/Applications/mallow.app/Contents/MacOS/mallow`), which is not on `PATH`; today a reader types that path in full or uses `open -a mallow file.md`, which goes through `RunEvent::Opened` rather than argv.
- **Windows**: neither the NSIS nor the MSI installer adds the install directory to `PATH`.
- **Linux**: the deb and rpm are expected to install `/usr/bin/mallow`, which would already work; an AppImage is not on `PATH`. Unverified — the first thing to check.

To settle at the start:
- **How the command is installed per platform.** macOS: a menu entry that links a shim into `/usr/local/bin` (VS Code's "Install 'code' command in PATH"; needs elevation where that directory is root-owned, and `/opt/homebrew/bin` is the Apple silicon alternative), or a documented `ln -s` only. Windows: the installer adding a directory to the user `PATH`, or a documented step. Whether a shim is a script or a link matters on macOS: launching the inner binary directly by a symlink and launching the bundle are not the same process from LaunchServices' side, so what the shim runs is part of the decision.
- **What the command does beyond opening a path**: `--help` / `--version` printed to the terminal and returning, rather than starting the GUI; whether a launch from a terminal returns at once (as the forwarded second launch already does) or stays attached. On Windows a GUI-subsystem binary has no console to print to, so `--help` output needs an answer there.
- **`mallow .` opens the current directory, and that is a requirement on the shim rather than new resolution.** `resolve` already folds `.` into the working directory it is given — the process's own on a first launch, the caller's as forwarded by tauri-plugin-single-instance on a second — so `.` works exactly as far as the shim keeps the terminal's working directory. A macOS shim that runs `open -a mallow --args .` does not: the app LaunchServices starts has `/` as its working directory, so `.` would open the root. Running the inner binary directly keeps it.
- **Relative paths and the working directory**: the forwarded argv arrives in the running process, whose working directory is not the terminal's. TASK-38 measured the macOS forward; whether every platform resolves a relative argument against the caller's directory is checked rather than assumed.
- Whether README's Command line line is corrected now to say what works today on each platform, independently of the rest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 How the command is installed on each platform, and what it runs, are settled and written in the task
- [x] #2 From a fresh terminal on macOS, Windows and Linux, 'mallow <file>' and 'mallow <folder>' open in mallow, whether or not it is running
- [x] #3 A relative path is resolved against the terminal's working directory on all three platforms, including when it is forwarded to a running mallow
- [x] #4 --help and --version behave as settled, and README's Command line section says what works on each platform
- [x] #5 'mallow .' opens the terminal's current directory as a folder on all three platforms, both when mallow is not running and when it is
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
着手時の判定 (2026-11-14, ユーザー確認済み):
- macOS: mallow メニューに「Install 'mallow' Command…」「Uninstall 'mallow' Command…」を置き、/usr/local/bin/mallow に sh スクリプトを書く (書けなければ osascript の管理者認証)。スクリプトはバンドル内の実体 binary を絶対パスで exec する。symlink にしないのは、tauri-utils 2.10 の StartingBinary が macOS で実行パスに symlink を含むと current_exe() をエラーにし、resource_dir と updater がそれに依存するため。exec なので端末の cwd が保たれ、`mallow .` が成り立つ (open -a は cwd が / になる)。
- Windows: VS Code 方式。bin\mallow.cmd だけを置いたディレクトリを PATH に足す (インストール先そのものを足すと uninstall.exe も PATH に乗る)。NSIS (currentUser) は installerHooks で user PATH に、MSI (perMachine) は WiX fragment の Environment で system PATH に。NSIS 側の PATH 編集は PowerShell スクリプトで行う (NSIS の文字列長上限で長い PATH を切り詰めないため)。更新時 (/UPDATE) は外さず、追加は冪等。
- Linux: deb / rpm は tauri-bundler が /usr/bin/mallow に置くので追加作業なし。AppImage は README の手順 (~/.local/bin へのリンク)。
- 端末から起動したら即座にプロンプトへ戻す: release ビルドで stdout が tty のとき、binary が自分を新しいプロセスグループで再起動して exit する (macOS / Linux)。AppImage では $APPIMAGE を再起動する (中の binary はランタイムが親の終了でアンマウントするため)。Windows は GUI subsystem なので元から戻り、mallow.cmd は start で起動する。
- --help / --version: single-instance より前に処理して印字・終了。Windows release は AttachConsole(ATTACH_PARENT_PROCESS) で親コンソールに書く。mallow.cmd はこの 2 つのときだけ直接実行してバッチに終了を待たせ、出力をプロンプトより前に出す。

手順:
1. src-tauri/src/cli.rs: 引数の判定 (help / version / open)、usage 文字列、detach の判定と再起動、Windows のコンソール接続、macOS の shim 文面と install / uninstall コマンド。pure な部分に unit test。
2. lib.rs の run() 冒頭で cli を呼ぶ (unattended では呼ばない)。invoke_handler に install / uninstall を登録。
3. menu.rs: macOS の app submenu に 2 項目、menu_action に 2 つ、focused window へ emit。
4. フロントエンド: App.tsx で menu イベントを受けてコマンドを呼び、plugin-dialog の ask / message で結果を表示 (i18n ja / en)。
5. Windows: src-tauri/windows/{mallow.cmd, cli-path.ps1, hooks.nsh, cli-path.wxs} と tauri.windows.conf.json (resources, nsis.installerHooks, wix.fragmentPaths / componentRefs)。windows-sys に Win32_System_Console を追加。
6. README の Command line と AGENTS.md、THIRD-PARTY-NOTICES の要否確認。
7. lint / build / test / cargo fmt / check / test、可能なら x86_64-pc-windows-msvc で cargo check。macOS は実機で確認、Windows / Linux の実機確認はユーザーに依頼。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 決めたこと（AC #1）
- 導入方法と shim の形は Implementation Plan の「着手時の判定」に書いた（2026-11-14 ユーザー確認済み）。Windows は当初「README の手順のみ」を推したが、VS Code の形（bin\ に .cmd だけを置き、インストーラが PATH に足す）を説明したうえでユーザーがそちらを選んだ。
- MSI は tauri の WiX テンプレートが InstallScope="perMachine"（Program Files）なので、user PATH ではなく system PATH に足す。NSIS は currentUser なので user PATH。VS Code のユーザー用 / システム用インストーラと同じ分け方。
- macOS の shim を symlink にしない根拠: tauri-utils 2.10 `src/platform/starting_binary.rs` が、macOS で実行パスに symlink を含むと current_exe() をエラーにする。
- Linux の deb / rpm が /usr/bin/mallow に入ることは tauri-bundler 2.10.3 の `debian.rs:118` と `rpm.rs:143` で確認（ソースを読んだだけで、パッケージは入れていない）。
- 転送時の cwd: tauri-plugin-single-instance 2.5.5 は macos.rs:83 / windows.rs:122 / linux.rs:106 で呼び出し側の current_dir() を送っている。

## 実測（macOS 26 / Apple silicon、`tauri build --no-sign --bundles app` で作った release の .app。メニューが書くものと同じ内容の shim をスクラッチディレクトリの bin に置き、`script -q /dev/null` で疑似端末から実行）
- `mallow --version` → `mallow 0.14.0` を出して exit 0。`mallow -h` → usage を出して exit 0。どちらも GUI のプロセスは残らない。
- 起動していない状態で `cd docs && mallow .` → 0.29 秒で戻る。子プロセスは PPID 1・独立したプロセスグループ・tty なし・cwd=docs。restored session の空ウィンドウ（直前にフォーカスされた w1）が docs を開いた。
- 起動中に `cd clitest && mallow docs/sub/note.md` → 0.18 秒で戻り、プロセスは 1 つのまま。w2 が docs/sub を開き、note.md が選択された。`cd docs/sub && mallow ../..` → w3 が clitest を開いた。`cd clitest && mallow .` → 同じフォルダを表示している w3 が前面に出るだけで、ウィンドウは増えなかった。
- 確認のあいだ settings.json と .window-state.json を退避し、終了後に元へ戻した（cmp で一致）。

## 未実測（手作業での確認が要るもの）
- macOS の「Install / Uninstall 'mallow' Command…」メニュー自体。/usr/local/bin への直接書き込み、管理者認証、他人のファイルの置き換え確認、ダイアログの文言。
- Windows のすべて: NSIS / MSI での PATH 追加・削除、更新時に重複しないこと、mallow.cmd、AttachConsole による --help 出力。macOS からの cargo check --target x86_64-pc-windows-msvc は ring の C ビルドで止まるので、Windows 用のコンソール接続コードだけを windows-sys 0.61 の小さな crate に切り出して型チェックした。NSIS フックは手元の makensis 3 で、スタブのスクリプトに組み込んでコンパイルが通ることを確認した。WiX fragment は未検証。
- Linux のすべて: deb / rpm の /usr/bin/mallow、AppImage の起動し直し、DBus 経由で転送されたときの相対パス。

## そのほか
- 端末から起動したときの切り離し（起動し直し）は release ビルドだけで行う。debug では `pnpm tauri dev` が見張っているアプリを見失うため。
- このマシンでは pnpm 11 のスクリプト実行前の依存チェックが lockfile の minimumReleaseAge 違反（plugin-opener 2.7.3 など 4 件、今回の変更とは無関係）で止まるので、biome / tsc / vite / vitest は node_modules/.bin から直接実行した。結果: biome ci、tsc、vite build がエラーなし、vitest 686 件が通過、cargo fmt --check / check（debug・release・unattended）/ test 126 件が通過。

## 手作業での確認（2026-11-14、ユーザー実施）
- Windows（NSIS インストーラ、PowerShell 7.6）: `mallow --help` / `--version` は文字がプロンプトより前に出て終わった。`reg query HKCU\Environment /v Path` の末尾に `C:\Users\<user>\AppData\Local\mallow\bin` が加わり、型は REG_EXPAND_SZ のまま、`%USERPROFILE%\go\bin` も展開されずに残った。手順②〜④（起動していないとき・起動中の `mallow .`、相対パスのファイル、`../..`）は期待どおり。
- Linux（Ubuntu 24.04 の VM、deb）: `which mallow` → /usr/bin/mallow。`--help` / `--version` は期待どおり。②〜④も期待どおり。
- 以上と macOS の実測をもって AC #2〜#5 にチェックした。macOS はメニューが書くのと同じ内容のスクリプトでの確認。
- ユーザーの判断で、ここで確認を打ち切った。未実測のまま残るもの: macOS のメニュー項目そのもの（管理者認証・置き換えの確認・ダイアログ）、Windows の cmd.exe、MSI、同じ版の上書きインストールでの冪等性、Cancel したアンインストール（PR #124 のラウンド 1 の P2 で直した経路）と最後まで進めたアンインストール、AppImage の起動し直し、rpm。
<!-- SECTION:NOTES:END -->
