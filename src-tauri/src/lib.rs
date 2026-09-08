mod commands;
mod editors;
mod pdf;
mod print;
#[cfg(unattended)]
mod unattended;
mod watch;

use tauri::Emitter;

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
            pdf::write_window_pdf
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

    #[allow(clippy::let_and_return)]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(watch::WatcherState::default())
        .manage(pdf::ExportLock::default())
        .on_menu_event(|app, event| {
            // The frontend opens its settings modal in response to this event.
            if event.id().as_ref() == "settings" {
                let _ = app.emit("menu:settings", ());
            }
        })
        .setup(|app| {
            #[cfg(not(target_os = "macos"))]
            let _ = &app;

            // On macOS, provide a standard application menu with a Settings… item
            // (⌘,). Other platforms reach settings via the footer button.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};

                let handle = app.handle().clone();
                let settings_item = MenuItemBuilder::with_id("settings", "Settings…")
                    .accelerator("CmdOrCtrl+,")
                    .build(&handle)?;

                // Show a high-resolution mallow logo in the About dialog.
                let about_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128@2x.png")).ok();
                let about_metadata = AboutMetadataBuilder::new()
                    .name(Some("mallow"))
                    .version(Some(env!("CARGO_PKG_VERSION")))
                    .icon(about_icon)
                    .build();

                let app_menu = SubmenuBuilder::new(&handle, "mallow")
                    .about(Some(about_metadata))
                    .separator()
                    .item(&settings_item)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                let edit_menu = SubmenuBuilder::new(&handle, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let menu = MenuBuilder::new(&handle).item(&app_menu).item(&edit_menu).build()?;
                app.set_menu(menu)?;
            }

            Ok(())
        })
        .invoke_handler(handler());

    // The request is managed state rather than a global, so the command that
    // hands it to the frontend reads it the way every other command reads state.
    #[cfg(unattended)]
    let builder = builder.manage(request);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
