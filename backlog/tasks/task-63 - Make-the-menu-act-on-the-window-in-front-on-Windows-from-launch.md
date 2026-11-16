---
id: TASK-63
title: Make the menu act on the window in front on Windows from launch
status: To Do
assignee: []
created_date: '2026-11-16 21:31'
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
- [ ] #1 The cause is identified on Windows and recorded on this task, with what was measured
- [ ] #2 On Windows, with one window open since launch, Settings…, Open…, Print…, Export as PDF…, Toggle Explorer, Back / Forward, Find… and Close Window act when chosen from the menu, and Print… and Export as PDF… enable on a markdown preview without switching windows
- [ ] #3 No menu event acts on a window the reader cannot see on macOS or Windows, and Linux keeps TASK-49's fallback
- [ ] #4 macOS and Linux keep working from the menu
- [ ] #5 cargo fmt --check, cargo check and cargo test pass inside src-tauri/, and pnpm lint, pnpm build and pnpm test pass
<!-- AC:END -->
