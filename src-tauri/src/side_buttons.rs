//! The mouse's back and forward side buttons on macOS (TASK-44).
//!
//! **The page does not get them.** Measured 2026-10-30 with a Logitech MX
//! Anywhere 3S: the frontend's `mouseup` handler for buttons 3 / 4 never moved
//! the history, while the same buttons go back in Chrome — which acts on the
//! native event itself rather than on anything a page receives. That WKWebView
//! is what drops them is the reading the measurement fits, not something it
//! isolated. AppKit does deliver them to the application, as `otherMouseDown` / `otherMouseUp`
//! with `buttonNumber` 3 and 4, so they are taken here instead, by a local event
//! monitor, and sent to the window as the direction to move.
//!
//! **Both halves of the click are consumed and only the release acts**, for the
//! frontend handler's reason (`lib/history-nav`) — and consuming them is also what
//! keeps a future WebKit that does forward the buttons from moving two steps.
//!
//! Windows and Linux keep the frontend handler alone; whether their WebViews
//! deliver the buttons is not measured.

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Emitter, Manager};

/// The event the frontend moves its visit history on, with `"back"` or
/// `"forward"` as the payload.
#[cfg(target_os = "macos")]
const HISTORY_GO: &str = "history:go";

#[cfg(target_os = "macos")]
fn direction(button: isize) -> Option<&'static str> {
    match button {
        3 => Some("back"),
        4 => Some("forward"),
        _ => None,
    }
}

/// Install the monitor for the life of the app. Called once from `setup`.
#[cfg(target_os = "macos")]
#[cfg_attr(unattended, allow(dead_code))]
pub fn init(app: &AppHandle) {
    use std::ptr::NonNull;

    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask, NSEventType};

    let app = app.clone();
    let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        // SAFETY: AppKit hands the monitor a valid event for the duration of
        // the call.
        let event_ref = unsafe { event.as_ref() };
        let Some(direction) = direction(event_ref.buttonNumber()) else {
            return event.as_ptr();
        };
        if event_ref.r#type() == NSEventType::OtherMouseUp {
            emit_to_window_under(&app, event_ref, direction);
        }
        std::ptr::null_mut()
    });
    // SAFETY: the block returns either the event it was given or null, which is
    // what the monitor contract asks for.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(
            NSEventMask::OtherMouseDown | NSEventMask::OtherMouseUp,
            &handler,
        )
    };
    // Never removed: the monitor lives as long as the app does, and dropping the
    // handle is not what keeps it registered or unregisters it.
    std::mem::forget(monitor);
}

/// The window the click landed in, which need not be the focused one — a side
/// button pressed over a window in the background acts on that window, as it does
/// in a browser. The focused window answers when the event carries none.
#[cfg(target_os = "macos")]
fn emit_to_window_under(app: &AppHandle, event: &objc2_app_kit::NSEvent, direction: &'static str) {
    // A monitor runs on the main thread, so the marker is always there.
    let clicked = objc2::MainThreadMarker::new()
        .and_then(|mtm| event.window(mtm))
        .map(|window| {
            objc2::rc::Retained::as_ptr(&window)
                .cast_mut()
                .cast::<std::ffi::c_void>()
        });
    let target = app
        .webview_windows()
        .into_values()
        .find(|window| clicked.is_some() && window.ns_window().ok() == clicked)
        .or_else(|| crate::menu::focused_window(app));
    if let Some(window) = target {
        if let Err(e) = app.emit_to(window.label(), HISTORY_GO, direction) {
            eprintln!("mallow: a side-button move could not be delivered ({e})");
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[cfg_attr(unattended, allow(dead_code))]
pub fn init(_app: &tauri::AppHandle) {}
