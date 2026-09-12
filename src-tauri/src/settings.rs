//! The app-wide relay for a changed preference.
//!
//! It owns no setting value — `recent.rs` and `session.rs` are what own keys in
//! settings.json. This carries one window's change to the others.

use tauri::{Emitter, Manager, Window};

/// Re-emit a preference change to every window, stamped so that the windows can
/// order two changes against each other.
///
/// **`emit` — the broadcast — is correct here, and the surrounding code avoids
/// it deliberately**: `watch.rs` sends `fs:change` with `emit_to` because two
/// windows on overlapping folders must not see each other's changes, and
/// TASK-12.4 moves `menu:settings` off the broadcast it still uses below for the
/// same kind of reason — a menu item fires in the focused window. A preference is
/// the opposite case. Theme and language are app-wide by decision (TASK-12 puts
/// per-window theme and language out of scope), so a window that changes one has
/// to change it for all of them.
///
/// **The originating window is kept out by the stamp rather than by narrowing
/// the emit.** The frontend listens on the default `EventTarget::Any`, which
/// matches an emit that *was* filtered as readily as one that was not
/// (tauri-2.11.3 `src/event/listener.rs:305-311`), so `emit_to` per window would
/// isolate nothing.
///
/// **`origin` is stamped here and `at` is not**, which is the one split worth
/// knowing: the label is this window's identity and taking it from the payload
/// would let a window claim another's, while `at` has to exist *before* the
/// caller applies the change to itself — a moment this command has not been
/// reached yet. `lib/settings-sync` says what the pair is compared for.
///
/// `change` is opaque on purpose: which preferences exist is the frontend's to
/// know, and mirroring the list here would be a second copy to keep in step.
#[tauri::command]
pub fn broadcast_setting(change: serde_json::Value, at: i64, window: Window) -> Result<(), String> {
    let payload = serde_json::json!({
        "stamp": { "at": at, "origin": window.label() },
        "change": change,
    });
    window
        .app_handle()
        .emit("settings:change", payload)
        .map_err(|e| e.to_string())
}
