mod commands;
mod editors;
mod watch;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(watch::WatcherState::default())
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
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
