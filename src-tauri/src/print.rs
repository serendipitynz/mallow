//! The print call: hand the calling webview window to the platform's print UI.
//!
//! mallow draws no part of what appears. decision-13 sets the boundary — the
//! sheet, the preview or the dialog belongs to the OS or the WebView engine, and
//! its PDF destination is one of that UI's own entries rather than a mallow
//! feature.
//!
//! Named for the window rather than the document because that is what is
//! printed: the engine paginates the whole `<body>`, so the body worth printing
//! is only a part of what goes to paper. A print stylesheet changes what is
//! painted, not what is paginated, so the name would not become true later.
//!
//! One call, three routes, and `window.print()` is only the Windows one — wry
//! 0.55.1 builds an `NSPrintOperation` on macOS, evaluates `window.print()` on
//! Windows and runs GTK's `PrintOperation::run_dialog` on Linux. So a JS print
//! event cannot be assumed to fire, in the shape decision-9 established for
//! parent-registered listeners; anything needing the DOM rearranged before
//! printing must do it in the frontend before invoking this.
//!
//! **A returned `Ok(())` does not mean a print UI appeared.** macOS's route is
//! guarded by `respondsToSelector(printOperationWithPrintInfo:)` and returns
//! `Ok(())` having done nothing where that guard fails, Windows returns before
//! the JS it evaluated has run, and Linux opens its dialog with a `None` parent
//! so it need not even be in front of mallow.
//!
//! Not gated on `cfg(desktop)`, though `WebviewWindow::print` is: a `cfg` here
//! would drop the command from the handler and turn a mobile build into a
//! runtime "command not found", where leaving it out makes the same build fail
//! to compile.
//!
//! **Linux is refused outright, and the reason is that the call does not
//! return.** Measured 2026-09-07 on Ubuntu 24.04: the GTK dialog opens, the
//! compositor reports mallow as not responding, and it never comes back — Wait
//! does nothing, the dialog's own Cancel cannot be pressed, and Force Quit is
//! the only way out. Reproduced with a real network printer configured and under
//! `pnpm tauri build --debug --no-bundle`, so it is neither a missing-printer
//! artefact nor a dev-server one. `PrintOperation::run_dialog` is synchronous and
//! wry calls it on the main thread, which is consistent with the window never
//! servicing another event.
//!
//! **The guard is here rather than in the frontend because it cannot fail open.**
//! A `cfg` is resolved by the compiler; a `navigator.platform` test that returned
//! something unexpected would hand the user a session they have to kill. The
//! frontend may still stop offering the entry — that is a nicety, and this is the
//! boundary.

/// Open the platform's print UI for the window this was invoked from.
#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn print_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Refused on Linux: see the module note. Deliberately never reaches
/// `WebviewWindow::print()`.
///
/// **This arm is not compiled on macOS or Windows**, so `cargo check` on either
/// says nothing about it — keep it trivial enough that reading it is enough.
#[cfg(target_os = "linux")]
#[tauri::command]
pub fn print_window(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("printing is disabled on Linux: the GTK print dialog does not return".to_string())
}
