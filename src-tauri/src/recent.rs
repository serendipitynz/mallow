//! The recent-folder list behind Open Recent: `recentFolders` in settings.json,
//! newest first, capped, holding folder paths only. mallow opens folders rather
//! than files, so a recent *file* list would be a different feature.
//!
//! **Rust owns the list**, for two reasons that are not a style preference. The
//! Open Recent submenu is built here (TASK-12.4) and has to be rebuilt whenever
//! the list changes, so a frontend-owned list would have to notify Rust after
//! every write anyway. And recording is a read-modify-write: done from JS the
//! read, the splice and the write are three steps with no lock between them, so
//! two windows recording at once lose an entry.
//!
//! Pruning entries whose folder no longer exists is deliberately not here. It
//! touches the filesystem and belongs at submenu build time — one rule, one
//! place, and nothing prunes on read.

use std::sync::{Arc, Mutex};

use tauri::{AppHandle, State, Wry};
use tauri_plugin_store::{JsonValue, Store, StoreExt};

/// How many folders the list keeps. The oldest is dropped once a recording takes
/// it past this.
const RECENT_CAP: usize = 10;

/// The store `src/lib/settings.ts` loads, named identically so both sides resolve
/// the same path.
const SETTINGS_STORE: &str = "settings.json";

const RECENT_KEY: &str = "recentFolders";

/// Serializes a recording's read-modify-write.
///
/// The store locks around `get` and around `set`, but a recording is both with a
/// decision in between, and tauri runs a command per calling window on its own
/// thread. Without this, two windows recording at once each read the list before
/// either wrote, and the second write drops the first's entry — the same lost
/// update that ruled out owning the list in JS, which simply had nowhere to hold
/// a lock.
#[derive(Default)]
pub struct RecentLock(Mutex<()>);

/// The settings store, which is **the same in-process instance the frontend
/// holds**: `build_inner` hands back the store already registered for a path
/// rather than building a second one (tauri-plugin-store-2.4.3
/// `src/store.rs:194-203`), so there is nothing to clobber.
///
/// What sharing one instance does cost is options: whichever side reaches the
/// path first wins, and **the later side's options are dropped with no error**.
/// Both ask for a 100 ms auto-save today (JS passes `autoSave: true`, the Rust
/// default is the same at `src/store.rs:68`), so nothing diverges — but an option
/// set on one side alone would silently not take effect.
fn settings_store(app: &AppHandle) -> Result<Arc<Store<Wry>>, String> {
    app.store(SETTINGS_STORE).map_err(|e| e.to_string())
}

/// The folder paths in a stored `recentFolders` value.
///
/// A value that is not an array, and an entry that is not a string, are dropped
/// rather than failing the read: settings.json is a file a reader can edit, and a
/// list that cannot be understood must not be what stops a folder being recorded.
fn folders_from(value: Option<JsonValue>) -> Vec<String> {
    match value {
        Some(JsonValue::Array(items)) => items
            .into_iter()
            .filter_map(|item| match item {
                JsonValue::String(path) => Some(path),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// `list` with `path` recorded at its front: already-listed spellings move rather
/// than duplicate, and the oldest entry falls off at `cap`.
///
/// **Comparison is on the string the folder dialog returned.** macOS and Windows
/// filesystems are case-insensitive, so two spellings of one folder can both be
/// listed; that is accepted rather than normalised, because case-insensitivity is
/// a property of the volume rather than of the OS and any folding here would be a
/// guess about a filesystem this process has not asked.
///
/// The cap is applied after insertion, so recording into a full list keeps the
/// folder just opened.
fn with_recorded(list: Vec<String>, path: &str, cap: usize) -> Vec<String> {
    let mut updated = Vec::with_capacity(list.len() + 1);
    updated.push(path.to_string());
    updated.extend(list.into_iter().filter(|listed| listed != path));
    updated.truncate(cap);
    updated
}

/// Record `path` as the most recently opened folder.
#[tauri::command]
pub fn record_recent(path: String, app: AppHandle, lock: State<RecentLock>) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    let store = settings_store(&app)?;
    let updated = with_recorded(folders_from(store.get(RECENT_KEY)), &path, RECENT_CAP);
    store.set(RECENT_KEY, updated);
    Ok(())
}

/// The recent folders, newest first.
#[tauri::command]
pub fn list_recent(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(folders_from(settings_store(&app)?.get(RECENT_KEY)))
}

/// Empty the list. What `Clear Recent` does once TASK-12.4 gives it a menu item.
#[tauri::command]
pub fn clear_recent(app: AppHandle, lock: State<RecentLock>) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    settings_store(&app)?.delete(RECENT_KEY);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folders(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn a_recorded_folder_goes_to_the_front() {
        assert_eq!(with_recorded(folders(&["/a", "/b"]), "/c", 10), folders(&["/c", "/a", "/b"]));
    }

    #[test]
    fn recording_a_listed_folder_moves_it_rather_than_duplicating_it() {
        assert_eq!(with_recorded(folders(&["/a", "/b", "/c"]), "/c", 10), folders(&["/c", "/a", "/b"]));
    }

    #[test]
    fn recording_the_front_folder_again_leaves_the_order_alone() {
        assert_eq!(with_recorded(folders(&["/a", "/b"]), "/a", 10), folders(&["/a", "/b"]));
    }

    #[test]
    fn the_oldest_entry_is_dropped_at_the_cap() {
        assert_eq!(with_recorded(folders(&["/a", "/b", "/c"]), "/d", 3), folders(&["/d", "/a", "/b"]));
    }

    /// The cap running after the insertion is what keeps the folder just opened:
    /// truncating first would drop the oldest for nothing and then still have to
    /// drop one more.
    #[test]
    fn a_move_inside_a_full_list_loses_nothing() {
        assert_eq!(with_recorded(folders(&["/a", "/b", "/c"]), "/c", 3), folders(&["/c", "/a", "/b"]));
    }

    /// The stated decision, not a silent normalisation: on a case-insensitive
    /// volume these are one folder and the list shows two entries.
    #[test]
    fn two_spellings_of_one_folder_are_two_entries() {
        assert_eq!(with_recorded(folders(&["/Docs"]), "/docs", 10), folders(&["/docs", "/Docs"]));
    }

    #[test]
    fn an_absent_key_reads_as_an_empty_list() {
        assert_eq!(folders_from(None), Vec::<String>::new());
    }

    #[test]
    fn a_hand_edited_value_yields_what_can_be_read_rather_than_nothing() {
        let stored =
            JsonValue::Array(vec![JsonValue::String("/a".into()), JsonValue::from(7), JsonValue::String("/b".into())]);
        assert_eq!(folders_from(Some(stored)), folders(&["/a", "/b"]));
        assert_eq!(folders_from(Some(JsonValue::String("/a".into()))), Vec::<String>::new());
    }
}
