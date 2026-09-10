//! Creating windows, and handing each created window the location it opens at.
//!
//! One command builds a window (`open_window`); the created window asks for its
//! own initial location once, at mount (`take_window_init`). TASK-12's vocabulary
//! is defined in terms of that pair, which is why the location does not travel in
//! the URL the WebView loads.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, PhysicalPosition, State, WebviewWindow, WebviewWindowBuilder, Window};

/// How far a created window is moved when it would otherwise sit exactly on the
/// window that spawned it, in logical pixels.
const CASCADE_STEP_PX: f64 = 28.0;

/// What a created window opens at mount: a folder, and the file to select inside
/// it when the location carries one.
///
/// The file half becomes an ordered list plus which entry is active once one
/// window can hold several documents (TASK-13.4). Only what this carries changes
/// then; the deposit-and-take-once mechanism below does not.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct InitialLocation {
    pub folder: String,
    pub file: Option<String>,
}

/// What a created window was told at creation.
///
/// **A window created empty is not the same thing as a window nothing created**,
/// and flattening the two costs New Window its whole specification: with a folder
/// in the stored session, a window that reported "nothing was deposited" would
/// fall back to that session and open a duplicate of it. So the outer option says
/// whether this window was created by `open_window`, and `location` says whether
/// it was given somewhere to open.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct WindowInit {
    pub location: Option<InitialLocation>,
}

/// label → the location that window is to open, deposited when the label is
/// allocated and removed by that window's own `take_window_init`.
///
/// **A key is present from the moment a label is allocated, which is what
/// reserves the slot.** `webview_windows()` does not list a window until it is
/// built, so two creations in flight at once would otherwise be handed the same
/// `w<n>`. A window opened empty reserves too, with `None` for its value.
///
/// **The entry is taken exactly once, and a WebView reload is not a new window.**
/// After a devtools reload the entry is already consumed, so the window comes
/// back empty rather than reopening its location. That is the price of keeping
/// filesystem paths out of the URL the WebView loaded — a query string would
/// survive the reload, and would put arbitrary paths through URL encoding and
/// leave them visible in the loaded address.
#[derive(Default)]
pub struct WindowInitRegistry(Mutex<HashMap<String, Option<InitialLocation>>>);

impl WindowInitRegistry {
    /// Reserve the lowest `w<n>` that no live window holds and no creation in
    /// flight has claimed, and deposit `location` under it.
    ///
    /// **Slots are reused rather than counted upward**, and the consequence to
    /// accept is that a new window inherits the remembered geometry of whichever
    /// window last held its slot. A counter that climbed forever would avoid that
    /// and cost more: the window-state file and the restored session are both
    /// keyed by label, so both would grow with every window ever opened, and a
    /// restored window could not be handed back the geometry it had.
    fn reserve(&self, live: &HashSet<String>, location: Option<InitialLocation>) -> Result<String, String> {
        let mut pending = self.0.lock().map_err(|e| e.to_string())?;
        let label = free_label(live, &pending)?;
        pending.insert(label.clone(), location);
        Ok(label)
    }

    /// Deposit under a label chosen by the caller — the restore path, which has
    /// to put a window back under the label its geometry and its session entry
    /// are filed under.
    fn reserve_label(&self, label: &str, location: Option<InitialLocation>) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(label.to_string(), location);
        Ok(())
    }

    fn take(&self, label: &str) -> Result<Option<WindowInit>, String> {
        Ok(self
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .remove(label)
            .map(|location| WindowInit { location }))
    }

    fn discard(&self, label: &str) {
        if let Ok(mut pending) = self.0.lock() {
            pending.remove(label);
        }
    }
}

/// The lowest `w<n>` free of both sets. `main` is neither shape, so the
/// configured window never occupies a slot even while it still exists.
fn free_label(live: &HashSet<String>, pending: &HashMap<String, Option<InitialLocation>>) -> Result<String, String> {
    (1..=u32::MAX)
        .map(|n| format!("w{n}"))
        .find(|label| !live.contains(label) && !pending.contains_key(label))
        .ok_or_else(|| "no free window label".to_string())
}

/// Build one window carrying the configured window's own size, minimums and
/// title.
///
/// The configured window is **cloned and relabelled** rather than having its
/// fields copied across by hand. Enumerating width / height / minimums / title
/// happens to match `tauri.conf.json` today and stops matching silently the first
/// time a field is added there — and `title` is the one that bites, since the
/// builder's default is the application name while the frontend only sets a title
/// once a document is open.
fn build_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "the app config declares no window to copy".to_string())?;
    config.label = label.to_string();
    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())
}

/// Move `created` off `spawner` when the two ended up at the same position.
///
/// **Why a collision test and not "this slot has no remembered geometry":** that
/// condition cannot be asked for and stops being true almost immediately.
/// tauri-plugin-window-state keeps `WindowState` and `WindowStateCache` private,
/// inserts a default state for every label it sees at window-ready and writes the
/// whole cache out at exit — so a slot used once has an entry forever after, and a
/// check on it would offset only on a slot's first ever use.
///
/// **Why it reads a restored position rather than the pre-restore one:** ordering,
/// not thread affinity. The plugin restores from `on_window_ready`, which
/// `attach_window` posts through the same main-thread queue this closure is posted
/// to — and it posts it inside `build()` (tauri-2.11.3 `src/window/mod.rs:408-419`),
/// so it is queued first whichever thread `build()` was called on: both inline
/// when that is the main thread, both through the event proxy when it is not.
/// **That is what let `open_window` become `async` without this having to change.**
///
/// **It applies only to the interactive paths.** The restore path supplies its own
/// label and passes no spawner: it has none, and windows the user deliberately
/// stacked have to come back stacked.
fn offset_when_stacked_on(created: WebviewWindow, spawner: Window) {
    let dispatch = created.clone();
    let _ = dispatch.run_on_main_thread(move || {
        let (Ok(position), Ok(spawner_position)) = (created.outer_position(), spawner.outer_position()) else {
            return;
        };
        if position != spawner_position {
            return;
        }
        let step = (CASCADE_STEP_PX * created.scale_factor().unwrap_or(1.0)).round() as i32;
        let _ = created.set_position(PhysicalPosition { x: position.x + step, y: position.y + step });
    });
}

/// Create a window, and answer the label it was given.
///
/// Separate from the command so the restore path (TASK-12.7) can create windows
/// from Rust, where there is no calling window to be the spawner.
///
/// **Never call this from a synchronous command or from an event handler.**
/// On Windows `from_config` deadlocks there (tauri-2.11.3
/// `src/webview/webview_window.rs:114-116`, wry#583): WebView2 creation pumps the
/// message loop, and reached from inside a WebView2 handler that loop is already
/// on the stack — measured 2026-09-10, the created window painted white and could
/// not even be closed, while macOS and Linux were unaffected. `open_window` is
/// `async` for that reason and no other. **The `on_menu_event` handler TASK-12.4
/// adds is the next place this can be reintroduced**, since the doc names event
/// handlers alongside synchronous commands; hand off to
/// `tauri::async_runtime::spawn` there rather than building inline.
pub fn create_window(
    app: &AppHandle,
    location: Option<InitialLocation>,
    label: Option<String>,
    spawner: Option<Window>,
) -> Result<String, String> {
    let registry = app.state::<WindowInitRegistry>();
    let label = match label {
        Some(label) => {
            registry.reserve_label(&label, location)?;
            label
        }
        None => {
            let live: HashSet<String> = app.webview_windows().into_keys().collect();
            registry.reserve(&live, location)?
        }
    };

    match build_window(app, &label) {
        Ok(created) => {
            if let Some(spawner) = spawner {
                offset_when_stacked_on(created, spawner);
            }
            Ok(label)
        }
        Err(e) => {
            // Nothing will ever take this entry, and the slot has to stay free.
            registry.discard(&label);
            Err(e)
        }
    }
}

/// Create a window, optionally opening `location` at mount.
///
/// `location` absent opens an empty window, which is what New Window does: it
/// does not duplicate the calling window's folder, since a window opened to
/// compare against something is opened on a different folder.
///
/// `label` is absent for every caller but the restore path, which supplies one
/// (see `create_window`). It is part of the signature from the start so that path
/// does not have to change a command that has already been reviewed.
///
/// **`async` is load-bearing on Windows and is not about latency** — see
/// `create_window`. Being off the WebView2 handler also means two of these can be
/// in flight at once, which is what the label reservation in `reserve` is for.
#[tauri::command]
pub async fn open_window(
    app: AppHandle,
    window: Window,
    location: Option<InitialLocation>,
    label: Option<String>,
) -> Result<String, String> {
    create_window(&app, location, label, Some(window))
}

/// Take what this window was told at creation. Answers it once, and `null`
/// afterwards and for a window `open_window` did not create.
#[tauri::command]
pub fn take_window_init(window: Window, state: State<WindowInitRegistry>) -> Result<Option<WindowInit>, String> {
    state.take(window.label())
}

/// Drop a destroyed window's undelivered entry, so a window that never reached
/// its mount does not hold its slot for the rest of the session. Registered
/// app-level in `lib.rs` beside the watch cleanup, for the same reason.
pub fn drop_window_init(window: &Window) {
    window.state::<WindowInitRegistry>().discard(window.label());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn location(folder: &str) -> Option<InitialLocation> {
        Some(InitialLocation { folder: folder.to_string(), file: None })
    }

    fn live(labels: &[&str]) -> HashSet<String> {
        labels.iter().map(|l| l.to_string()).collect()
    }

    #[test]
    fn the_first_created_window_is_w1_beside_the_configured_main() {
        let registry = WindowInitRegistry::default();
        assert_eq!(registry.reserve(&live(&["main"]), None).unwrap(), "w1");
    }

    #[test]
    fn a_label_is_reserved_before_its_window_exists() {
        let registry = WindowInitRegistry::default();
        // `webview_windows()` lists neither yet: the reservation is what keeps two
        // creations in flight at once from being handed the same slot.
        assert_eq!(registry.reserve(&live(&["main"]), None).unwrap(), "w1");
        assert_eq!(registry.reserve(&live(&["main"]), None).unwrap(), "w2");
    }

    #[test]
    fn a_closed_windows_slot_is_reused_rather_than_a_new_one_allocated() {
        let registry = WindowInitRegistry::default();
        registry.take("w1").unwrap();
        registry.take("w2").unwrap();
        registry.take("w3").unwrap();
        // w2 was closed, so it is no longer live and no longer pending.
        assert_eq!(registry.reserve(&live(&["main", "w1", "w3"]), None).unwrap(), "w2");
    }

    #[test]
    fn an_initial_location_is_answered_once_and_then_gone() {
        let registry = WindowInitRegistry::default();
        let label = registry.reserve(&live(&["main"]), location("/docs")).unwrap();
        assert_eq!(registry.take(&label).unwrap(), Some(WindowInit { location: location("/docs") }));
        assert_eq!(registry.take(&label).unwrap(), None);
    }

    /// The distinction New Window rests on: a window created empty answers that it
    /// was created and given nowhere, where a window nothing created answers
    /// nothing at all. Flatten the two and an empty New Window falls back to the
    /// stored session and opens a duplicate of the last folder.
    #[test]
    fn a_window_created_empty_is_not_a_window_nothing_created() {
        let registry = WindowInitRegistry::default();
        let label = registry.reserve(&live(&["main"]), None).unwrap();
        assert_eq!(label, "w1");
        assert_eq!(registry.take(&label).unwrap(), Some(WindowInit { location: None }));
        assert_eq!(registry.take("main").unwrap(), None);
    }

    #[test]
    fn an_empty_window_frees_its_slot_once_it_has_taken_its_entry() {
        let registry = WindowInitRegistry::default();
        let label = registry.reserve(&live(&["main"]), None).unwrap();
        registry.take(&label).unwrap();
        assert_eq!(registry.reserve(&live(&["main"]), None).unwrap(), "w1");
    }

    #[test]
    fn the_restore_path_keeps_the_label_it_asked_for() {
        let registry = WindowInitRegistry::default();
        registry.reserve_label("w4", location("/notes")).unwrap();
        // The reservation still holds the slot against an interactive creation.
        assert_eq!(registry.reserve(&live(&[]), None).unwrap(), "w1");
        assert_eq!(registry.take("w4").unwrap(), Some(WindowInit { location: location("/notes") }));
    }

    #[test]
    fn a_window_that_failed_to_build_frees_its_slot_again() {
        let registry = WindowInitRegistry::default();
        let label = registry.reserve(&live(&["main"]), location("/docs")).unwrap();
        registry.discard(&label);
        assert_eq!(registry.reserve(&live(&["main"]), None).unwrap(), "w1");
    }
}
