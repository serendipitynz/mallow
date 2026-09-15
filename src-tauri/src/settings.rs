//! The app-wide relay for a changed preference, and the authority that puts the
//! changes in order.
//!
//! It owns no setting *value* — `recent.rs` and `session.rs` are what own keys in
//! settings.json. What it owns is the **order**: one high-water mark for the
//! whole process, which every change is given a place above.
//!
//! **Why the order lives here rather than in each window** (TASK-33): a window
//! can only order what it has seen, so the two things a window cannot do alone
//! are exactly the two that were wrong. It cannot keep a peer's mark it never
//! received — a window opened after the wall clock stepped backwards mints below
//! every window that lived through the step, and is refused by all of them while
//! applying its own change to itself. And it cannot make its store write join the
//! order — two windows writing one preference complete in whatever order the
//! plugin gets to them, so settings.json can end up holding a value no open
//! window is showing. This process sees every change, so it can do both.

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, Window, Wry};
use tauri_plugin_store::{JsonValue, Store, StoreExt};

/// The store `src/lib/settings.ts` reads, named identically so both sides resolve
/// the same path (`recent.rs` says what sharing one instance costs).
const SETTINGS_STORE: &str = "settings.json";

/// One changed preference, as the window that changed it sends it.
///
/// **Rust reads the key and the value and nothing else.** The key is what a
/// store-backed preference is written under, the value is what it is written
/// from — but *which* preferences exist, and which of them the store holds,
/// stays written once in the frontend: the second question arrives as `persist`
/// rather than as a list of keys mirrored here to fall out of step.
#[derive(Deserialize, Serialize)]
pub struct SettingChange {
    key: String,
    value: JsonValue,
}

/// The highest `at` this process has assigned, across every preference key.
///
/// **One mark rather than one per key**, and that is what makes a settings read
/// comparable with a change at all: a read returns the whole file, so the only
/// stamp that says the right thing about it is one above every key. Marks kept
/// per key and a read stamped from the highest of them are not the same number —
/// the read would carry some other key's mark, and a later change to its own key,
/// raised only past that key's lower mark, would be refused by the window that
/// read. **Ordering per key is not lost by sharing one sequence**: two changes to
/// one key are still ordered by it, and `supersedes` never compares across keys.
///
/// One mutex over the mark *and* the store write, for the reason `session.rs`
/// gives for covering its live set and its write with one: they are one step.
#[derive(Default)]
pub struct SettingsOrder(Mutex<i64>);

fn settings_store(app: &AppHandle) -> Result<Arc<Store<Wry>>, String> {
    app.store(SETTINGS_STORE).map_err(|e| e.to_string())
}

/// Where a change asking for `requested` actually lands, given the highest place
/// already assigned.
///
/// A stamp at or below the mark is raised past it rather than refused, because
/// the window that minted it has **already applied the value to itself** — a
/// refusal would leave that window alone on a value the others declined, which
/// is the divergence the order exists to close. Raising instead makes its change
/// the newest, which every window can follow.
///
/// So the mark strictly increases and no two changes ever share an `at`: the
/// label only ever breaks a tie against a stamp this process did not assign,
/// which is a window's own optimistic one and a settings read.
fn effective_at(requested: i64, mark: i64) -> i64 {
    if requested <= mark {
        mark.saturating_add(1)
    } else {
        requested
    }
}

/// Give `change` its place in the order, persist it if the store holds it, and
/// tell every window.
///
/// **`emit` — the broadcast — is correct here, and the surrounding code avoids
/// it deliberately**: `watch.rs` sends `fs:change` with `emit_to` because two
/// windows on overlapping folders must not see each other's changes, and
/// `menu.rs` reaches one window for the same kind of reason — a menu item fires
/// in the focused window. A preference is the opposite case. Theme and language
/// are app-wide by decision (TASK-12 puts per-window theme and language out of
/// scope), so a window that changes one has to change it for all of them.
///
/// **The originating window is kept out by the stamp rather than by narrowing
/// the emit.** The frontend listens on the default `EventTarget::Any`, which
/// matches an emit that *was* filtered as readily as one that was not
/// (tauri-2.11.3 `src/event/listener.rs:305-311`), so `emit_to` per window would
/// isolate nothing.
///
/// **`origin` is stamped here and `at` arrives already minted**, which is the one
/// split worth knowing: the label is this window's identity and taking it from
/// the payload would let a window claim another's, while `at` has to exist
/// *before* the caller applies the change to itself — a moment this command has
/// not been reached yet. What arrives is therefore a request, and `effective_at`
/// is what answers it.
///
/// **The store write is moved here rather than gated where it was**, which is
/// TASK-33's choice and the alternative was to leave it in `saveSetting` and skip
/// it when the stamp is no longer the newest. That gate narrows the window
/// without closing it: it can only be read before the write is handed to the
/// plugin, and a write already handed over cannot be recalled, so two writes
/// still complete in whatever order the plugin reaches them. Under this lock
/// there is nothing to refuse — a write that lands late is *given* the newest
/// stamp, so the last value to reach settings.json is by construction the one
/// every window ends up showing.
#[tauri::command]
pub fn commit_setting(
    change: SettingChange,
    at: i64,
    persist: bool,
    window: Window,
    order: State<SettingsOrder>,
) -> Result<(), String> {
    // The lock covers the place and the write and is dropped before the emit:
    // broadcast order is not what orders the changes — the stamp is, and every
    // window compares it — so there is nothing to gain by holding it across an
    // emit that can wait on the main thread, which is the shape `record_recent`
    // deadlocked on.
    let at = {
        let mut mark = order.0.lock().map_err(|e| e.to_string())?;
        let at = effective_at(at, *mark);
        *mark = at;
        if persist {
            let store = settings_store(window.app_handle())?;
            if change.value.is_null() {
                store.delete(&change.key);
            } else {
                store.set(&change.key, change.value.clone());
            }
        }
        at
    };
    let payload = serde_json::json!({
        "stamp": { "at": at, "origin": window.label() },
        "change": change,
    });
    window
        .app_handle()
        .emit("settings:change", payload)
        .map_err(|e| e.to_string())
}

/// The stamp a window reading settings.json now should compare that answer
/// against: everything assigned before it has already been written, and
/// everything assigned after it is given a higher place than this. Asked for
/// before the read is issued, never after. Zero before anything has been
/// committed is that same sentence with nothing on either side of it.
#[tauri::command]
pub fn settings_read_stamp(order: State<SettingsOrder>) -> Result<i64, String> {
    let mark = order.0.lock().map_err(|e| e.to_string())?;
    Ok(*mark)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Zero is the mark before anything has been committed, so the first change
    /// is taken as it was minted.
    #[test]
    fn the_first_change_takes_the_stamp_it_was_given() {
        assert_eq!(effective_at(1_000, 0), 1_000);
    }

    #[test]
    fn a_stamp_the_order_has_moved_past_is_raised_rather_than_refused() {
        // The window that minted 100 has already applied its value; refused, it
        // would be the only window on it.
        assert_eq!(effective_at(100, 5_000), 5_001);
    }

    #[test]
    fn two_changes_minted_in_one_millisecond_do_not_share_a_place() {
        assert_eq!(effective_at(1_000, 1_000), 1_001);
    }

    /// The clock rollback in TASK-33's second hole: a window opened afterwards
    /// mints from the low wall clock, and what it gets is a place above every
    /// window that lived through the step.
    #[test]
    fn a_window_minting_below_the_mark_still_ends_up_newest() {
        let mark = 3_700_000;
        let raised = effective_at(100_000, mark);
        assert!(raised > mark);
        assert!(effective_at(100_000, raised) > raised);
    }

    /// What one mark buys over one per key. A change to a far-ahead preference
    /// puts the read stamp where it is; a change to a preference whose own
    /// history is much older, minted low, still has to outrank that read — with
    /// marks kept per key it would not, and the window that read would refuse it.
    #[test]
    fn a_change_after_a_read_outranks_it_whichever_key_either_touched() {
        let far_ahead_key = effective_at(1_000_000, 0);
        let read = far_ahead_key;
        let other_key = effective_at(100, far_ahead_key);
        assert!(other_key > read);
    }
}
