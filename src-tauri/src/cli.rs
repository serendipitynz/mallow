//! What a launch from a terminal gets before anything of Tauri runs (TASK-62).
//!
//! **This runs ahead of the single-instance plugin, and that is the point.**
//! `--help` and `--version` answer the terminal and end the process; reaching the
//! plugin, they would be forwarded to a running mallow, which skips flags and
//! would bring a window forward for a request that asked for a line of text.
#![cfg_attr(unattended, allow(dead_code))]

use std::ffi::{OsStr, OsString};
use std::io::Write;
use std::path::PathBuf;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, PartialEq, Eq)]
pub enum Request {
    Help,
    Version,
    Launch,
}

/// What argv asks for. **Help wins wherever it appears**, so `mallow -V -h` and
/// `mallow -h -V` agree; anything else shaped like a flag is left to
/// `handover::paths_in_args`, which skips it, because the OS adds flags of its own.
pub fn request(args: &[OsString]) -> Request {
    let mut version = false;
    for arg in args.iter().skip(1).map(OsString::as_os_str) {
        if arg == OsStr::new("-h") || arg == OsStr::new("--help") {
            return Request::Help;
        }
        if arg == OsStr::new("-V") || arg == OsStr::new("-v") || arg == OsStr::new("--version") {
            version = true;
        }
    }
    if version {
        Request::Version
    } else {
        Request::Launch
    }
}

pub fn usage() -> String {
    format!(
        "mallow {VERSION}
A lightweight Markdown and config-file viewer.

Usage: mallow [PATH...]

  PATH           a file or folder to open; a file opens its folder with the
                 file selected, and `.` opens the current directory
  -h, --help     print this help and exit
  -V, --version  print the version and exit

A path is resolved against the current directory. If mallow is already
running, the paths open in it and this command returns at once.
"
    )
}

/// Answer `--help` or `--version` and exit, or return for the launch to go on —
/// detached from the terminal first where it was started from one.
pub fn answer_or_detach() {
    let args: Vec<OsString> = std::env::args_os().collect();
    let text = match request(&args) {
        Request::Help => usage(),
        Request::Version => format!("mallow {VERSION}\n"),
        Request::Launch => {
            detach_from_terminal(&args);
            return;
        }
    };
    attach_parent_console();
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
    std::process::exit(0);
}

/// What to start again when detaching. **Inside an AppImage it is the AppImage**,
/// not this binary: the binary lives in a squashfs the AppImage runtime mounts for
/// as long as its child — this process — runs, and unmounts when it exits, so a
/// child started from the mounted path would lose its own executable.
#[cfg_attr(not(all(unix, not(debug_assertions))), allow(dead_code))]
pub fn relaunch_program(appimage: Option<OsString>, exe: Option<PathBuf>) -> Option<PathBuf> {
    appimage.filter(|path| !path.is_empty()).map(PathBuf::from).or(exe)
}

/// Started from a terminal, start this binary again outside the terminal's job
/// control and exit, so the command returns at once as it already does when a
/// running mallow takes the paths. The child keeps the working directory, which
/// is what makes a relative path and `.` mean the terminal's.
///
/// **Only where stdout is a terminal**: a launch from the Dock, Finder or a
/// desktop launcher has none and is left exactly as it was. **Release builds
/// only**: `pnpm tauri dev` runs the debug binary with the terminal attached and
/// would lose the app it is watching. A new process group rather than a new
/// session because it needs no `unsafe` and no `libc`: a background group
/// outside the shell's job table receives neither the hangup a closing terminal
/// sends its foreground group nor the one the shell sends its jobs, and with
/// stdio on `/dev/null` it never touches the terminal to be stopped by it.
#[cfg(all(unix, not(debug_assertions)))]
fn detach_from_terminal(args: &[OsString]) {
    use std::io::IsTerminal;
    use std::os::unix::process::CommandExt;
    use std::process::{Command, Stdio};

    if !std::io::stdout().is_terminal() {
        return;
    }
    let Some(program) = relaunch_program(std::env::var_os("APPIMAGE"), std::env::current_exe().ok()) else {
        return;
    };
    let spawned = Command::new(program)
        .args(args.iter().skip(1))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn();
    // A child that could not be started leaves this process to launch in the
    // foreground, which is the behaviour before TASK-62 rather than a failure.
    if spawned.is_ok() {
        std::process::exit(0);
    }
}

/// Windows needs none of this: mallow is a GUI-subsystem binary there, which a
/// shell does not wait for, and `mallow.cmd` starts it with `start`.
#[cfg(not(all(unix, not(debug_assertions))))]
fn detach_from_terminal(_args: &[OsString]) {}

/// Give a GUI-subsystem binary somewhere to print. Windows starts one with no
/// console and no standard handles, so the text would go nowhere; attaching to
/// the parent's console and pointing stdout at it puts the text in the terminal
/// that asked. **An inherited stdout is left alone**, so `mallow --version > v.txt`
/// still writes the file. Where there is no parent console (a shortcut), there is
/// nowhere to print and the process just exits.
#[cfg(windows)]
fn attach_parent_console() {
    use std::os::windows::io::IntoRawHandle;
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
    use windows_sys::Win32::System::Console::{
        AttachConsole, GetStdHandle, SetStdHandle, ATTACH_PARENT_PROCESS, STD_OUTPUT_HANDLE,
    };

    unsafe {
        let inherited = GetStdHandle(STD_OUTPUT_HANDLE);
        if !inherited.is_null() && inherited != INVALID_HANDLE_VALUE {
            return;
        }
        if AttachConsole(ATTACH_PARENT_PROCESS) == 0 {
            return;
        }
        // Whether attaching also fills in a stdout the process started without is
        // not relied on: the console's output buffer is opened and installed as
        // stdout either way, and std reads the handle on every write.
        if let Ok(conout) = std::fs::OpenOptions::new().read(true).write(true).open("CONOUT$") {
            SetStdHandle(STD_OUTPUT_HANDLE, conout.into_raw_handle());
        }
    }
}

#[cfg(not(windows))]
fn attach_parent_console() {}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(args: &[&str]) -> Vec<OsString> {
        std::iter::once("mallow")
            .chain(args.iter().copied())
            .map(OsString::from)
            .collect()
    }

    #[test]
    fn help_is_asked_for_by_either_spelling_wherever_it_appears() {
        assert_eq!(request(&argv(&["--help"])), Request::Help);
        assert_eq!(request(&argv(&["notes.md", "-h"])), Request::Help);
        assert_eq!(request(&argv(&["--version", "--help"])), Request::Help);
    }

    #[test]
    fn version_is_asked_for_by_each_spelling() {
        for flag in ["-V", "-v", "--version"] {
            assert_eq!(request(&argv(&[flag])), Request::Version, "{flag}");
        }
    }

    #[test]
    fn paths_and_other_flags_launch() {
        assert_eq!(request(&argv(&[])), Request::Launch);
        assert_eq!(request(&argv(&["."])), Request::Launch);
        assert_eq!(request(&argv(&["-psn_0_12345", "notes.md"])), Request::Launch);
    }

    #[test]
    fn the_binary_name_is_never_read_as_a_flag() {
        let args = vec![OsString::from("--help")];
        assert_eq!(request(&args), Request::Launch);
    }

    #[test]
    fn the_usage_names_the_version_and_both_flags() {
        let text = usage();
        assert!(text.starts_with(&format!("mallow {VERSION}\n")));
        assert!(text.contains("--help") && text.contains("--version"));
    }

    #[test]
    fn an_appimage_is_relaunched_rather_than_the_binary_mounted_inside_it() {
        let exe = Some(PathBuf::from("/tmp/.mount_mallowX/usr/bin/mallow"));
        assert_eq!(
            relaunch_program(Some(OsString::from("/home/r/mallow.AppImage")), exe.clone()),
            Some(PathBuf::from("/home/r/mallow.AppImage"))
        );
        assert_eq!(relaunch_program(None, exe.clone()), exe);
        assert_eq!(relaunch_program(Some(OsString::new()), exe.clone()), exe);
        assert_eq!(relaunch_program(None, None), None);
    }
}
