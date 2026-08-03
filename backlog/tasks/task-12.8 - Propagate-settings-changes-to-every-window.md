---
id: TASK-12.8
title: Propagate settings changes to every window
status: To Do
assignee: []
created_date: '2026-08-02 22:06'
updated_date: '2026-08-02 22:39'
labels:
  - feature
dependencies:
  - TASK-12.2
parent_task_id: TASK-12
priority: high
type: feature
ordinal: 17500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every user-visible preference in mallow is applied to the WebView that changed it and to no other. With one window that is indistinguishable from "applied to the app". With several it is a bug the user meets within a minute of opening the second window: change the theme, and only the window they changed it in follows.

The umbrella task puts per-window theme and language out of scope - meaning they are app-wide settings - so this is the work that makes the declaration true.

## What is per-WebView today

- **Theme** - `src/lib/theme.ts:57-66`: `setTheme` writes localStorage, sets `document.documentElement.dataset.theme` and notifies in-process subscribers. Nothing listens for changes made elsewhere.
- **Language** - `src/lib/i18n.tsx:183-190`: same shape, localStorage plus React state.
- **Explorer side and width, custom emoji folder** - `src/lib/settings.ts:27-34` writes the store, and `src/App.tsx` reads it once at mount (`:109-136`). `saveSetting` has no subscriber side.

The Settings modal opens in any window (`src/App.tsx:262-270`), so any of these can be changed from any window.

Do not reach for the `storage` event to fix this. Each window is its own WebView, and cross-WebView storage notification is not something to rely on across WKWebView, WebView2 and WebKitGTK. Tauri events are the mechanism that is actually app-wide.

## The one place a broadcast is correct

TASK-12.1 makes `fs:change` per-window and TASK-12.4 makes menu events go to the focused window, both because broadcasting was wrong there. This is the opposite case: an app-wide setting changed in one window must reach every window, so `app.emit` - the broadcast - is right here. Say so where it is used, because the surrounding code now avoids it deliberately.

Shape: the window that changes a setting reports it; Rust re-emits to every window; each window applies it, including a guard so the originating window does not fight its own update.

Keep these listeners on the default `EventTarget::Any` - but not because `Any` is what delivers a broadcast. An unfiltered `app.emit` reaches **every** listener whatever its target: it goes through `emit_js` with no filter (tauri-2.11.3 `src/manager/mod.rs:548`, `src/event/listener.rs:300-302`), and `match_any_or_filter` then returns `unwrap_or(true)` for all of them (`:305-311`). A window-scoped listener would receive this event just as well. What `Any` actually adds is the opposite - it also matches emits that *were* filtered - which is exactly why TASK-12.1 and TASK-12.4 move `fs:change` and `menu:settings` off it. Here there is nothing to narrow, so the default stands.

One thing that already works and should not be re-solved: every window shares the same WebView data store, so a newly created window reads the current theme and language out of localStorage at startup and comes up correct. What is missing is only the live update to windows that are already open - the receiving side therefore does not need to write localStorage again. Whether the emit goes through Rust or the frontend emits directly is an implementation choice - going through Rust keeps one authority, which is the pattern TASK-12.3 and TASK-12.7 already establish for the store.

## Scope

Theme and language first: they repaint the whole window and are the ones a user will notice immediately. Explorer side, explorer width and the custom emoji folder follow the same path and are cheap once it exists - the emoji case additionally needs `setCustomEmoji` re-applied per window, which already bumps a version `MarkdownView` subscribes to.

Anything not propagated must be written down as a known limitation in TASK-12.6 rather than left for a user to discover.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Changing the theme in one window repaints every open window immediately, and the change survives a relaunch
- [ ] #2 Changing the language in one window re-renders every open window's UI immediately
- [ ] #3 Explorer side, explorer width and the custom emoji folder either propagate the same way or are listed as known limitations in TASK-12.6
- [ ] #4 The originating window does not double-apply or fight its own update
- [ ] #5 Propagation uses Tauri events on the default Any target, not the storage event, and the comment says why broadcasting is correct here when fs:change and menu:settings are deliberately window-scoped
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 pnpm build, pnpm test, cargo check and cargo test pass
- [ ] #2 With three windows open, each setting is changed from a different window and all three windows agree afterwards
<!-- DOD:END -->
