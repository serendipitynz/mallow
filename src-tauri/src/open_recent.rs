//! What choosing a recent folder does, for both entries that offer one.
//!
//! The Open Recent submenu and the in-app list ask the same question and take
//! the same four answers; only where the new-window modifier comes from differs.
//! The submenu has to ask the OS one event-loop turn after the click
//! (`crate::modifier`), while a DOM click event carries it outright — which is
//! why the in-app list ships whatever the platform read turns out to be worth
//! (TASK-12.5).
//!
//! **The decision is a pure function and the effects are not.** `recent_choice`
//! takes the three facts and answers what to do; `act_on_recent` is what reads
//! those facts and carries the answer out.

use serde::Serialize;
use tauri::{AppHandle, Manager, Window};

use crate::window::InitialLocation;

/// The payload of `menu:recent-missing`: which entry was chosen, and why it did
/// not open.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingRecent {
    pub folder: String,
    pub gone: bool,
}

/// What choosing a recent folder resolves to.
///
/// `Missing` is **the entry the reader clicked**, not an entry the submenu
/// silently dropped while it was being built: those never reach the screen
/// (`recent::pruned_folders`), so nothing has to be said about them. This one was
/// on screen and was chosen, so it is reported — and it says which of the two
/// reasons applies, because the reader is told one of them and only one of them
/// is ever true. A list the reader emptied in another window leaves entries on
/// screen that are perfectly present on disk, so a single wording would be a
/// false sentence half the time.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RecentChoice {
    /// The entry is no longer in the list. `gone` separates the folder having
    /// been removed from disk — the race this branch exists for — from the list
    /// having been emptied or rewritten under a list already on screen.
    Missing { gone: bool },
    /// Replace the asking window's folder. The window does this itself — the
    /// tree, the media grant and the watch are all frontend state.
    Replace,
    /// A window is already showing it, and has been focused rather than
    /// duplicated.
    Focused { label: String },
    /// A window is being opened on it.
    Opened,
}

/// What choosing a recent folder does, given what is true when it is chosen.
///
/// `showing` is the label of a window already displaying the folder, which makes
/// the new-window branch focus rather than duplicate — **including when that
/// window is the one that asked**, since opening a second window on the folder in
/// front of you is the duplicate the rule exists to prevent.
///
/// `has_focused_window` false sends a replace to the new-window branch instead of
/// dropping it: there is no window to replace the folder in, and a menu event
/// that resolves to nothing is worse than one that opens a window.
pub fn recent_choice(
    listed: bool,
    exists: bool,
    new_window: bool,
    showing: Option<String>,
    has_focused_window: bool,
) -> RecentChoice {
    if !listed {
        return RecentChoice::Missing { gone: !exists };
    }
    if !new_window && has_focused_window {
        return RecentChoice::Replace;
    }
    match showing {
        Some(label) => RecentChoice::Focused { label },
        None => RecentChoice::Opened,
    }
}

/// Resolve the choice and carry out the half that belongs to Rust.
///
/// **Nothing here builds a window inline.** This is reached from the menu event
/// handler, which tauri-2.11.3 names alongside a synchronous command as a place
/// `WebviewWindowBuilder::from_config` deadlocks (`src/webview/webview_window.rs:114-116`,
/// wry#583), so the creation is handed to the async runtime — the same shape New
/// Window already takes.
pub fn act_on_recent(app: &AppHandle, folder: &str, new_window: bool, spawner: Option<Window>) -> RecentChoice {
    let exists = std::path::Path::new(folder).is_dir();
    let listed = match crate::recent::pruned_folders(app) {
        Ok(folders) => folders.iter().any(|known| known == folder),
        Err(e) => {
            eprintln!("mallow: a recent folder could not be resolved ({e})");
            return RecentChoice::Missing { gone: !exists };
        }
    };
    let choice = recent_choice(
        listed,
        exists,
        new_window,
        crate::session::window_showing(app, folder),
        crate::menu::focused_window(app).is_some(),
    );
    match &choice {
        // The submenu is what carries the prune to the screen, and the caller is
        // what tells the reader the entry they chose is gone.
        RecentChoice::Missing { .. } => crate::menu::refresh_recent(app),
        RecentChoice::Focused { label } => {
            if let Some(window) = app.get_webview_window(label) {
                if let Err(e) = window.set_focus() {
                    eprintln!("mallow: the window already showing that folder could not be focused ({e})");
                }
            }
        }
        RecentChoice::Opened => {
            let app = app.clone();
            let location = InitialLocation { folder: folder.to_string(), file: None };
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::window::create_window(&app, Some(location), None, spawner) {
                    eprintln!("mallow: Open Recent could not open a window ({e})");
                }
            });
        }
        RecentChoice::Replace => {}
    }
    choice
}

/// Choose a recent folder from the in-app list.
///
/// **`async` for the reason `open_window` is**, since the answer can build a
/// window. `Replace` comes back to the window that asked, which is where the tree
/// lives; the other three are done by the time this returns — except the window
/// creation, which is in flight.
#[tauri::command]
pub async fn choose_recent(app: AppHandle, window: Window, folder: String, new_window: bool) -> RecentChoice {
    act_on_recent(&app, &folder, new_window, Some(window))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn showing(label: &str) -> Option<String> {
        Some(label.to_string())
    }

    #[test]
    fn an_entry_no_longer_in_the_list_is_missing_whatever_else_is_true() {
        assert_eq!(recent_choice(false, false, false, None, true), RecentChoice::Missing { gone: true });
        assert_eq!(recent_choice(false, false, true, showing("w2"), true), RecentChoice::Missing { gone: true });
    }

    /// The folder is still on disk, so the list was emptied or rewritten while
    /// this one was on screen. The reader is told that rather than that their
    /// folder disappeared.
    #[test]
    fn an_entry_dropped_from_a_list_whose_folder_is_still_there_says_so() {
        assert_eq!(recent_choice(false, true, false, None, true), RecentChoice::Missing { gone: false });
    }

    #[test]
    fn without_the_modifier_the_focused_window_takes_the_folder() {
        assert_eq!(recent_choice(true, true, false, None, true), RecentChoice::Replace);
    }

    /// The replace branch replaces the window in front of the reader, so a
    /// window elsewhere already showing the folder changes nothing about it.
    #[test]
    fn a_window_already_showing_it_does_not_divert_the_replace_branch() {
        assert_eq!(recent_choice(true, true, false, showing("w2"), true), RecentChoice::Replace);
    }

    #[test]
    fn with_the_modifier_a_folder_nothing_shows_opens_a_window() {
        assert_eq!(recent_choice(true, true, true, None, true), RecentChoice::Opened);
    }

    #[test]
    fn with_the_modifier_a_folder_already_shown_focuses_that_window() {
        assert_eq!(recent_choice(true, true, true, showing("w2"), true), RecentChoice::Focused { label: "w2".into() });
    }

    /// Reachable only if mallow ever stays alive with no window (TASK-12.2 keeps
    /// the exit-on-last-close default), and the event still has to resolve to
    /// something rather than being dropped.
    #[test]
    fn with_no_window_to_replace_in_the_choice_falls_through_to_opening_one() {
        assert_eq!(recent_choice(true, true, false, None, false), RecentChoice::Opened);
        assert_eq!(
            recent_choice(true, true, false, showing("w2"), false),
            RecentChoice::Focused { label: "w2".into() }
        );
    }
}
