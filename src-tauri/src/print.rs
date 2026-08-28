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

/// Open the platform's print UI for the window this was invoked from.
#[tauri::command]
pub fn print_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}
