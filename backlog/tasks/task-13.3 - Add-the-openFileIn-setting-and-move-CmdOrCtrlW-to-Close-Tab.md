---
id: TASK-13.3
title: Add the openFileIn setting and move CmdOrCtrl+W to Close Tab
status: To Do
assignee: []
created_date: '2026-08-05 21:47'
labels:
  - feature
dependencies:
  - TASK-13.1
parent_task_id: TASK-13
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The one setting this feature adds, and the keyboard reassignment tabs force on the File menu.

## openFileIn

A `'reuseTab' | 'newTab'` key in settings.json, joining `explorerWidth`, `explorerSide` and `customEmojiDir` in the `Settings` interface at `src/lib/settings.ts:5-12`. **`'reuseTab'` is the default**, so an install that upgrades into this feature behaves as close to before as tabs allow until the user asks otherwise.

The value is named after what it does to the *provisional tab*, not after "the current tab": when the active tab is a committed one, `'reuseTab'` does not replace it - it creates the provisional tab and reuses that from then on. An earlier draft called this value `'currentTab'`, which named a third thing that is neither the active tab nor the provisional one.

Per decision-4 it selects a default destination, not a mode. Nothing about the tab strip's existence is conditional on it, and the explicit gesture TASK-13.1 defines reaches the same end state at both values (rule 3a there: the file's tab ends up committed, and there is no gesture for making a tab provisional under `'newTab'`).

**Switching to `'newTab'` promotes whatever provisional tab exists.** The vocabulary says a provisional tab can exist only under `'reuseTab'`, and that has to be true at runtime, not just at the moment a file is opened: leave it alone and the tab sits there in italics, replaceable by a rule that no longer runs, until the user closes it. Promotion is the fix that needs no new operation (rule 3a refuses a demote, and this is its mirror image). The other direction needs nothing - rule 2 creates the provisional tab when there is none. Note that TASK-12.8 makes this arrive from a window the user is not looking at, so it cannot be handled as part of the click that changed the setting.

The control goes in `SettingsModal` next to the explorer-side control, which is the same shape of choice, and its label plus both option labels need keys in **both** the `ja` and `en` dictionaries in `src/lib/i18n.tsx`.

**It must not be read once at mount.** `src/App.tsx:109-136` reads the store once on launch, which is fine for a value only that window ever changes - and wrong for this one, because TASK-12.8 lets a setting be changed from any window and the Settings modal opens in all of them. Three cases, and the third is the one that gets missed:

- TASK-12.8 has landed and propagates store-backed settings - route this key through that channel.
- TASK-12.8 has not landed - keep the read behind a single accessor so it can be picked up without hunting call sites, and add this key to that task's scope list.
- TASK-12.8 landed but took its own AC #3 option of listing store-backed settings as a known limitation instead of propagating them. Then there *is* no channel, and the accessor is the whole answer: match that decision and let TASK-12.6 list this key alongside the others. Do not build a propagation path for one setting that the app deliberately does not have for its siblings.

## CmdOrCtrl+W has to move, and the predefined menu item cannot follow it

With tabs, `CmdOrCtrl+W` closes the active tab. Closing a tab never closes the window (TASK-13.1), and with no tabs open the chord does nothing: **File > Close Tab is disabled in that state**, which is the ordinary menu convention and takes its accelerator with it. Close Window moves to `CmdOrCtrl+Shift+W`.

That disabled state is why decision-4 dropped the VS Code-style fall-through of closing the window on a second press. The two ways to keep it were both defective: leave the item enabled with no tabs, so a menu entry labelled Close Tab closes the window, or disable it correctly and lose the accelerator the fall-through needed. Closing a window stays on `CmdOrCtrl+Shift+W` and the titlebar control.

TASK-12.4 assigns `CmdOrCtrl+W` to Close Window, so whichever of the two tasks lands second reconciles this. Two facts from muda-0.19.3 constrain how:

- A `PredefinedMenuItem`'s accelerator is derived from its type - `CmdOrCtrl+W` on macOS, `Alt+F4` everywhere else (`src/items/predefined.rs:331-337`) - and the type exposes only `set_text`, no accelerator setter (`:186-201`). So Close Window on `CmdOrCtrl+Shift+W` is an ordinary `MenuItem` calling `window.close()` on all three platforms, not a re-labelled predefined one.
- `close_window` is documented as unsupported on Linux (`:136-138`), which the GTK predefined-kind rule in TASK-12.4 already covers.

Making Close Window an ordinary item has a consequence worth naming: on macOS the predefined item was handled by AppKit against whichever window was frontmost, and an ordinary item is not - it arrives as a menu event and has to resolve its target through the focused-window scan TASK-12.4 builds. Close Window joins Close Tab and Settings… as a consumer of that scan rather than being independent of it.

## One owner per chord

**The chord must be bound in exactly one place, and which side wins if it is bound twice has not been measured here.** The platform menu plausibly consumes an accelerator before the WebView sees it (AppKit resolves key equivalents ahead of the responder chain, Win32 has its accelerator table, GTK its accel group), in which case a duplicate `keydown` binding is dead rather than doubled. This repo already contains the experiment on one platform and it proves nothing even there: `CmdOrCtrl+,` is bound *both* as a menu item (`src-tauri/src/lib.rs:32-34`) and as a `keydown` handler (`src/App.tsx:185-194`), and because both merely open the settings modal the outcome is idempotent and invisible. On Windows and Linux the experiment does not exist at all - the menu is built inside `#[cfg(target_os = "macos")]` (`:27`), so only the `keydown` half is there today.

Closing a tab is not idempotent, so the risk runs in both directions - two tabs closed per press, or a binding that silently stops working the day the menu takes the chord. Bind it once. Do not assert which side would win without measuring it; that is the same standard TASK-13.2 applies to `scrollTop`.

- If TASK-12.4's native menu exists, the accelerator lives on the menu item and the handler emits to the focused window - the `menu:settings` pattern at `src-tauri/src/lib.rs:15-20`, with the per-window delivery pair TASK-12.1 establishes (Rust `emit_to`, frontend `getCurrentWebviewWindow().listen`).
- If this task lands first, the binding lives in the existing global handler at `src/App.tsx:185-194`, and TASK-12.4 removes it when it adds the menu item.

Say which situation the implementation is in; do not leave both.

Close Tab belongs in the File submenu next to Close Window once that menu exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 openFileIn is persisted in settings.json with 'reuseTab' as the default, so an upgrading install behaves as close to before as tabs allow
- [ ] #2 The Settings modal offers the choice beside the explorer-side control, with keys in both the ja and en dictionaries
- [ ] #3 The value is not read once at mount, and which of the three TASK-12.8 cases applies is stated - including the case where that task listed store-backed settings as a limitation, where the accessor is the whole answer
- [ ] #4 Switching openFileIn to 'newTab' promotes any existing provisional tab, including when the change arrives from another window, so no tab is left provisional under a value that cannot produce one
- [ ] #5 CmdOrCtrl+W closes the active tab; with no tabs open it does nothing and File > Close Tab is disabled, so no menu item labelled Close Tab ever closes a window
- [ ] #6 Close Window is on CmdOrCtrl+Shift+W as an ordinary MenuItem calling window.close() on all three platforms, since a PredefinedMenuItem's accelerator cannot be set
- [ ] #7 The chord has exactly one owner - the native menu item or the WebView keydown handler, never both - and which situation applies is stated
- [ ] #8 No claim is made about which side wins a duplicate binding without having measured it; the existing CmdOrCtrl+, double binding is noted as idempotent and therefore uninformative
- [ ] #9 Close Window's move to an ordinary item is recorded as making it a consumer of TASK-12.4's focused-window scan on macOS, where AppKit handled the predefined item
- [ ] #10 Close Tab appears in the File submenu when that menu exists, and menu delivery uses the emit_to plus getCurrentWebviewWindow().listen pair
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build and pnpm test pass; cargo check and cargo test pass if the menu half is in scope
- [ ] #2 Both setting values were exercised by hand, and CmdOrCtrl+W closes exactly one tab per press
<!-- DOD:END -->
