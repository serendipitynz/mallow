//! The mouse's back and forward side buttons on macOS (TASK-44).
//!
//! **The page does not get them.** Measured 2026-10-30 with a Logitech MX
//! Anywhere 3S: the frontend's `mouseup` handler for buttons 3 / 4 never moved
//! the history, while the same buttons go back in Chrome — which acts on the
//! native event itself rather than on anything a page receives.
//!
//! **And what arrives is not a button at all.** A local monitor over every event
//! type, the same day and mouse with Logi Options+ installed, saw each press as a
//! pair of `NSEventTypeSwipe` events: `deltaX` 0 and then +1 for Back, 0 and then
//! -1 for Forward — no `otherMouseDown` / `otherMouseUp` anywhere. So both shapes
//! are taken here, by one local event monitor, and sent to the window as the
//! direction to move:
//!
//! - **a swipe**, which is what that mouse sends, acting on the event whose
//!   `deltaX` is not 0. A trackpad's own swipe between pages is the same event
//!   type and may land here too; that is unmeasured, and would be the browser's
//!   behaviour anyway.
//! - **`otherMouseUp` with `buttonNumber` 3 / 4**, which is how a mouse without a
//!   remapping driver reports its side buttons. Not measured here: no such mouse
//!   was at hand. Both halves of the click are consumed and only the release acts,
//!   for the frontend handler's reason (`lib/history-nav`).
//!
//! What is acted on is consumed, so a WebKit that later forwards either shape to
//! the page cannot move two steps.
//!
//! Windows and Linux keep the frontend handler alone; whether their WebViews
//! deliver the buttons is not measured.

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Emitter, Manager};

/// The event the frontend moves its visit history on, with `"back"` or
/// `"forward"` as the payload.
#[cfg(target_os = "macos")]
const HISTORY_GO: &str = "history:go";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn button_direction(button: isize) -> Option<&'static str> {
    match button {
        3 => Some("back"),
        4 => Some("forward"),
        _ => None,
    }
}

/// The sign is the measured one: Back sent +1 and Forward -1. The 0 that comes
/// first in each pair moves nothing.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn swipe_direction(delta_x: f64) -> Option<&'static str> {
    if delta_x > 0.0 {
        Some("back")
    } else if delta_x < 0.0 {
        Some("forward")
    } else {
        None
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
        let kind = event_ref.r#type();
        // `buttonNumber` and `deltaX` are each asked only of the event types that
        // carry them; AppKit raises on the others.
        if kind == NSEventType::Swipe {
            let Some(direction) = swipe_direction(event_ref.deltaX()) else {
                return event.as_ptr();
            };
            emit_to_window_under(&app, event_ref, direction);
            return std::ptr::null_mut();
        }
        let Some(direction) = button_direction(event_ref.buttonNumber()) else {
            return event.as_ptr();
        };
        if kind == NSEventType::OtherMouseUp {
            emit_to_window_under(&app, event_ref, direction);
        }
        std::ptr::null_mut()
    });
    // SAFETY: the block returns either the event it was given or null, which is
    // what the monitor contract asks for.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(
            NSEventMask::Swipe | NSEventMask::OtherMouseDown | NSEventMask::OtherMouseUp,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// The pairs measured from a Logitech MX Anywhere 3S under Logi Options+.
    #[test]
    fn a_swipe_moves_by_its_sign_and_its_leading_zero_moves_nothing() {
        assert_eq!(swipe_direction(1.0), Some("back"));
        assert_eq!(swipe_direction(-1.0), Some("forward"));
        assert_eq!(swipe_direction(0.0), None);
    }

    #[test]
    fn only_buttons_3_and_4_move() {
        assert_eq!(button_direction(3), Some("back"));
        assert_eq!(button_direction(4), Some("forward"));
        for other in [0, 1, 2, 5] {
            assert_eq!(button_direction(other), None);
        }
    }
}
