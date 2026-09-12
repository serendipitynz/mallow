//! The native menu, composed per platform, and the routing of its events to the
//! window that is focused when one arrives.
//!
//! **The menu ships on all three desktop platforms but is not one menu with the
//! macOS `cfg` removed** (TASK-12 decision 1). `AppHandle::set_menu` is app-wide
//! and assigns the menu to any window not given one explicitly (tauri-2.11.3
//! `src/app.rs:956-961`), so dropping the gate would give Windows and Linux a
//! menu bar carrying About / Services / Hide / Show All — items that compile
//! everywhere and mean nothing there. Each platform gets its own composition
//! instead, and the differences are written beside the items that carry them.
//!
//! **muda's GTK backend supports only Separator, Copy, Cut, Paste, SelectAll and
//! About as predefined kinds** (muda-0.19.3 `src/platform_impl/gtk/mod.rs:30-49`)
//! and *silently skips* every other one on append rather than failing. So on Linux
//! anything else — Quit, Close Window, Minimize, Undo, Redo — has to be an
//! ordinary `MenuItem` with a handler of its own, or it is simply not there. The
//! failure mode is a missing entry, which only a look at a Linux build reveals.

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::menu::{MenuItem, MenuItemBuilder, Submenu};
// Only the building half is absent from an unattended build.
#[cfg(not(unattended))]
use tauri::menu::{Menu, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Window, Wry};

/// Fixed menu-item ids. A recent folder's id is **the folder path itself**, never
/// an index into the list: an index needs an id → path mapping kept in step with
/// every rebuild, and a stale mapping opens the wrong folder.
///
/// The two id spaces cannot collide, because a folder path from the dialog is
/// absolute — it begins with a separator or a drive letter — while every fixed id
/// below begins with a letter and carries no separator. `menu_action` resolves
/// the fixed ids first regardless, and what it hands back for anything else is
/// checked against the recent list before it is opened.
const NEW_WINDOW: &str = "file:new-window";
const OPEN: &str = "file:open";
const CLEAR_RECENT: &str = "recent:clear";
const PRINT: &str = "file:print";
const EXPORT_PDF: &str = "file:export-pdf";
const CLOSE_WINDOW: &str = "file:close-window";
const EXIT: &str = "file:exit";
/// Unprefixed because it predates this module and nothing is gained by churning
/// it; the event it sends is still `menu:settings`.
const SETTINGS: &str = "settings";

/// Whether `Print…` can ever be enabled on this platform.
///
/// **Linux is the one place a menu entry would show something that cannot
/// happen**: `print.rs` refuses there because the GTK dialog opens and never
/// returns, so an entry that looked enabled would be a press with no outcome and
/// no explanation. A `cfg` rather than a runtime platform test, for the reason
/// `print_window`'s own guard is one — it must not be able to fail open.
///
/// **`Export as PDF…` is deliberately not covered by this.** The two entries share
/// one gate on screen (`lib/markdown-preview`), but the platform veto belongs to
/// printing alone: on Linux the export is the *only* way a page leaves mallow.
#[cfg(target_os = "linux")]
const PRINTING_IS_REACHABLE: bool = false;
#[cfg(not(target_os = "linux"))]
const PRINTING_IS_REACHABLE: bool = true;

/// What is shown in place of the recent folders when there are none. Disabled, so
/// it reads as the list being empty rather than as an entry that does nothing.
const NO_RECENT_TEXT: &str = "No Recent Folders";

/// The parts of the menu that change after it is built, plus what they change
/// from.
///
/// `previews` is **per window** because the menu is not: one menu bar serves
/// whichever window is focused on macOS, so `Print…` and `Export as PDF…` have to
/// show the focused window's answer and change as focus moves. A single boolean
/// would show whichever window last reported.
pub struct MenuState {
    recent: Submenu<Wry>,
    clear_recent: MenuItem<Wry>,
    print: MenuItem<Wry>,
    export_pdf: MenuItem<Wry>,
    /// window label → whether that window's active view is a markdown preview.
    previews: Mutex<HashMap<String, bool>>,
}

/// What a menu id asks for.
///
/// Pure and exhaustive so the routing can be tested without a menu: the branch
/// that matters is the fallback, which treats an unrecognised id as a recent
/// folder and is what AC #4's "the id is the path" costs.
#[derive(Debug, PartialEq, Eq)]
pub enum MenuAction {
    NewWindow,
    Open,
    OpenRecent(String),
    ClearRecent,
    Print,
    ExportPdf,
    Settings,
    CloseWindow,
    Exit,
}

pub fn menu_action(id: &str) -> MenuAction {
    match id {
        NEW_WINDOW => MenuAction::NewWindow,
        OPEN => MenuAction::Open,
        CLEAR_RECENT => MenuAction::ClearRecent,
        PRINT => MenuAction::Print,
        EXPORT_PDF => MenuAction::ExportPdf,
        SETTINGS => MenuAction::Settings,
        CLOSE_WINDOW => MenuAction::CloseWindow,
        EXIT => MenuAction::Exit,
        path => MenuAction::OpenRecent(path.to_string()),
    }
}

/// Whether `&` in a menu label marks the next character as a mnemonic. Win32 is
/// the one place it does — it underlines that character and draws no ampersand —
/// so a folder named `R&D` would otherwise show as `RD` there. AppKit draws the
/// text as given and GTK's mnemonic marker is `_`, so doubling it on those two
/// would put a second ampersand on screen.
#[cfg(windows)]
const AMPERSAND_IS_A_MNEMONIC: bool = true;
#[cfg(not(windows))]
const AMPERSAND_IS_A_MNEMONIC: bool = false;

/// The text a recent entry carries.
///
/// Two things happen to the path, and both are about how it is *displayed*, never
/// about what the id holds. The reader's home directory is abbreviated to `~`, so
/// a menu of ten absolute paths does not span the screen — and only when `home` is
/// a whole leading component, since `/Users/ann-marie` is not inside `/Users/ann`.
/// And where `&` is a mnemonic marker it is doubled, which is muda's own advice
/// ("To display a `&` without assigning a mnemonic, use `&&`").
///
/// `mnemonics` is an argument rather than a `cfg` read inside, so both answers are
/// covered by a test on one machine.
fn recent_label(path: &str, home: Option<&str>, mnemonics: bool) -> String {
    let shortened = match home.filter(|home| !home.is_empty()).and_then(|home| {
        path.strip_prefix(home)
            .filter(|rest| rest.is_empty() || rest.starts_with('/') || rest.starts_with('\\'))
    }) {
        Some(rest) => format!("~{rest}"),
        None => path.to_string(),
    };
    if mnemonics {
        shortened.replace('&', "&&")
    } else {
        shortened
    }
}

fn home_dir() -> Option<String> {
    std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok()
}

/// The window a menu event acts on: the focused one.
///
/// **`webview_windows()` rather than `Manager::get_focused_window`**, which is
/// behind the `unstable` cargo feature this project does not enable and which
/// tauri documents as free to break in a minor release (tauri-2.11.3
/// `src/lib.rs:541-560`). Its implementation is this same scan.
pub fn focused_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false))
}

/// Send `event` to the focused window alone.
///
/// **This is the correction TASK-12 filed against `app.emit`**: the menu handler
/// used to broadcast `menu:settings`, which is harmless with one window and wrong
/// with several — every window opened its settings modal at once. The frontend
/// half is the other requirement, and neither works without it: a listener
/// registered with the plain `listen()` carries `EventTarget::Any`, which matches
/// whatever the emitter filtered on, so `App` listens through
/// `getCurrentWebviewWindow().listen` instead.
fn emit_focused<P: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: P) {
    let Some(window) = focused_window(app) else {
        return;
    };
    if let Err(e) = app.emit_to(window.label(), event, payload) {
        eprintln!("mallow: a menu event could not be delivered ({e})");
    }
}

/// Rebuild the Open Recent submenu from the stored list, pruning entries whose
/// folder has gone.
///
/// **This is the one prune site.** `recent.rs` deliberately does not prune on
/// read: the check touches the filesystem, so doing it here means it runs when the
/// list is about to be shown and nowhere else.
///
/// Failure is logged rather than propagated: a menu that could not be refreshed
/// must not be what stops a folder being recorded, and every caller reaches this
/// with its own job already done.
pub fn refresh_recent(app: &AppHandle) {
    let Some(state) = app.try_state::<MenuState>() else {
        return;
    };
    let folders = match crate::recent::pruned_folders(app) {
        Ok(folders) => folders,
        Err(e) => {
            eprintln!("mallow: the recent folders could not be read for the menu ({e})");
            return;
        }
    };
    if let Err(e) = fill_recent(app, &state, &folders) {
        eprintln!("mallow: the Open Recent submenu could not be rebuilt ({e})");
    }
}

/// Replace the submenu's items in place (`items` / `remove_at` / `append`), so
/// only Open Recent is touched and not the whole menu bar.
fn fill_recent(app: &AppHandle, state: &MenuState, folders: &[String]) -> tauri::Result<()> {
    // The count is read once rather than per iteration: every one of these calls
    // marshals to the main thread and waits for it (tauri-2.11.3
    // `src/menu/mod.rs:25-39`).
    let existing = state.recent.items()?.len();
    for _ in 0..existing {
        state.recent.remove_at(0)?;
    }

    let home = home_dir();
    if folders.is_empty() {
        let empty = MenuItemBuilder::new(NO_RECENT_TEXT).enabled(false).build(app)?;
        state.recent.append(&empty)?;
    }
    for folder in folders {
        let item =
            MenuItemBuilder::with_id(folder.as_str(), recent_label(folder, home.as_deref(), AMPERSAND_IS_A_MNEMONIC))
                .build(app)?;
        state.recent.append(&item)?;
    }
    state.clear_recent.set_enabled(!folders.is_empty())?;
    Ok(())
}

/// Record whether this window's active view is a markdown preview, and show the
/// answer on the two entries gated on it if this window is the focused one.
///
/// **The condition stays where it is measured.** `MarkdownView` publishes it to
/// `lib/markdown-preview`, which is what the two chords read; this is a second
/// reader of that same flag rather than a second definition of it, because the
/// menu lives in a process that cannot see the DOM.
///
/// **Answers `Ok` where there is no menu** rather than failing: an unattended
/// build renders the same markdown preview and builds no menu at all, and a
/// measurement run must not spend its output on an error per view change.
#[tauri::command]
pub fn report_markdown_preview(active: bool, window: Window) -> Result<(), String> {
    let app = window.app_handle();
    let Some(state) = app.try_state::<MenuState>() else {
        return Ok(());
    };
    state
        .previews
        .lock()
        .map_err(|e| e.to_string())?
        .insert(window.label().to_string(), active);
    apply_preview_gate(app);
    Ok(())
}

/// Enable or disable `Print…` and `Export as PDF…` from the focused window's
/// reported state.
pub fn apply_preview_gate(app: &AppHandle) {
    let Some(state) = app.try_state::<MenuState>() else {
        return;
    };
    let active = match (focused_window(app), state.previews.lock()) {
        (Some(window), Ok(previews)) => previews.get(window.label()).copied().unwrap_or(false),
        _ => false,
    };
    let _ = state.print.set_enabled(active && PRINTING_IS_REACHABLE);
    let _ = state.export_pdf.set_enabled(active);
}

/// Forget a destroyed window's reported state, and show whoever has focus now.
pub fn drop_window_gate(window: &Window) {
    let app = window.app_handle();
    let Some(state) = app.try_state::<MenuState>() else {
        return;
    };
    if let Ok(mut previews) = state.previews.lock() {
        previews.remove(window.label());
    }
    apply_preview_gate(app);
}

/// Route one menu event to the focused window.
///
/// **Nothing here builds a window inline.** tauri-2.11.3's
/// `WebviewWindowBuilder::from_config` deadlocks when reached from a synchronous
/// command *or from an event handler* (`src/webview/webview_window.rs:114-116`,
/// wry#583), and this is the handler the doc names alongside the commands
/// TASK-12.2 already moved off. New Window therefore hands off to the async
/// runtime; measured on Windows 2026-09-10, the inline form paints a white window
/// that cannot even be closed, while macOS and Linux are unaffected.
pub fn handle_event(app: &AppHandle, id: &str) {
    match menu_action(id) {
        MenuAction::NewWindow => {
            let app = app.clone();
            let spawner = focused_window(&app).map(|focused| focused.as_ref().window());
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::window::create_window(&app, None, None, spawner) {
                    eprintln!("mallow: New Window could not open a window ({e})");
                }
            });
        }
        // The picker, the print call and the export all belong to the window:
        // each needs a capability granted per window, a dialog parented to it, or
        // the frontend state the chord already reads. So the menu says what was
        // chosen and the focused window does it — which is also what keeps one
        // implementation behind both the chord and the item.
        MenuAction::Open => emit_focused(app, "menu:open", ()),
        MenuAction::Print => emit_focused(app, "menu:print", ()),
        MenuAction::ExportPdf => emit_focused(app, "menu:export-pdf", ()),
        MenuAction::Settings => emit_focused(app, "menu:settings", ()),
        MenuAction::ClearRecent => {
            if let Err(e) = crate::recent::clear_recent_list(app) {
                eprintln!("mallow: the recent folders could not be cleared ({e})");
            }
            refresh_recent(app);
        }
        // **Checked against the list rather than trusted.** The id is the folder
        // path, so an id this build did not put in the submenu would otherwise be
        // opened as one. What the check reads is the same list the submenu was
        // built from, which is not a mapping to keep in step.
        MenuAction::OpenRecent(path) => {
            match crate::recent::pruned_folders(app) {
                Ok(folders) if folders.iter().any(|folder| folder == &path) => {
                    emit_focused(app, "menu:open-recent", path);
                }
                Ok(_) => refresh_recent(app),
                Err(e) => eprintln!("mallow: a recent folder could not be resolved ({e})"),
            };
        }
        MenuAction::CloseWindow => {
            if let Some(window) = focused_window(app) {
                let _ = window.close();
            }
        }
        MenuAction::Exit => app.exit(0),
    }
}

/// Build the menu, set it app-wide, and keep what has to change afterwards.
///
/// Called from `setup` **before any window is created**, because a window takes
/// the app-wide menu at creation (tauri-2.11.3 `src/window/mod.rs:394-398`) and on
/// Windows and Linux the menu bar belongs to the window rather than to the
/// application.
///
/// Not compiled into an unattended build, which never calls it: everything else
/// here still is, because `recent.rs` refreshes the submenu whether or not one
/// exists and answers harmlessly when it does not.
#[cfg(not(unattended))]
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let new_window = MenuItemBuilder::with_id(NEW_WINDOW, "New Window")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open = MenuItemBuilder::with_id(OPEN, "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let recent = SubmenuBuilder::new(app, "Open Recent").build()?;
    let clear_recent = MenuItemBuilder::with_id(CLEAR_RECENT, "Clear Recent").build(app)?;
    // **Both start disabled and neither is ever enabled by the menu itself.** A
    // window has to report a markdown preview first, and at this point no window
    // exists at all.
    let print = MenuItemBuilder::with_id(PRINT, "Print…")
        .accelerator("CmdOrCtrl+P")
        .enabled(false)
        .build(app)?;
    let export_pdf = MenuItemBuilder::with_id(EXPORT_PDF, "Export as PDF…")
        .accelerator("CmdOrCtrl+E")
        .enabled(false)
        .build(app)?;
    let settings = MenuItemBuilder::with_id(SETTINGS, "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let about = tauri::menu::AboutMetadataBuilder::new()
        .name(Some("mallow"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        // Shown at the size the About dialog asks for, which is why the 2x asset
        // is the one included.
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/128x128@2x.png")).ok())
        .build();

    let (menu, window_menu) =
        compose(app, &new_window, &open, &recent, &clear_recent, &print, &export_pdf, &settings, about)?;
    app.set_menu(menu)?;
    register_windows_menu(window_menu)?;

    app.manage(MenuState { recent, clear_recent, print, export_pdf, previews: Mutex::new(HashMap::new()) });
    refresh_recent(app);
    Ok(())
}

/// Register the macOS Window submenu with AppKit, **after the menu is the
/// application's main menu and never before**.
///
/// muda resolves the NSMenu to register by going through
/// `NSApplication.mainMenu()` and its delegate (muda-0.19.3
/// `src/platform_impl/macos/mod.rs:741-746`), and **returns having done nothing**
/// when there is no main menu yet — so called while the menu was being composed
/// this would fail silently, and the Window menu would simply never list the open
/// windows.
#[cfg(all(not(unattended), target_os = "macos"))]
fn register_windows_menu(window_menu: Option<Submenu<Wry>>) -> tauri::Result<()> {
    if let Some(window_menu) = window_menu {
        window_menu.set_as_windows_menu_for_nsapp()?;
    }
    Ok(())
}

#[cfg(all(not(unattended), not(target_os = "macos")))]
fn register_windows_menu(_window_menu: Option<Submenu<Wry>>) -> tauri::Result<()> {
    Ok(())
}

/// The per-platform composition. Everything above is shared; what differs is
/// which submenus exist and which items are predefined.
///
/// The second half of the answer is the macOS Window submenu, handed back rather
/// than registered here — see `register_windows_menu` for why that ordering is
/// load-bearing. It is `None` on every other platform.
#[cfg(not(unattended))]
#[allow(clippy::too_many_arguments)]
fn compose(
    app: &AppHandle,
    new_window: &MenuItem<Wry>,
    open: &MenuItem<Wry>,
    recent: &Submenu<Wry>,
    clear_recent: &MenuItem<Wry>,
    print: &MenuItem<Wry>,
    export_pdf: &MenuItem<Wry>,
    settings: &MenuItem<Wry>,
    about: tauri::menu::AboutMetadata<'_>,
) -> tauri::Result<(Menu<Wry>, Option<Submenu<Wry>>)> {
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "mallow")
            .about(Some(about))
            .separator()
            .item(settings)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;

        // `close_window` is the predefined item here and an ordinary one
        // everywhere else: muda derives a predefined item's accelerator from its
        // type and offers no setter (muda-0.19.3 `src/items/predefined.rs:331-337`),
        // which is `CmdOrCtrl+W` on macOS and `Alt+F4` elsewhere. **decision-4
        // moves this binding to Close Tab once TASK-13.3 lands**, with Close
        // Window taking `CmdOrCtrl+Shift+W`; no predefined item can hold that, so
        // that task replaces this arm with the ordinary item the other two
        // platforms already use.
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(new_window)
            .item(open)
            .item(recent)
            .separator()
            .item(clear_recent)
            .separator()
            .item(print)
            .item(export_pdf)
            .separator()
            .close_window()
            .build()?;

        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .undo()
            .redo()
            .separator()
            .cut()
            .copy()
            .paste()
            .select_all()
            .build()?;

        // Registering the submenu with AppKit is what makes it list the open
        // windows; Minimize and Zoom are this menu's own items.
        let window_menu = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;

        let menu = tauri::menu::MenuBuilder::new(app)
            .item(&app_menu)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&window_menu)
            .build()?;
        Ok((menu, Some(window_menu)))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let close_window = MenuItemBuilder::with_id(CLOSE_WINDOW, "Close Window")
            .accelerator("CmdOrCtrl+W")
            .build(app)?;

        let mut file_menu = SubmenuBuilder::new(app, "File")
            .item(new_window)
            .item(open)
            .item(recent)
            .separator()
            .item(clear_recent)
            .separator()
            .item(print)
            .item(export_pdf)
            .separator()
            .item(settings)
            .separator()
            .item(&close_window);

        // Quit is one of the predefined kinds GTK skips, so on Linux it is an
        // ordinary item calling `AppHandle::exit`. On Windows the predefined one
        // renders as "E&xit" (muda-0.19.3 `src/items/predefined.rs:291`) and
        // carries the platform's own quit behaviour.
        #[cfg(target_os = "linux")]
        let exit = MenuItemBuilder::with_id(EXIT, "Exit").build(app)?;
        #[cfg(target_os = "linux")]
        {
            file_menu = file_menu.item(&exit);
        }
        #[cfg(not(target_os = "linux"))]
        {
            file_menu = file_menu.quit();
        }

        // **Undo and Redo are absent on Linux rather than broken there.** GTK
        // skips both on append, so listing them would build a menu whose two top
        // entries simply are not shown; and replacing them with ordinary items
        // would mean driving the WebView's own undo stack from Rust for an app
        // whose only editable field is in the settings modal. Cut / Copy / Paste /
        // Select All are in GTK's supported set and stay.
        #[cfg(target_os = "linux")]
        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .cut()
            .copy()
            .paste()
            .select_all()
            .build()?;
        #[cfg(not(target_os = "linux"))]
        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .undo()
            .redo()
            .separator()
            .cut()
            .copy()
            .paste()
            .select_all()
            .build()?;

        // About is in GTK's supported set, which is why Help needs no Linux arm.
        let help_menu = SubmenuBuilder::new(app, "Help").about(Some(about)).build()?;

        let menu = tauri::menu::MenuBuilder::new(app)
            .item(&file_menu.build()?)
            .item(&edit_menu)
            .item(&help_menu)
            .build()?;
        Ok((menu, None))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_fixed_id_resolves_to_its_own_action() {
        assert_eq!(menu_action(NEW_WINDOW), MenuAction::NewWindow);
        assert_eq!(menu_action(OPEN), MenuAction::Open);
        assert_eq!(menu_action(CLEAR_RECENT), MenuAction::ClearRecent);
        assert_eq!(menu_action(PRINT), MenuAction::Print);
        assert_eq!(menu_action(EXPORT_PDF), MenuAction::ExportPdf);
        assert_eq!(menu_action(SETTINGS), MenuAction::Settings);
        assert_eq!(menu_action(CLOSE_WINDOW), MenuAction::CloseWindow);
        assert_eq!(menu_action(EXIT), MenuAction::Exit);
    }

    /// The id a recent entry carries is the path, which is what makes this the
    /// fallback arm rather than a lookup.
    #[test]
    fn any_other_id_is_read_as_a_folder_path() {
        assert_eq!(menu_action("/Users/reader/notes"), MenuAction::OpenRecent("/Users/reader/notes".to_string()));
        assert_eq!(menu_action(r"C:\notes"), MenuAction::OpenRecent(r"C:\notes".to_string()));
    }

    /// A path from the folder dialog is absolute, and no fixed id is, so the two
    /// id spaces cannot meet.
    #[test]
    fn no_fixed_id_looks_like_an_absolute_path() {
        for id in [NEW_WINDOW, OPEN, CLEAR_RECENT, PRINT, EXPORT_PDF, SETTINGS, CLOSE_WINDOW, EXIT] {
            assert!(!id.starts_with('/') && !id.starts_with('\\') && !id.contains('/') && !id.contains('\\'));
        }
    }

    #[test]
    fn a_folder_under_home_is_shown_with_a_tilde() {
        assert_eq!(recent_label("/Users/reader/notes", Some("/Users/reader"), false), "~/notes");
        assert_eq!(recent_label("/Users/reader", Some("/Users/reader"), false), "~");
        assert_eq!(recent_label(r"C:\Users\reader\notes", Some(r"C:\Users\reader"), true), r"~\notes");
    }

    /// `/Users/ann-marie` is not inside `/Users/ann`, so a prefix match alone is
    /// wrong: the home has to end at a component boundary.
    #[test]
    fn a_folder_merely_starting_with_the_home_string_is_left_alone() {
        assert_eq!(recent_label("/Users/ann-marie/notes", Some("/Users/ann"), false), "/Users/ann-marie/notes");
    }

    #[test]
    fn a_folder_outside_home_keeps_its_path() {
        assert_eq!(recent_label("/srv/docs", Some("/Users/reader"), false), "/srv/docs");
        assert_eq!(recent_label("/srv/docs", None, false), "/srv/docs");
        assert_eq!(recent_label("/srv/docs", Some(""), false), "/srv/docs");
    }

    /// Win32 reads a single `&` as a mnemonic marker and does not draw it, so a
    /// folder named `R&D` would show as `RD` with the D underlined — and doubling
    /// it where nothing reads it that way would show two.
    #[test]
    fn an_ampersand_is_doubled_only_where_it_marks_a_mnemonic() {
        assert_eq!(recent_label("/srv/R&D", None, true), "/srv/R&&D");
        assert_eq!(recent_label("/Users/reader/R&D", Some("/Users/reader"), true), "~/R&&D");
        assert_eq!(recent_label("/srv/R&D", None, false), "/srv/R&D");
    }
}
