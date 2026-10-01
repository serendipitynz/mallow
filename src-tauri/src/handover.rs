//! Locations the OS hands to mallow (TASK-38, decision-16).
//!
//! **Three routes, structurally different, and named apart for that reason**:
//! a command-line argument (a Windows or Linux file association, and any CLI
//! invocation), `RunEvent::Opened` (macOS only — tauri-2.11.3 compiles it on
//! `cfg(any(macos, ios, android))`, `src/app.rs:257-266`), and a drop onto a
//! window. The first two reach whichever window this module picks; a drop names
//! its window, so it is classified here and opened by that window itself.
//!
//! **What comes out of here goes through `openLocation`**, the one sequence the
//! picker and a created window already take — as a created window's initial
//! location (`WindowInitRegistry`), or as an item a live window takes from its
//! queue below. The tree, the `allow_media_dir` grant and the watch all hang off
//! that sequence, so a path that skipped it would open a window unable to render
//! its images or notice its edits.
//!
//! **An unattended build registers none of the three routes but still compiles
//! this module**, for `menu.rs`'s reason: the `paper` job is the only CI that
//! builds Rust on Windows and macOS, and it builds unattended.
#![cfg_attr(unattended, allow(dead_code))]

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, Url, Window};

use crate::session::HandoverTarget;
use crate::window::InitialLocation;

/// What one handed path resolves to. The three refusals are reported to the
/// reader rather than opened as an empty window with no explanation.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Handed {
    /// A folder, or a file of a kind mallow opens inside its own folder.
    Open {
        folder: String,
        file: Option<String>,
    },
    Missing {
        path: String,
    },
    /// A file whose extension maps to no kind — the tree would not list it, so
    /// opening its folder would show a document the reader cannot find in it.
    Unsupported {
        path: String,
    },
    /// `RunEvent::Opened` carries URLs, and only a `file:` one names a path.
    NotAFile {
        url: String,
    },
}

/// What the filesystem says about a handed path, separated from the
/// classification so that can be tested without one.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Found {
    Folder,
    File,
    Absent,
}

/// What a handed path opens. **A file opens its own folder**: a window carries
/// one folder (decision-4), and a document selected outside the tree it sits in
/// would have no row to show it by.
pub fn classify(path: &Path, found: Found) -> Handed {
    let shown = path.to_string_lossy().to_string();
    match found {
        Found::Absent => Handed::Missing { path: shown },
        Found::Folder => Handed::Open { folder: shown, file: None },
        Found::File => {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            match (crate::commands::file_kind(&name), path.parent()) {
                (Some(_), Some(folder)) => {
                    Handed::Open { folder: folder.to_string_lossy().to_string(), file: Some(shown) }
                }
                _ => Handed::Unsupported { path: shown },
            }
        }
    }
}

/// `arg` made absolute against `cwd`, with `.`, `..` and a trailing separator
/// folded away.
///
/// **Folded lexically and not canonicalized**, because the result is compared as
/// a string: `session.rs` decides "a window already shows this folder" by exact
/// match, the rule `recentFolders` records under, and the folder picker answers
/// an uncanonicalized path. Resolving a symlink here would make a handed folder
/// miss the window showing it under the name the reader opened it by.
pub fn resolve(arg: &str, cwd: &Path) -> PathBuf {
    let mut folded = PathBuf::new();
    for component in cwd.join(arg).components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if matches!(folded.components().next_back(), Some(Component::Normal(_))) {
                    folded.pop();
                }
            }
            other => folded.push(other),
        }
    }
    folded
}

fn inspect(path: &Path) -> Handed {
    let found = match std::fs::metadata(path) {
        Ok(meta) if meta.is_dir() => Found::Folder,
        Ok(_) => Found::File,
        Err(_) => Found::Absent,
    };
    classify(path, found)
}

/// The paths in a process's argv, skipping the binary and anything shaped like a
/// flag.
///
/// Flags are skipped rather than refused because the OS and launchers add their
/// own — an older macOS passed `-psn_…` to a Finder launch — and reporting one as
/// a missing file would blame the reader for something they never typed.
pub fn paths_in_args(args: &[String]) -> impl Iterator<Item = &str> {
    args.iter()
        .skip(1)
        .map(String::as_str)
        .filter(|arg| !arg.starts_with('-'))
}

fn from_args(args: &[String], cwd: &Path) -> Vec<Handed> {
    paths_in_args(args).map(|arg| inspect(&resolve(arg, cwd))).collect()
}

/// Compiled everywhere though only macOS calls it, so its tests run on all three.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn from_urls(urls: &[Url]) -> Vec<Handed> {
    urls.iter()
        .map(|url| match url.to_file_path() {
            Ok(path) if url.scheme() == "file" => inspect(&path),
            _ => Handed::NotAFile { url: url.to_string() },
        })
        .collect()
}

#[derive(Default)]
struct Handover {
    /// Whether the launch has created its windows. Until then nothing is routed.
    ready: bool,
    /// What arrived before that.
    early: Vec<Handed>,
    /// label → items that window is to take, in arrival order.
    queued: HashMap<String, Vec<Handed>>,
}

/// Holds what arrives before the launch is ready, and what each live window has
/// still to take.
///
/// **Arrival is held until the restored windows exist**, because both of the
/// earliest routes can beat them. `setup` runs at `RunEvent::Ready`
/// (tauri-2.11.3 `src/app.rs:1423-1425`); a forwarded relaunch is served from the
/// single-instance plugin's own setup, which runs before that closure; and
/// whether AppKit delivers a cold launch's `Opened` before or after
/// `applicationDidFinishLaunching` is not something this code should have to
/// know. Routed early, an item would find no window showing its folder, create
/// one under the lowest free label — and the restore would then reserve that same
/// label by name and fail to build it.
///
/// **A live window takes its items rather than being sent them**: a restored
/// window may not have mounted yet, and an event emitted to a window that is not
/// listening is lost. The event below only says "take now", so taking is the
/// same call whether it is the mount or the event that asks.
#[derive(Default)]
pub struct HandoverState(Mutex<Handover>);

/// Serializes routing, so two deliveries cannot each find no window showing a
/// folder and open two. Held only over synchronous code.
#[derive(Default)]
pub struct RouteLock(Mutex<()>);

/// Route `items`, or hold them until the launch is ready.
fn deliver(app: &AppHandle, items: Vec<Handed>) {
    if items.is_empty() {
        return;
    }
    {
        let state = app.state::<HandoverState>();
        let Ok(mut handover) = state.0.lock() else {
            return;
        };
        if !handover.ready {
            handover.early.extend(items);
            return;
        }
    }
    spawn_route(app, items);
}

/// **Never route inline.** Creating a window deadlocks on Windows when reached
/// from a WebView2 handler or an event handler (tauri-2.11.3
/// `src/webview/webview_window.rs:114-116`, wry#583), and the single-instance
/// callback runs inside a window procedure there — `WM_COPYDATA`.
fn spawn_route(app: &AppHandle, items: Vec<Handed>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move { route(&app, items) });
}

fn route(app: &AppHandle, items: Vec<Handed>) {
    let lock = app.state::<RouteLock>();
    let _held = lock.0.lock();
    for item in items {
        match item {
            Handed::Open { folder, file } => open(app, folder, file),
            refused => report(app, refused),
        }
    }
}

/// Open a handed location by the rule Open Recent's new-window branch already
/// follows: **a window already showing the folder is brought forward rather than
/// duplicated**, and the location then opens there. Before a window is created,
/// one showing nothing is used — a first launch puts exactly that on screen, and
/// a double-click should not leave it beside the window it asked for.
///
/// **Never the focused window's folder**: nothing about these routes points at a
/// window, so replacing what the reader has in front of them would be a guess.
///
/// **The chosen window is claimed as it is chosen** (`session.rs`'s
/// `claim_window_for_handover`), so the choice holds for the next item and the
/// next delivery until the window reports the folder.
fn open(app: &AppHandle, folder: String, file: Option<String>) {
    match crate::session::claim_window_for_handover(app, &folder) {
        HandoverTarget::Showing(label) | HandoverTarget::Empty(label) => {
            enqueue(app, &label, Handed::Open { folder, file });
            bring_forward(app, &label);
        }
        HandoverTarget::New => {
            if let Err(e) = crate::window::create_window(app, Some(InitialLocation { folder, file }), None, None) {
                eprintln!("mallow: a handed location could not be opened in a window ({e})");
            }
        }
    }
}

/// Tell the reader what could not be opened, in the window they are most likely
/// looking at — and in a window of its own when there is none, so the report is
/// never dropped for want of somewhere to show it.
fn report(app: &AppHandle, refused: Handed) {
    let target = crate::menu::focused_window(app)
        .map(|window| window.label().to_string())
        .or_else(|| crate::session::most_recent_window(app));
    let label = match target {
        Some(label) => label,
        None => match crate::window::create_window(app, None, None, None) {
            Ok(label) => label,
            Err(e) => {
                eprintln!("mallow: no window could be opened to report a handed path ({e})");
                return;
            }
        },
    };
    enqueue(app, &label, refused);
    bring_forward(app, &label);
}

fn enqueue(app: &AppHandle, label: &str, item: Handed) {
    let state = app.state::<HandoverState>();
    if let Ok(mut handover) = state.0.lock() {
        handover.queued.entry(label.to_string()).or_default().push(item);
    }
    if let Err(e) = app.emit_to(label, "handover:queued", ()) {
        eprintln!("mallow: a window could not be told it was handed a location ({e})");
    }
}

fn bring_forward(app: &AppHandle, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    if let Err(e) = window.set_focus() {
        eprintln!("mallow: the window handed a location could not be focused ({e})");
    }
}

/// Mark the launch ready and route what this process was started with, together
/// with anything that arrived before it was ready. Called once the restored
/// windows exist.
pub fn open_handed_at_launch(app: &AppHandle) {
    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut items = {
        let state = app.state::<HandoverState>();
        let Ok(mut handover) = state.0.lock() else {
            return;
        };
        handover.ready = true;
        std::mem::take(&mut handover.early)
    };
    items.extend(from_args(&args, &cwd));
    if !items.is_empty() {
        spawn_route(app, items);
    }
}

/// A second launch, forwarded here by tauri-plugin-single-instance with its argv
/// and its working directory. **The relaunched process has already exited**, and
/// touched neither settings.json nor the window-state file on the way: the plugin
/// is registered first, so its setup ends the process before any other plugin's
/// setup runs.
///
/// A relaunch carrying no path — the Start menu, the dock, a launcher — brings the
/// most recent window forward, which is what a second launch of a single-instance
/// app is expected to do.
pub fn relaunched(app: &AppHandle, args: Vec<String>, cwd: String) {
    let items = from_args(&args, Path::new(&cwd));
    if !items.is_empty() {
        deliver(app, items);
        return;
    }
    // Before the launch is ready the restore is about to put windows up anyway,
    // and creating one now would take a label it is about to reserve by name.
    let ready = app.state::<HandoverState>().0.lock().map(|h| h.ready).unwrap_or(false);
    if !ready {
        return;
    }
    let target = crate::menu::focused_window(app)
        .map(|window| window.label().to_string())
        .or_else(|| crate::session::most_recent_window(app));
    match target {
        Some(label) => bring_forward(app, &label),
        None => spawn_empty_window(app),
    }
}

fn spawn_empty_window(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = crate::window::create_window(&app, None, None, None) {
            eprintln!("mallow: a relaunch could not open a window ({e})");
        }
    });
}

/// macOS's route: Finder's double-click and Open With, and `open -a mallow`.
#[cfg(target_os = "macos")]
pub fn opened(app: &AppHandle, urls: &[Url]) {
    deliver(app, from_urls(urls));
}

/// Take what this window has been handed. Answers each item once.
#[tauri::command]
pub fn take_handover(window: Window, state: State<HandoverState>) -> Result<Vec<Handed>, String> {
    let mut handover = state.0.lock().map_err(|e| e.to_string())?;
    Ok(handover.queued.remove(window.label()).unwrap_or_default())
}

/// Classify a path dropped onto a window. The window opens it itself: a drop
/// names the window it is meant for, which neither of the other routes does.
#[tauri::command]
pub fn inspect_dropped(path: String) -> Handed {
    inspect(Path::new(&path))
}

/// Drop a destroyed window's untaken items, so its label carries nothing over to
/// the next window handed that slot.
pub fn drop_window_queue(window: &Window) {
    if let Some(state) = window.try_state::<HandoverState>() {
        if let Ok(mut handover) = state.0.lock() {
            handover.queued.remove(window.label());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[cfg(unix)]
    #[test]
    fn a_relative_argument_resolves_against_the_working_directory() {
        let cwd = Path::new("/home/reader/notes");
        assert_eq!(resolve("todo.md", cwd), PathBuf::from("/home/reader/notes/todo.md"));
        assert_eq!(resolve("./a/../todo.md", cwd), PathBuf::from("/home/reader/notes/todo.md"));
        assert_eq!(resolve("../other", cwd), PathBuf::from("/home/reader/other"));
        assert_eq!(resolve("/abs/x.md", cwd), PathBuf::from("/abs/x.md"));
    }

    /// The trailing separator is what a shell's completion leaves on a folder, and
    /// it would otherwise miss the window showing that folder under the picker's
    /// spelling.
    #[cfg(unix)]
    #[test]
    fn a_trailing_separator_is_folded_away() {
        assert_eq!(resolve("docs/", Path::new("/r")), PathBuf::from("/r/docs"));
    }

    #[cfg(unix)]
    #[test]
    fn climbing_past_the_root_stops_there() {
        assert_eq!(resolve("../../x", Path::new("/a")), PathBuf::from("/x"));
    }

    #[cfg(windows)]
    #[test]
    fn a_relative_argument_resolves_against_the_working_directory() {
        let cwd = Path::new(r"C:\Users\reader\notes");
        assert_eq!(resolve(r"..\todo.md", cwd), PathBuf::from(r"C:\Users\reader\todo.md"));
        assert_eq!(resolve(r"D:\x.md", cwd), PathBuf::from(r"D:\x.md"));
    }

    #[test]
    fn the_binary_and_flags_are_not_paths() {
        let argv = args(&["/usr/bin/mallow", "-psn_0_1234", "a.md", "--flag", "b"]);
        assert_eq!(paths_in_args(&argv).collect::<Vec<_>>(), vec!["a.md", "b"]);
        assert_eq!(paths_in_args(&args(&["mallow"])).count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn a_folder_opens_as_itself() {
        assert_eq!(
            classify(Path::new("/r/docs"), Found::Folder),
            Handed::Open { folder: "/r/docs".into(), file: None }
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_file_mallow_opens_opens_its_folder_with_it_selected() {
        assert_eq!(
            classify(Path::new("/r/docs/readme.md"), Found::File),
            Handed::Open { folder: "/r/docs".into(), file: Some("/r/docs/readme.md".into()) }
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_file_of_no_kind_is_refused_rather_than_opened_unseen() {
        assert_eq!(
            classify(Path::new("/r/report.docx"), Found::File),
            Handed::Unsupported { path: "/r/report.docx".into() }
        );
        assert_eq!(classify(Path::new("/r/Makefile"), Found::File), Handed::Unsupported { path: "/r/Makefile".into() });
    }

    #[cfg(unix)]
    #[test]
    fn a_path_that_is_not_there_is_reported_missing() {
        assert_eq!(classify(Path::new("/r/gone.md"), Found::Absent), Handed::Missing { path: "/r/gone.md".into() });
    }

    #[test]
    fn a_url_that_names_no_file_is_refused() {
        let urls = [Url::parse("https://example.com/readme.md").unwrap()];
        assert_eq!(from_urls(&urls), vec![Handed::NotAFile { url: "https://example.com/readme.md".into() }]);
    }

    #[cfg(unix)]
    #[test]
    fn a_file_url_is_inspected_as_its_path() {
        let urls = [Url::parse("file:///nonexistent-mallow-test/readme.md").unwrap()];
        assert_eq!(from_urls(&urls), vec![Handed::Missing { path: "/nonexistent-mallow-test/readme.md".into() }]);
    }

    /// What the frontend switches on — `lib/handover` reads these field names.
    #[test]
    fn the_wire_shape_is_tagged_by_kind() {
        let open = serde_json::to_value(Handed::Open { folder: "/f".into(), file: None }).unwrap();
        assert_eq!(open, serde_json::json!({ "kind": "open", "folder": "/f", "file": null }));
        let refused = serde_json::to_value(Handed::NotAFile { url: "x:y".into() }).unwrap();
        assert_eq!(refused, serde_json::json!({ "kind": "notAFile", "url": "x:y" }));
    }
}
