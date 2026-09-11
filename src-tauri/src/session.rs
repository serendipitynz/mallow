//! The restored session: the `windows` key in settings.json, which is what a
//! relaunch reproduces.
//!
//! One entry per window open at quit — its label, the folder it showed, the
//! ordered list of files it had open and which of them was active — ordered
//! least-recently-focused first, so the last entry is the window that ends up
//! focused once every window has been created in that order.
//!
//! **The file half is a list even though nothing here opens more than one file
//! per window.** TASK-13's tabs do, and decision-4 settles the shape now because
//! this module already carries a one-time migration of `lastFolder` / `lastFile`
//! *and* a rewrite of another plugin's state file; a second round of that when
//! tabs land costs more than one shape decision taken early.
//!
//! **Rust owns it for the reason Rust owns the recent list**: several windows
//! read-modify-writing one array from JS lose entries, and from JS the read, the
//! splice and the write are three steps with no lock between them. Here the live
//! set and the store write happen under one mutex.
//!
//! **It replaces `lastFolder` / `lastFile` rather than sitting beside them** —
//! two sources of truth for "where was I" is how they drift apart.

// An unattended build registers no session (see `lib.rs`), so everything the
// launch reads — the migration, the cap, the restore and the plugin that runs
// them — is compiled there and never reached. Allowed here rather than gated per
// item: what that build leaves out is the registration, and splitting the module
// in two to say so would cost more than it tells anyone. An ordinary build still
// reports dead code the usual way.
#![cfg_attr(unattended, allow(dead_code))]

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, State, Window, Wry};
use tauri_plugin_store::{JsonValue, Store, StoreExt};

/// How many windows a relaunch brings back.
///
/// The cost of a restored window is not small: each one is a WebView of its own
/// carrying its own Shiki WASM highlighter and its own mermaid instance, so a
/// session that grew by accident would spend that cost before the reader has
/// asked for anything. Entries are dropped from the least-recently-focused end,
/// which keeps the windows the reader was actually working in.
const RESTORE_CAP: usize = 8;

/// The store `src/lib/settings.ts` loads, named identically so both sides resolve
/// the same path. See `recent.rs` for why sharing one instance is safe and what
/// it costs.
const SETTINGS_STORE: &str = "settings.json";

const WINDOWS_KEY: &str = "windows";

/// The pair this replaces. Read once, on the first launch after the upgrade, and
/// then deleted so nothing can read them again.
///
/// **`lastFiles` / `lastActive` are deliberately not read.** That pair only ever
/// exists in an install that took TASK-13.4 before this task, and TASK-13.4 has
/// not landed — so no install carries them, and a branch for them would be one
/// nothing reaches. If tabs ever do ship ahead of a repeat of this migration,
/// this is the place that has to grow the branch.
const LEGACY_FOLDER_KEY: &str = "lastFolder";
const LEGACY_FILE_KEY: &str = "lastFile";

/// The label a migrated install's single window takes, and the label a launch
/// with nothing stored creates its window under. It is `w1` because that is what
/// `WindowInitRegistry::reserve` would hand out first; the geometry migration
/// below moves the old `main` entry onto it.
const FIRST_LABEL: &str = "w1";

/// One window's row in the restored session.
///
/// `folder` is absent for a window showing nothing, and such a window **is
/// restored**: it keeps the window count honest, and an empty window is what a
/// first launch already puts on screen, so restoring one shows the reader
/// nothing they have not seen.
#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize)]
pub struct WindowEntry {
    pub label: String,
    pub folder: Option<String>,
    pub files: Vec<String>,
    pub active: Option<String>,
}

/// The live set, in focus order. A `Vec` rather than a map plus an order beside
/// it: the order is half the meaning of this value, and two structures that can
/// disagree about which labels exist is a state nothing would notice being in.
#[derive(Default)]
pub struct SessionState(Mutex<Vec<WindowEntry>>);

/// The live set, or `None` in an unattended build, which registers no session at
/// all: a measurement run must leave the reader's settings where it found them,
/// so every entry point below does nothing rather than writing a row for the one
/// window it opens.
fn live(app: &AppHandle) -> Option<State<'_, SessionState>> {
    app.try_state::<SessionState>()
}

fn settings_store(app: &AppHandle) -> Result<Arc<Store<Wry>>, String> {
    app.store(SETTINGS_STORE).map_err(|e| e.to_string())
}

/// The entries in a stored `windows` value.
///
/// A row that cannot be read is dropped rather than failing the read, for the
/// reason `recent.rs` gives: settings.json is a file a reader can edit, and one
/// unreadable row must not cost them every window.
fn entries_from(value: Option<JsonValue>) -> Vec<WindowEntry> {
    match value {
        Some(JsonValue::Array(items)) => items
            .into_iter()
            .filter_map(|item| serde_json::from_value::<WindowEntry>(item).ok())
            .collect(),
        _ => Vec::new(),
    }
}

/// The last `cap` entries, so what is dropped is the least-recently-focused end.
fn capped(entries: Vec<WindowEntry>, cap: usize) -> Vec<WindowEntry> {
    let surplus = entries.len().saturating_sub(cap);
    entries.into_iter().skip(surplus).collect()
}

/// `entries` with `label`'s row saying it now shows `folder` and `file`.
///
/// A window with no folder holds no files either: the file half only means
/// anything inside a folder, and a row carrying one without the other would
/// restore a selection into a window with nothing to select it in.
fn with_reported(
    mut entries: Vec<WindowEntry>,
    label: &str,
    folder: Option<String>,
    file: Option<String>,
) -> Vec<WindowEntry> {
    let file = folder.as_ref().and(file);
    let row = WindowEntry { label: label.to_string(), files: file.iter().cloned().collect(), active: file, folder };
    match entries.iter_mut().find(|entry| entry.label == label) {
        // In place: reporting content is not a focus change, and moving the row
        // would reorder the session behind the reader's back.
        Some(existing) => *existing = row,
        None => entries.push(row),
    }
    entries
}

/// `entries` with a row for `label` if it had none, carrying what that window was
/// created to open.
///
/// It is what keeps the window count honest independently of the frontend: a
/// window created and quit before it ever mounted would otherwise leave no row.
/// An existing row is left exactly as it is — the restore path creates windows
/// whose rows are already here, and seeding over one would throw away the folder
/// it is about to reopen.
fn with_ensured(
    mut entries: Vec<WindowEntry>,
    label: &str,
    folder: Option<String>,
    file: Option<String>,
) -> Vec<WindowEntry> {
    if entries.iter().any(|entry| entry.label == label) {
        return entries;
    }
    let file = folder.as_ref().and(file);
    entries.push(WindowEntry { label: label.to_string(), files: file.iter().cloned().collect(), active: file, folder });
    entries
}

/// `entries` with `label`'s row moved to the end.
///
/// The order is least-recently-focused first, so gaining focus moves a window to
/// the end. **Only the `true` edge reorders** — reordering on `false` would
/// invert the order, since the window losing focus would be the one moved to the
/// end.
fn with_focused(mut entries: Vec<WindowEntry>, label: &str) -> Vec<WindowEntry> {
    let Some(at) = entries.iter().position(|entry| entry.label == label) else {
        return entries;
    };
    let row = entries.remove(at);
    entries.push(row);
    entries
}

/// The last-window rule: a destroyed window's row leaves the session only if
/// another window is still alive at that moment.
///
/// A window's destroy handler cannot tell why it is being destroyed, and every
/// quit path defeats the flag-on-`ExitRequested` design an earlier draft used —
/// TASK-12.7 records all four. The window count is what decides instead, and
/// nothing here depends on event ordering: the final window's row survives into
/// the next launch, which is the quit case.
///
/// **`others_alive` is "the window map is not empty", not "it holds more than
/// one".** By the time a `Builder::on_window_event` handler runs, tauri has
/// already removed the dying window from that map, so the naive test is off by
/// one and would never drop anything.
fn without_destroyed(entries: Vec<WindowEntry>, label: &str, others_alive: bool) -> Vec<WindowEntry> {
    if !others_alive {
        return entries;
    }
    entries.into_iter().filter(|entry| entry.label != label).collect()
}

/// A single-entry session seeded from the retired pair, or `None` when there is
/// nothing to migrate.
///
/// Without this step everyone with mallow already installed loses their open
/// folder on the upgrade. A `windows` key that already exists wins: the migration
/// runs once, and a second run must not overwrite a real session with whatever a
/// stale `lastFolder` still says.
fn migrated(
    windows: Option<JsonValue>,
    folder: Option<JsonValue>,
    file: Option<JsonValue>,
) -> Option<Vec<WindowEntry>> {
    if windows.is_some() {
        return None;
    }
    let JsonValue::String(folder) = folder? else {
        return None;
    };
    let file = match file {
        Some(JsonValue::String(file)) => Some(file),
        _ => None,
    };
    Some(vec![WindowEntry {
        label: FIRST_LABEL.to_string(),
        folder: Some(folder),
        files: file.iter().cloned().collect(),
        active: file,
    }])
}

/// tauri-plugin-window-state's cache with the `main` entry filed under `label`,
/// or `None` when there is nothing to move.
///
/// Every existing install has its size and position filed under `main`, and
/// after `"create": false` nothing is ever labelled `main` again — so without
/// this the first launch after the upgrade resizes and repositions every
/// existing window, and the dead key would then persist forever, since the
/// plugin loads the whole cache at setup and writes it back at exit whether or
/// not any window claims a label.
///
/// **`main` goes whether or not it is moved**, which is the half that keeps the
/// file bounded by the number of windows open at once: a label nothing can ever
/// claim again would otherwise be written back at every exit forever. It is
/// moved onto `label` only where that label remembers nothing itself — geometry
/// a window really had beats geometry belonging to a label that cannot exist.
fn with_main_renamed(mut states: JsonValue, label: &str) -> Option<JsonValue> {
    let object = states.as_object_mut()?;
    let main = object.remove("main")?;
    if !object.contains_key(label) {
        object.insert(label.to_string(), main);
    }
    Some(states)
}

fn window_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join(tauri_plugin_window_state::DEFAULT_FILENAME))
}

/// Move the `main` geometry onto `label`, in the file tauri-plugin-window-state
/// owns.
///
/// **The cost to accept**: this reads and rewrites another plugin's state file,
/// so it is coupled to that file's format. Acceptable for a migration that runs
/// once and can be dropped later; not a pattern to reuse. It also has to run
/// before that plugin's own setup loads the file into its cache, which is what
/// fixes where this plugin is registered — see `lib.rs`.
fn rename_main_geometry(app: &AppHandle, label: &str) -> Result<(), String> {
    let path = window_state_path(app)?;
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(());
    };
    let Ok(states) = serde_json::from_str::<JsonValue>(&text) else {
        return Ok(());
    };
    let Some(renamed) = with_main_renamed(states, label) else {
        return Ok(());
    };
    std::fs::write(&path, serde_json::to_string(&renamed).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn write(store: &Store<Wry>, entries: &[WindowEntry]) -> Result<(), String> {
    store.set(WINDOWS_KEY, serde_json::to_value(entries).map_err(|e| e.to_string())?);
    Ok(())
}

/// Apply `change` to the live set and write the result through.
///
/// **The store write happens under the same lock as the change**, which is what
/// makes a report from one window and a focus change in another two steps rather
/// than four interleaved ones.
///
/// **Written through on every change rather than held until exit.** Holding it
/// would mean a crash or a force-quit loses the whole session, which is a
/// regression from `lastFolder`: that reached disk through the store's 100 ms
/// auto-save, and so does this. The exit flush then only has to cover the quit
/// paths that emit no destroy events.
fn update(app: &AppHandle, change: impl FnOnce(Vec<WindowEntry>) -> Vec<WindowEntry>) -> Result<(), String> {
    let Some(state) = live(app) else {
        return Ok(());
    };
    let mut entries = state.0.lock().map_err(|e| e.to_string())?;
    *entries = change(std::mem::take(&mut entries));
    write(settings_store(app)?.as_ref(), &entries)
}

/// Say which folder and file this window now shows.
///
/// **Called whenever a window's displayed content changes, which is a predicate
/// and not a list of call sites**: the folder picker, a handed-over or restored
/// initial location, and TASK-12.5's Open Recent replace are all of them today,
/// and anchoring the rule to any of them is how the next one gets missed. The
/// frontend satisfies it with an effect on the displayed folder and selection
/// rather than a call beside each of them.
///
/// The signature stays single-file through TASK-12 — one window genuinely shows
/// one file until tabs exist — and TASK-13 widens it to the tab set. That is a
/// signature change against a stored shape that already accommodates it.
#[tauri::command]
pub fn report_window_content(folder: Option<String>, file: Option<String>, window: Window) -> Result<(), String> {
    let label = window.label().to_string();
    update(window.app_handle(), |entries| with_reported(entries, &label, folder, file))
}

/// Give a created window a row if it has none, carrying what it was created to
/// open. Called once the window has been built, so a failed build leaves nothing
/// behind.
pub fn note_window_created(app: &AppHandle, label: &str, folder: Option<String>, file: Option<String>) {
    if let Err(e) = update(app, |entries| with_ensured(entries, label, folder, file)) {
        eprintln!("mallow: a created window could not be recorded in the session ({e})");
    }
}

/// Move a window to the end of the session: it is the most recently focused.
pub fn note_window_focused(window: &Window) {
    let label = window.label().to_string();
    if let Err(e) = update(window.app_handle(), |entries| with_focused(entries, &label)) {
        eprintln!("mallow: a focus change could not be recorded in the session ({e})");
    }
}

/// Drop a destroyed window's row under the last-window rule.
pub fn note_window_destroyed(window: &Window) {
    let app = window.app_handle();
    // `webview_windows()` rather than the `Manager::windows` family, which is
    // behind the `unstable` cargo feature this project does not enable.
    let others_alive = !app.webview_windows().is_empty();
    let label = window.label().to_string();
    if let Err(e) = update(app, |entries| without_destroyed(entries, &label, others_alive)) {
        eprintln!("mallow: a closed window could not be dropped from the session ({e})");
    }
}

/// Write the live set out and save the store synchronously.
///
/// **Both halves are needed.** The flush covers the three quit paths that emit
/// no destroy events at all (macOS ⌘Q, a predefined Quit item, `AppHandle::exit`),
/// and the synchronous save covers the fact that tauri-plugin-store already ran
/// its own exit save by now: plugin `on_event` handlers run before the app's run
/// callback, and `autoSave` is a debounce the process exits ahead of.
pub fn flush_at_exit(app: &AppHandle) {
    let flushed = (|| {
        let Some(state) = live(app) else {
            return Ok(());
        };
        let entries = state.0.lock().map_err(|e| e.to_string())?;
        let store = settings_store(app)?;
        write(&store, &entries)?;
        store.save().map_err(|e| e.to_string())
    })();
    if let Err(e) = flushed {
        eprintln!("mallow: the session could not be saved at exit ({e})");
    }
}

/// Create one window per restored entry, in saved order, each under its own
/// label and opening what it showed at quit.
///
/// **Saved order settles focus for free**: tauri-plugin-window-state shows and
/// focuses each window as it restores it, so the last one created — the most
/// recently focused at quit — is the one left in front. The `Focused` events
/// that generates rewrite the order harmlessly, since they arrive in the order
/// the entries were saved in.
///
/// A launch with nothing stored creates one empty window, which is what a first
/// launch has always done. A restored entry whose folder has since gone is not
/// dropped: the window opens empty, so the window count is preserved and the
/// reader can see which one lost its folder. That check is the frontend's, which
/// already validates both halves of a location before opening it.
pub fn open_restored_windows(app: &AppHandle) -> Result<(), String> {
    let restored = match live(app) {
        Some(state) => state.0.lock().map_err(|e| e.to_string())?.clone(),
        None => Vec::new(),
    };
    if restored.is_empty() {
        crate::window::create_window(app, None, None, None)?;
        return Ok(());
    }
    for entry in restored {
        let location = entry
            .folder
            .map(|folder| crate::window::InitialLocation { folder, file: entry.active });
        crate::window::create_window(app, location, Some(entry.label), None)?;
    }
    Ok(())
}

/// Read the restored session, migrating an install that carries the retired keys,
/// and hold it as the live set.
fn prepare(app: &AppHandle) -> Result<(), String> {
    let store = settings_store(app)?;
    let seeded = migrated(store.get(WINDOWS_KEY), store.get(LEGACY_FOLDER_KEY), store.get(LEGACY_FILE_KEY));
    // Deleted whether or not they seeded anything, so nothing reads them again.
    store.delete(LEGACY_FOLDER_KEY);
    store.delete(LEGACY_FILE_KEY);

    let stored = seeded.unwrap_or_else(|| entries_from(store.get(WINDOWS_KEY)));
    let restored = capped(stored, RESTORE_CAP);
    write(&store, &restored)?;
    rename_main_geometry(app, restored.first().map_or(FIRST_LABEL, |entry| entry.label.as_str()))?;

    if let Some(state) = live(app) {
        *state.0.lock().map_err(|e| e.to_string())? = restored;
    }
    Ok(())
}

/// The restored session as a plugin, **so that it is set up before
/// tauri-plugin-window-state and after tauri-plugin-store**.
///
/// Plugin setup hooks run in registration order and all of them run before the
/// app's own `setup` closure (tauri-2.11.3 `src/app.rs:2440` against `:1424`),
/// which is the only place the geometry migration can happen: the window-state
/// plugin loads its whole cache in its setup and writes that cache back at exit,
/// so a rewrite made later is simply overwritten.
///
/// **A session that cannot be read is not fatal.** An unreadable settings file
/// costs the reader their window set, which launching with one empty window
/// already gives them; refusing to launch would cost them the app.
pub fn init() -> TauriPlugin<Wry> {
    tauri::plugin::Builder::new("mallow-session")
        .setup(|app, _api| {
            app.manage(SessionState::default());
            if let Err(e) = prepare(app) {
                eprintln!("mallow: the restored session could not be read ({e}); launching with one empty window");
            }
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(label: &str, folder: Option<&str>, file: Option<&str>) -> WindowEntry {
        WindowEntry {
            label: label.to_string(),
            folder: folder.map(str::to_string),
            files: file.iter().map(|f| f.to_string()).collect(),
            active: file.map(str::to_string),
        }
    }

    fn labels(entries: &[WindowEntry]) -> Vec<&str> {
        entries.iter().map(|e| e.label.as_str()).collect()
    }

    #[test]
    fn a_reported_folder_and_file_become_that_windows_row() {
        let entries = with_reported(Vec::new(), "w1", Some("/docs".into()), Some("/docs/a.md".into()));
        assert_eq!(entries, vec![entry("w1", Some("/docs"), Some("/docs/a.md"))]);
    }

    /// The list shape TASK-13.4 inherits: one file today is a one-element list
    /// whose only entry is the active one.
    #[test]
    fn the_file_half_is_a_list_naming_its_active_entry() {
        let entries = with_reported(Vec::new(), "w1", Some("/docs".into()), Some("/docs/a.md".into()));
        assert_eq!(entries[0].files, vec!["/docs/a.md".to_string()]);
        assert_eq!(entries[0].active.as_deref(), Some("/docs/a.md"));
    }

    #[test]
    fn a_window_on_no_file_reports_an_empty_list_and_no_active_entry() {
        let entries = with_reported(Vec::new(), "w1", Some("/docs".into()), None);
        assert_eq!(entries, vec![entry("w1", Some("/docs"), None)]);
    }

    /// A selection cannot outlive the folder it was made in, so a report that
    /// loses the folder loses the file with it.
    #[test]
    fn a_window_showing_nothing_keeps_no_file() {
        let entries = with_reported(Vec::new(), "w1", None, Some("/docs/a.md".into()));
        assert_eq!(entries, vec![entry("w1", None, None)]);
    }

    #[test]
    fn reporting_again_replaces_that_windows_row_without_reordering() {
        let entries = vec![entry("w1", Some("/a"), None), entry("w2", Some("/b"), None)];
        let entries = with_reported(entries, "w1", Some("/c".into()), None);
        assert_eq!(labels(&entries), vec!["w1", "w2"]);
        assert_eq!(entries[0].folder.as_deref(), Some("/c"));
    }

    #[test]
    fn a_focused_window_moves_to_the_end() {
        let entries = vec![entry("w1", None, None), entry("w2", None, None), entry("w3", None, None)];
        assert_eq!(labels(&with_focused(entries, "w1")), vec!["w2", "w3", "w1"]);
    }

    #[test]
    fn focusing_the_last_window_leaves_the_order_alone() {
        let entries = vec![entry("w1", None, None), entry("w2", None, None)];
        assert_eq!(labels(&with_focused(entries, "w2")), vec!["w1", "w2"]);
    }

    /// The last-window rule. Closing one of several drops its row; closing the
    /// last one keeps it, because that is the quit case and the session is what
    /// the next launch reads.
    #[test]
    fn a_closed_window_leaves_the_session_only_while_another_is_alive() {
        let entries = vec![entry("w1", Some("/a"), None), entry("w2", Some("/b"), None)];
        assert_eq!(labels(&without_destroyed(entries.clone(), "w1", true)), vec!["w2"]);
        assert_eq!(
            without_destroyed(entries, "w1", false),
            vec![entry("w1", Some("/a"), None), entry("w2", Some("/b"), None)]
        );
    }

    #[test]
    fn the_final_windows_row_survives_into_the_next_launch() {
        let entries = vec![entry("w2", Some("/b"), Some("/b/x.md"))];
        assert_eq!(without_destroyed(entries.clone(), "w2", false), entries);
    }

    #[test]
    fn a_created_window_gets_a_row_carrying_what_it_was_told_to_open() {
        let entries = with_ensured(Vec::new(), "w3", Some("/docs".into()), Some("/docs/a.md".into()));
        assert_eq!(entries, vec![entry("w3", Some("/docs"), Some("/docs/a.md"))]);
    }

    /// What the restore path rests on: it creates windows whose rows are already
    /// in the live set, and seeding over one would throw away the folder that
    /// window is about to reopen.
    #[test]
    fn creating_a_window_over_a_restored_row_leaves_that_row_alone() {
        let entries = vec![entry("w1", Some("/docs"), Some("/docs/a.md"))];
        assert_eq!(with_ensured(entries.clone(), "w1", None, None), entries);
    }

    #[test]
    fn the_least_recently_focused_entries_are_the_ones_dropped_at_the_cap() {
        let entries = vec![entry("w1", None, None), entry("w2", None, None), entry("w3", None, None)];
        assert_eq!(labels(&capped(entries, 2)), vec!["w2", "w3"]);
    }

    #[test]
    fn a_session_within_the_cap_is_left_whole() {
        let entries = vec![entry("w1", None, None)];
        assert_eq!(capped(entries.clone(), 8), entries);
    }

    #[test]
    fn an_absent_windows_key_reads_as_no_session() {
        assert_eq!(entries_from(None), Vec::new());
    }

    #[test]
    fn a_hand_edited_row_costs_that_row_and_not_the_session() {
        let stored = JsonValue::Array(vec![
            serde_json::json!({ "label": "w1", "folder": "/a", "files": [], "active": null }),
            serde_json::json!({ "folder": "/b" }),
        ]);
        assert_eq!(entries_from(Some(stored)), vec![entry("w1", Some("/a"), None)]);
    }

    #[test]
    fn the_retired_pair_becomes_a_single_entry_session() {
        let migrated =
            migrated(None, Some(JsonValue::String("/docs".into())), Some(JsonValue::String("/docs/a.md".into())));
        assert_eq!(migrated, Some(vec![entry(FIRST_LABEL, Some("/docs"), Some("/docs/a.md"))]));
    }

    #[test]
    fn a_retired_folder_with_no_file_migrates_to_a_window_on_no_file() {
        let migrated = migrated(None, Some(JsonValue::String("/docs".into())), None);
        assert_eq!(migrated, Some(vec![entry(FIRST_LABEL, Some("/docs"), None)]));
    }

    /// The migration runs once. A stored session wins, or a stale `lastFolder`
    /// left by a hand-edited file would overwrite a real window set.
    #[test]
    fn an_existing_session_is_not_migrated_over() {
        let windows =
            JsonValue::Array(vec![serde_json::json!({ "label": "w1", "folder": "/b", "files": [], "active": null })]);
        assert_eq!(migrated(Some(windows), Some(JsonValue::String("/docs".into())), None), None);
    }

    #[test]
    fn an_install_with_nothing_to_migrate_seeds_nothing() {
        assert_eq!(migrated(None, None, None), None);
    }

    #[test]
    fn the_main_geometry_moves_onto_the_first_restored_label() {
        let states = serde_json::json!({ "main": { "width": 900 } });
        let renamed = with_main_renamed(states, "w1").expect("main should have moved");
        assert_eq!(renamed, serde_json::json!({ "w1": { "width": 900 } }));
    }

    #[test]
    fn a_state_file_with_no_main_entry_is_left_alone() {
        let states = serde_json::json!({ "w1": { "width": 900 } });
        assert_eq!(with_main_renamed(states, "w1"), None);
    }

    /// Geometry a window really had beats geometry a label that can no longer
    /// exist remembers — and `main` goes all the same, since nothing will ever
    /// claim it again and the plugin would write it back at every exit.
    #[test]
    fn a_label_that_already_has_geometry_keeps_it_and_main_goes_anyway() {
        let states = serde_json::json!({ "main": { "width": 900 }, "w1": { "width": 500 } });
        let renamed = with_main_renamed(states, "w1").expect("main should have been dropped");
        assert_eq!(renamed, serde_json::json!({ "w1": { "width": 500 } }));
    }
}
