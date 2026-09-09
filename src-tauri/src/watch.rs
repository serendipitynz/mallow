//! Per-window recursive filesystem watcher. Emits a `fs:change` event (a list of
//! changed paths) to the window that asked for the watch, which debounces and
//! reacts (re-render / tree refresh).

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{Emitter, Manager, State, Window};

/// The watcher registry: one live watch handle per window label.
///
/// Generic over the handle so the registry's insert / replace / remove semantics
/// can be tested with a handle whose drop is observable. Dropping a handle is
/// what stops a watch, and a `RecommendedWatcher` cannot report that it was
/// dropped — a temp-dir test would show that a path is no longer reported, which
/// is a weaker claim about a slower test.
pub struct WatcherRegistry<W>(Mutex<HashMap<String, W>>);

/// Not derived: `#[derive(Default)]` would demand `W: Default`, which a watch
/// handle has no reason to satisfy.
impl<W> Default for WatcherRegistry<W> {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

impl<W> WatcherRegistry<W> {
    fn set(&self, label: &str, watcher: W) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(label.to_string(), watcher);
        Ok(())
    }

    fn remove(&self, label: &str) -> Result<(), String> {
        self.0.lock().map_err(|e| e.to_string())?.remove(label);
        Ok(())
    }
}

/// What the app manages: the registry holding real watch handles.
pub type WatcherState = WatcherRegistry<RecommendedWatcher>;

/// Watch `path` recursively for the calling window, replacing only that window's
/// previous watch.
#[tauri::command]
pub fn start_watch(path: String, window: Window, state: State<WatcherState>) -> Result<(), String> {
    let label = window.label().to_string();
    let app_handle = window.app_handle().clone();
    let target = label.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let paths: Vec<String> = event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
            if !paths.is_empty() {
                // `emit` would reach every window, and two windows on overlapping
                // folders (a parent and its subfolder) is a real case. The frontend
                // half of this is a window-scoped listener — a plain `listen()`
                // registers `EventTarget::Any`, which matches whatever the emitter
                // filtered on, so the filter here isolates nothing on its own.
                let _ = app_handle.emit_to(target.as_str(), "fs:change", paths);
            }
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state.set(&label, watcher)
}

/// Stop the calling window's watch, leaving every other window's alive.
#[tauri::command]
pub fn stop_watch(window: Window, state: State<WatcherState>) -> Result<(), String> {
    state.remove(window.label())
}

/// Drop a destroyed window's watch. Registered app-level in `lib.rs` rather than
/// per window at creation time, so the configured launch window and the windows
/// created later are covered by the same code path.
pub fn drop_window_watch(window: &Window) {
    let _ = window.state::<WatcherState>().remove(window.label());
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::{channel, Receiver, Sender};

    /// A watch handle that reports its own drop, which is what a stopped watch
    /// looks like from the registry's side.
    struct Probe {
        id: &'static str,
        dropped: Sender<&'static str>,
    }

    impl Drop for Probe {
        fn drop(&mut self) {
            let _ = self.dropped.send(self.id);
        }
    }

    fn probes() -> (Sender<&'static str>, Receiver<&'static str>) {
        channel()
    }

    fn labels(registry: &WatcherRegistry<Probe>) -> Vec<String> {
        let mut labels: Vec<String> = registry.0.lock().unwrap().keys().cloned().collect();
        labels.sort();
        labels
    }

    fn stopped(rx: &Receiver<&'static str>) -> Vec<&'static str> {
        rx.try_iter().collect()
    }

    #[test]
    fn a_second_window_does_not_take_over_the_first_windows_entry() {
        let (tx, rx) = probes();
        let registry: WatcherRegistry<Probe> = WatcherRegistry::default();

        registry
            .set("main", Probe { id: "main-1", dropped: tx.clone() })
            .unwrap();
        registry.set("w1", Probe { id: "w1-1", dropped: tx.clone() }).unwrap();

        assert_eq!(labels(&registry), vec!["main", "w1"]);
        assert!(stopped(&rx).is_empty(), "opening a second window stopped an existing watch");
    }

    #[test]
    fn replacing_an_entry_stops_that_windows_previous_watch_only() {
        let (tx, rx) = probes();
        let registry: WatcherRegistry<Probe> = WatcherRegistry::default();

        registry
            .set("main", Probe { id: "main-1", dropped: tx.clone() })
            .unwrap();
        registry.set("w1", Probe { id: "w1-1", dropped: tx.clone() }).unwrap();
        registry
            .set("main", Probe { id: "main-2", dropped: tx.clone() })
            .unwrap();

        assert_eq!(stopped(&rx), vec!["main-1"]);
        assert_eq!(labels(&registry), vec!["main", "w1"]);
    }

    #[test]
    fn removing_one_windows_entry_leaves_the_others_watching() {
        let (tx, rx) = probes();
        let registry: WatcherRegistry<Probe> = WatcherRegistry::default();

        registry
            .set("main", Probe { id: "main-1", dropped: tx.clone() })
            .unwrap();
        registry.set("w1", Probe { id: "w1-1", dropped: tx.clone() }).unwrap();
        registry.remove("main").unwrap();

        assert_eq!(stopped(&rx), vec!["main-1"]);
        assert_eq!(labels(&registry), vec!["w1"]);
    }

    /// A window destroyed before it ever opened a folder, and `stop_watch`
    /// arriving after the window-destroyed hook already cleared the entry.
    #[test]
    fn removing_an_absent_entry_is_not_an_error() {
        let (tx, rx) = probes();
        let registry: WatcherRegistry<Probe> = WatcherRegistry::default();

        registry.set("w1", Probe { id: "w1-1", dropped: tx.clone() }).unwrap();
        registry.remove("w2").unwrap();
        registry.remove("w1").unwrap();
        registry.remove("w1").unwrap();

        assert_eq!(stopped(&rx), vec!["w1-1"]);
        assert!(labels(&registry).is_empty());
    }
}
