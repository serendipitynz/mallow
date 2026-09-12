use tauri::Manager;

mod commands;
mod editors;
mod menu;
mod pdf;
mod print;
mod recent;
mod session;
mod settings;
#[cfg(unattended)]
mod unattended;
mod watch;
mod window;

/// The command list, written once. `invoke_handler` takes a value built by a
/// macro, so an unattended build cannot add its two commands without either this
/// or a second copy of every other command's path — and a copy is the thing this
/// repository has already been bitten by once (the extension→kind mapping).
macro_rules! app_handler {
    ($($extra:path),*) => {
        tauri::generate_handler![
            commands::read_dir_tree,
            commands::read_file,
            commands::path_exists,
            commands::allow_media_dir,
            watch::start_watch,
            watch::stop_watch,
            editors::detect_editors,
            editors::open_in_editor,
            editors::reveal_in_os,
            editors::open_in_default_app,
            print::print_window,
            pdf::write_window_pdf,
            window::open_window,
            window::take_window_init,
            recent::record_recent,
            recent::list_recent,
            recent::clear_recent,
            session::report_window_content,
            settings::broadcast_setting,
            menu::report_markdown_preview
            $(, $extra)*
        ]
    };
}

#[cfg(not(unattended))]
fn handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    app_handler!()
}

#[cfg(unattended)]
fn handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    app_handler!(unattended::unattended_request, unattended::unattended_finish)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(unattended)]
    let request = unattended::request_or_exit();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build());

    // **Registered between the store and the window state, and that is
    // load-bearing.** The restored session is read out of the store, so that
    // plugin has to be set up first; and the session's one-time geometry
    // migration rewrites tauri-plugin-window-state's file, which that plugin
    // loads whole in its own setup and writes back at exit — so a rewrite made
    // afterwards is simply overwritten. Plugin setups run in registration order.
    //
    // **An unattended build registers no session at all**: it must leave the
    // reader's settings where it found them, so it opens one window that no row
    // is ever written for.
    #[cfg(not(unattended))]
    let builder = builder.plugin(session::init());

    #[allow(clippy::let_and_return)]
    let builder = builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(watch::WatcherState::default())
        .manage(pdf::ExportLock::default())
        .manage(window::WindowInitRegistry::default())
        .manage(recent::RecentLock::default())
        .on_window_event(|window, event| match event {
            // A closed window must leave neither its watch running nor its
            // slot reserved by an initial location nothing will ever take, and
            // its row leaves the restored session under the last-window rule.
            tauri::WindowEvent::Destroyed => {
                watch::drop_window_watch(window);
                crate::window::drop_window_init(window);
                session::note_window_destroyed(window);
                menu::drop_window_gate(window);
            }
            // **The `true` edge only.** The restored session is ordered
            // least-recently-focused first, so reordering on the `false` edge
            // would invert it — the window losing focus would be the one moved
            // to the end.
            // One menu bar serves whichever window is focused, so the two
            // entries gated on the active view have to show the newly focused
            // window's answer rather than whichever window last reported one.
            tauri::WindowEvent::Focused(true) => {
                session::note_window_focused(window);
                menu::apply_preview_gate(window.app_handle());
            }
            _ => {}
        })
        // **Every menu event resolves its own target.** `MenuEvent` carries only
        // the item id (muda-0.19.3 `src/lib.rs:481-484`), and this used to
        // broadcast `menu:settings` with `app.emit` — harmless with one window and
        // wrong with several, since every window opened its settings modal at
        // once.
        .on_menu_event(|app, event| menu::handle_event(app, event.id().as_ref()))
        .setup(|app| {
            // **An unattended build gets no menu**, for the reason it registers no
            // session: it is a measurement instrument with nobody at the keyboard,
            // and on Windows and Linux a menu bar is part of the window it would
            // be measuring.
            #[cfg(not(unattended))]
            menu::init(app.handle())?;

            // **Every window is created here, restored or not.** The configured
            // window carries `"create": false`, so tauri creates none of its own
            // (`src/app.rs:2524` filters on that field) while the config stays the
            // one place the default size lives — and the label then comes from
            // here rather than being fixed at `main`, which is what lets a
            // restored window come back under the label its geometry and its
            // session row are filed under.
            //
            // After `set_menu` rather than before it: a window built afterwards
            // takes the app-wide menu at creation (tauri-2.11.3
            // `src/window/mod.rs:394-398`), and on macOS the menu is the
            // application's rather than any window's anyway.
            #[cfg(unattended)]
            window::create_window(app.handle(), None, None, None)?;
            #[cfg(not(unattended))]
            session::open_restored_windows(app.handle())?;

            Ok(())
        })
        .invoke_handler(handler());

    // The request is managed state rather than a global, so the command that
    // hands it to the frontend reads it the way every other command reads state.
    #[cfg(unattended)]
    let builder = builder.manage(request);

    builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            // The flush covers the quit paths that emit no destroy events at all
            // (macOS ⌘Q, a predefined Quit item, `AppHandle::exit`), which is
            // most of them.
            if matches!(event, tauri::RunEvent::Exit) {
                session::flush_at_exit(app);
            }
        });
}
