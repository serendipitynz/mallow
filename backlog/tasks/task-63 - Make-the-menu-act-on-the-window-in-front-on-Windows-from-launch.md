---
id: TASK-63
title: Make the menu act on the window in front on Windows from launch
status: In Review
assignee: []
created_date: '2026-11-16 21:31'
updated_date: '2026-11-17T00:54:00Z'
labels:
  - bug
dependencies: []
priority: high
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On Windows, the menu entries that act on one window do nothing from the moment mallow starts until the reader switches to another window and back. Measured by the owner on 2026-11-17: under `pnpm tauri dev`, in the NSIS 0.14.0 build, and in the TASK-58 MSIX alike.

- **Entries that failed**: Settings…, Open…, Print…, Export as PDF…, Toggle Explorer, Back / Forward, Find… and Close Window were all tried. Each choice printed `mallow: a menu event found no window to act on (menu:settings)` (`menu:open` for Open…), so `emit_focused` found no window reporting focus.
- **What does not help**: clicking inside the window, or opening another file in it.
- **What does help**: opening a second window (About counts) and switching between the windows.
- **The gates follow the same answer**: selecting a markdown file in the only window leaves Print… and Export as PDF… disabled, because `apply_focused_gates` reads the focused window too.

**Why the window reports no focus is not measured.** tao 0.37.2 answers `is_focused` on Windows from its own window state, `is_active && is_focused` (`src/platform_impl/windows/window_state.rs:188-190`). Only `WM_NCACTIVATE`, `WM_SETFOCUS` and `WM_KILLFOCUS` move that state (`src/platform_impl/windows/event_loop.rs:1729-1756`). Two readings fit what was seen; neither has been checked:
- The first activation reaches the window before tao tracks it, so the flag stays false until the next activation change. Switching windows supplies exactly that change.
- WebView2's child HWND takes the keyboard focus, so the top-level window sees `WM_KILLFOCUS`.

**This may be a regression.** TASK-49's AC #4 recorded every entry working from the menu on Windows on 2026-11-05, under tao 0.35.3. TASK-55 has since moved tauri to 2.12, which brought tao 0.37.2. Whether that upgrade is the cause is not measured.

**TASK-49's constraint stands.** On macOS and Windows a menu event must not act on a window the reader cannot see. Falling back to the most recently focused window, as Linux does, is therefore not the fix as it stands.

A candidate fix that keeps the constraint: on Windows, take the window whose HWND is `GetForegroundWindow()`. A menu bar on Windows belongs to its own window, so the window whose menu was chosen is the foreground one. This costs one windows-sys feature (`Win32_UI_WindowsAndMessaging`) and no crate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause is identified on Windows and recorded on this task, with what was measured
- [x] #2 On Windows, with one window open since launch, Settings…, Open…, Print…, Export as PDF…, Toggle Explorer, Back / Forward, Find… and Close Window act when chosen from the menu, and Print… and Export as PDF… enable on a markdown preview without switching windows
- [ ] #3 No menu event acts on a window the reader cannot see on macOS or Windows, and Linux keeps TASK-49's fallback
- [ ] #4 macOS and Linux keep working from the menu
- [ ] #5 cargo fmt --check, cargo check and cargo test pass inside src-tauri/, and pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 原因（2026-11-17、Windows 11、`pnpm tauri dev`、メッセージフックで実測）

メインスレッドに `WH_CALLWNDPROC` / `WH_CALLWNDPROCRET` のフックを入れ、起動直後から `WM_NCACTIVATE` / `WM_ACTIVATE` / `WM_SETFOCUS` / `WM_KILLFOCUS` の順序と入れ子を記録した。あわせて2秒ごとに、メインスレッドで `GetForegroundWindow` / `GetActiveWindow` / `GetFocus` と各ウィンドウの `is_focused()` を出した。

- トップレベル HWND の `WM_SHOWWINDOW`・`WM_NCACTIVATE(1)`・`WM_ACTIVATE(1)`・`WM_SETFOCUS` は、すべてそのウィンドウ自身の `WM_CREATE` の中で届いていた（tao 0.37.2 の `on_create` が `set_visible` を呼ぶため）。webview はまだ無い。
- その後 WebView2 の子 HWND が作られてフォーカスを取り、親には `WM_KILLFOCUS`（wParam = 子 HWND）だけが届く。親への `WM_SETFOCUS` はこの後に来ない。
- 結果として、ウィンドウは前面かつアクティブ（`GetForegroundWindow` = `GetActiveWindow` = 親 HWND、`GetFocus` はその子孫）なのに、`is_focused()` は30秒間ずっと false だった。tao は `is_active && is_focused` で答えており、`is_focused` 側が `WM_KILLFOCUS` で落ちたまま戻らない。タスク記述の2つの説のうち2つ目（WebView2 の子 HWND がフォーカスを取る）に当たる。
- ウィンドウを切り替えると直る理由はソースから読んだもので、計測はしていない。再アクティブ化で親に `WM_SETFOCUS` が届くと、wry の親 subclass（wry-0.57.2 `src/webview2/mod.rs:1362-1365`）が先に `MoveFocus` してフォーカスを子へ移し（このとき親に入れ子の `WM_KILLFOCUS` が届く）、その後 `DefSubclassProc` 経由で tao が同じ `WM_SETFOCUS` を処理する。だから最後に true が残る。
- `WindowEvent::Focused(true)` は起動時にも届いていた。tauri-runtime-wry は単一 webview のウィンドウでは tao の Focused を捨て、WebView2 の `GotFocus` から合成している。そのため `note_window_focused` によるセッションのフォーカス順は、起動時から更新されている。ただし同じ時点の `apply_focused_gates` は `is_focused` が false なので、何もゲートを開けていなかった。
- 回帰かどうか（tao 0.35.3 / tauri-runtime-wry 2.11 では起動時に true になっていたか）は計測していない。読んだ範囲では、wry 0.55.1 / 0.57.2 の親 subclass と tao 0.35.3 / 0.37.2 のフォーカス処理は同じだった。tauri-runtime-wry 2.12 で入った `FocusState` は複数 webview のウィンドウにしか効かない。

## 修正

Windows の `menu::focused_window` を、`GetForegroundWindow()` の HWND と一致する webview ウィンドウを返すように変えた。windows-sys の feature `Win32_UI_WindowsAndMessaging` を1つ足しただけで、crate は増えていない。macOS / Linux の本体は `#[cfg(not(target_os = "windows"))]` に分けただけで、中身は変えていない。

- `menu_window` だけでなく `focused_window` 自体を変えたので、`handover.rs` の2か所（`report` と `relaunched`）にも効く。どちらも `most_recent_window` へのフォールバックを持っている。起動時の Windows では今まで常にフォールバックに落ちていたが、これからは mallow が前面のときだけ前面のウィンドウを選ぶ。Explorer や端末から渡されたときは前面が別アプリなので、今までどおりフォールバックになる。
- TASK-49 の制約（見えないウィンドウを操作しない）は構造的に守られる。Windows のメニューバーはそのウィンドウのものなので、メニューを選んだウィンドウは前面にある。すべて最小化されているときや別アプリの背面にあるときは、前面ウィンドウは mallow のものではない。

## 検証

- AC #2: 修正版を `pnpm tauri dev` で起動し、ウィンドウ1つのまま切り替えずに Settings… / Open… / Toggle Explorer / Back / Forward / Find… / Close Window をメニューから選んで動くこと、Markdown プレビューで Print… / Export as PDF… が有効になることを、オーナーが確認した（2026-11-17）。dev ログに `a menu event found no window to act on` は出なかった。NSIS / MSIX ビルドでは試していない。
- AC #5: `cargo fmt --check`・`cargo check`・`pnpm lint`・`pnpm build`・`pnpm test`（Vitest 706件）は通った。`cargo test` はこの PC ではテスト実行ファイルが `0xc0000139`（STATUS_ENTRYPOINT_NOT_FOUND）で起動できない。変更を退避した HEAD でも同じだったので、今回の変更とは関係ない。CI（ubuntu）の結果を見てからチェックする。

## 未計測のまま残したもの

- AC #3: Windows で mallow が別アプリの背面にあるときや最小化されているときに、メニューイベントが何もしないことは手で確かめていない（前面ウィンドウの定義から言えることだけ）。Linux のフォールバックと単体テストは変えていない。
- AC #4: macOS と Linux の実機確認はしていない。コードは cfg で分けただけで変わっていない。
<!-- SECTION:NOTES:END -->
