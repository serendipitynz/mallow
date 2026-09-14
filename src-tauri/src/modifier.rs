//! Reading the new-window modifier when an Open Recent entry is chosen.
//!
//! **What can be read here is not what the reader did.** A menu item's
//! activation and this code are one event-loop turn apart: muda hands the id to
//! the handler tauri installed, which only forwards it to the event loop
//! (tauri-2.11.3 `src/app.rs:2350-2351`, delivered at `:2586-2600`), so every
//! arm below asks the OS what is held *now* rather than what was held then.
//!
//! **The click-time state is unreachable rather than unmeasured**, and the
//! reason is one line of muda: its handler slot is a `OnceCell`
//! (muda-0.19.3 `src/lib.rs:490-491`) that tauri fills during `build()`. It
//! cannot be wrapped and it cannot be replaced, so there is no point in this
//! process where a modifier snapshot could be taken beside the id. That is what
//! makes a measured answer necessary: whether the read agrees with the reader is
//! a property of the delay, and only a hand round can say.
//!
//! `None` means this build cannot ask at all, which the caller must treat as
//! "no modifier" rather than as a failure — a gesture that cannot be read is a
//! gesture that is not offered (TASK-12.5 AC #4), and the in-app Open Recent
//! list carries it there instead.

/// Whether the new-window modifier — Command on macOS, Control elsewhere — is
/// held at the moment the caller asks.
#[cfg(target_os = "macos")]
pub fn new_window_modifier_held() -> Option<bool> {
    use objc2_app_kit::{NSEvent, NSEventModifierFlags};

    // The class-level `modifierFlags`, which answers for the keyboard rather
    // than for one event, so no NSEvent has to be in hand.
    Some(NSEvent::modifierFlags_class().contains(NSEventModifierFlags::Command))
}

/// Whether the new-window modifier is held, read from the thread's own input
/// state rather than from the hardware.
///
/// **`GetKeyState` rather than `GetAsyncKeyState`, and the difference is the
/// whole question here.** The asynchronous call reports the physical key at the
/// instant it runs, which is exactly the state a reader releasing Control as
/// they click has already left. `GetKeyState` reports the state the thread's
/// input queue has reached, which advances as key messages are removed — and the
/// `WM_KEYUP` for that release sits behind the message tauri posted, so the read
/// should still see Control down. **That is a reading of the documented
/// behaviour and not a measurement**; the hand round on Windows is what settles
/// it, and a failure there is answered by not offering the gesture rather than
/// by swapping the call.
#[cfg(target_os = "windows")]
pub fn new_window_modifier_held() -> Option<bool> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL};

    // The high-order bit is "down"; the low-order bit is the toggle state, which
    // is meaningless for Control and must not be read as held.
    Some(unsafe { GetKeyState(VK_CONTROL as i32) } < 0)
}

/// Whether the new-window modifier is held, from GDK's keymap for the default
/// display.
///
/// `None` where there is no display to ask, which is a headless run rather than
/// a fault.
#[cfg(target_os = "linux")]
pub fn new_window_modifier_held() -> Option<bool> {
    use gtk::gdk::{Display, Keymap, ModifierType};

    let keymap = Keymap::for_display(&Display::default()?)?;
    Some(ModifierType::from_bits_truncate(keymap.modifier_state()).contains(ModifierType::CONTROL_MASK))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub fn new_window_modifier_held() -> Option<bool> {
    None
}
