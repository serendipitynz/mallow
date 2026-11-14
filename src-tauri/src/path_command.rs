//! The `mallow` command on macOS (TASK-62): the app menu's "Install 'mallow'
//! Command…" writes a shell script to `/usr/local/bin/mallow` that runs this
//! bundle's own binary, and "Uninstall 'mallow' Command…" removes it.
//!
//! **A script that `exec`s the binary, never a symlink to it.** tauri-utils
//! refuses a macOS executable path with a symlink anywhere in it — its
//! `StartingBinary` makes `current_exe()` an error, and the resource directory
//! and the updater are both derived from that — so a linked binary would start
//! without either. `exec` also keeps the terminal's working directory, which is
//! what `mallow .` and a relative path rest on; `open -a mallow --args .` would
//! not, since the app LaunchServices starts runs in `/`.
//!
//! **`/usr/local/bin` because it is on every Mac's default `PATH`** (`/etc/paths`),
//! Apple silicon included, where `/opt/homebrew/bin` is only on it once Homebrew
//! is installed. It is root-owned on a Mac without Intel Homebrew, so a write
//! that is refused is retried through the administrator prompt.
//!
//! Compiled on every platform so the pure half is tested everywhere; only macOS
//! has the menu items that call the commands.
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::path::Path;

use serde::Serialize;

const TARGET: &str = "/usr/local/bin/mallow";

/// The script's second line, and the whole test of whether a file at `TARGET` is
/// one mallow wrote. Neither command touches a file without it unless the reader
/// said to replace it.
const MARKER: &str = "# Written by mallow's Install 'mallow' Command menu item.";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Outcome {
    Installed {
        path: String,
    },
    Removed {
        path: String,
    },
    /// Nothing at the path to remove.
    Absent {
        path: String,
    },
    /// A file mallow did not write is at the path.
    Foreign {
        path: String,
    },
    /// mallow is running from somewhere that will not last — a disk image, or the
    /// randomised copy Gatekeeper runs a quarantined app from — so a script
    /// pointing at it would break as soon as the reader moved mallow.
    Unsettled {
        binary: String,
    },
    /// The reader dismissed the administrator prompt.
    Cancelled,
    Failed {
        message: String,
    },
}

pub fn script(binary: &Path) -> String {
    format!(
        "#!/bin/sh\n{MARKER}\n# It runs mallow; reinstall it from that menu if mallow.app moves.\nexec {} \"$@\"\n",
        sh_quote(&binary.to_string_lossy())
    )
}

fn is_ours(contents: &str) -> bool {
    contents.lines().nth(1) == Some(MARKER)
}

fn is_unsettled(binary: &Path) -> bool {
    let text = binary.to_string_lossy();
    text.starts_with("/Volumes/") || text.contains("/AppTranslocation/")
}

fn sh_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', r"'\''"))
}

fn applescript_string(text: &str) -> String {
    format!("\"{}\"", text.replace('\\', r"\\").replace('"', "\\\""))
}

/// What is at `TARGET` now: absent, ours, or someone else's.
#[derive(Debug, PartialEq)]
enum Present {
    Absent,
    Ours,
    Foreign,
}

/// A symlink is read as foreign whatever it points at, because replacing or
/// removing what it resolves to would reach a file outside `TARGET`.
fn present(path: &Path) -> Present {
    match std::fs::symlink_metadata(path) {
        Err(_) => Present::Absent,
        Ok(meta) if meta.file_type().is_symlink() => Present::Foreign,
        Ok(_) => match std::fs::read_to_string(path) {
            Ok(contents) if is_ours(&contents) => Present::Ours,
            _ => Present::Foreign,
        },
    }
}

#[tauri::command]
pub async fn install_path_command(replace: bool) -> Outcome {
    let binary = match tauri::utils::platform::current_exe() {
        Ok(binary) => binary,
        Err(e) => return Outcome::Failed { message: e.to_string() },
    };
    if is_unsettled(&binary) {
        return Outcome::Unsettled { binary: binary.to_string_lossy().to_string() };
    }
    let target = Path::new(TARGET);
    if present(target) == Present::Foreign && !replace {
        return Outcome::Foreign { path: TARGET.to_string() };
    }
    install(&script(&binary))
}

#[tauri::command]
pub async fn uninstall_path_command() -> Outcome {
    match present(Path::new(TARGET)) {
        Present::Absent => Outcome::Absent { path: TARGET.to_string() },
        Present::Foreign => Outcome::Foreign { path: TARGET.to_string() },
        Present::Ours => uninstall(),
    }
}

/// Written beside the target and renamed over it, so a reader never runs half a
/// script, and so a symlink at the target is replaced rather than written through.
#[cfg(target_os = "macos")]
fn install(script: &str) -> Outcome {
    use std::os::unix::fs::PermissionsExt;

    let staged = format!("{TARGET}.mallow-{}", std::process::id());
    let direct = std::fs::write(&staged, script)
        .and_then(|()| std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755)))
        .and_then(|()| std::fs::rename(&staged, TARGET));
    match direct {
        Ok(()) => Outcome::Installed { path: TARGET.to_string() },
        Err(_) => {
            let _ = std::fs::remove_file(&staged);
            install_as_administrator(script)
        }
    }
}

#[cfg(target_os = "macos")]
fn install_as_administrator(script: &str) -> Outcome {
    let staged = std::env::temp_dir().join(format!("mallow-command-{}", std::process::id()));
    if let Err(e) = std::fs::write(&staged, script) {
        return Outcome::Failed { message: e.to_string() };
    }
    let dir = Path::new(TARGET)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let shell = format!(
        "/bin/mkdir -p {dir} && /usr/bin/install -m 755 {staged} {TARGET}.mallow && /bin/mv -f {TARGET}.mallow {TARGET}",
        dir = sh_quote(&dir),
        staged = sh_quote(&staged.to_string_lossy()),
    );
    let outcome = as_administrator(&shell, "mallow wants to install the 'mallow' command in /usr/local/bin.");
    let _ = std::fs::remove_file(&staged);
    match outcome {
        Ok(()) => Outcome::Installed { path: TARGET.to_string() },
        Err(refused) => refused,
    }
}

#[cfg(target_os = "macos")]
fn uninstall() -> Outcome {
    match std::fs::remove_file(TARGET) {
        Ok(()) => Outcome::Removed { path: TARGET.to_string() },
        Err(_) => match as_administrator(
            &format!("/bin/rm -f {TARGET}"),
            "mallow wants to remove the 'mallow' command from /usr/local/bin.",
        ) {
            Ok(()) => Outcome::Removed { path: TARGET.to_string() },
            Err(refused) => refused,
        },
    }
}

/// Run `shell` as root through the standard administrator prompt. The prompt is
/// AppKit's own, so mallow never sees the password.
#[cfg(target_os = "macos")]
fn as_administrator(shell: &str, prompt: &str) -> Result<(), Outcome> {
    let source = format!(
        "do shell script {} with prompt {} with administrator privileges",
        applescript_string(shell),
        applescript_string(prompt)
    );
    match std::process::Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(source)
        .output()
    {
        Ok(out) if out.status.success() => Ok(()),
        // -128 is AppleScript's "User canceled".
        Ok(out) if String::from_utf8_lossy(&out.stderr).contains("(-128)") => Err(Outcome::Cancelled),
        Ok(out) => Err(Outcome::Failed { message: String::from_utf8_lossy(&out.stderr).trim().to_string() }),
        Err(e) => Err(Outcome::Failed { message: e.to_string() }),
    }
}

#[cfg(not(target_os = "macos"))]
fn install(_script: &str) -> Outcome {
    Outcome::Failed { message: "the 'mallow' command is installed from the menu on macOS only".to_string() }
}

#[cfg(not(target_os = "macos"))]
fn uninstall() -> Outcome {
    install("")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_script_execs_the_binary_by_its_quoted_path_with_every_argument() {
        let text = script(Path::new("/Applications/mallow.app/Contents/MacOS/mallow"));
        assert!(text.starts_with("#!/bin/sh\n"));
        assert!(text.ends_with("exec '/Applications/mallow.app/Contents/MacOS/mallow' \"$@\"\n"));
        assert!(is_ours(&text));
    }

    #[test]
    fn a_quote_in_the_path_survives_the_shell() {
        let text = script(Path::new("/Users/r/Apps/Ann's/mallow.app/Contents/MacOS/mallow"));
        assert!(text.contains(r"exec '/Users/r/Apps/Ann'\''s/mallow.app/Contents/MacOS/mallow' "));
    }

    #[test]
    fn only_a_file_carrying_the_marker_on_its_second_line_is_ours() {
        assert!(!is_ours("#!/bin/sh\nexec /usr/local/mallow-other \"$@\"\n"));
        assert!(!is_ours(&format!("{MARKER}\n")));
        assert!(!is_ours(""));
    }

    #[test]
    fn a_disk_image_or_a_translocated_copy_is_not_somewhere_to_point_at() {
        assert!(is_unsettled(Path::new("/Volumes/mallow/mallow.app/Contents/MacOS/mallow")));
        assert!(is_unsettled(Path::new(
            "/private/var/folders/x/T/AppTranslocation/ABCD/d/mallow.app/Contents/MacOS/mallow"
        )));
        assert!(!is_unsettled(Path::new("/Applications/mallow.app/Contents/MacOS/mallow")));
    }

    #[test]
    fn an_applescript_string_escapes_its_quotes_and_backslashes() {
        assert_eq!(applescript_string(r#"a "b" \c"#), r#""a \"b\" \\c""#);
    }

    #[test]
    fn what_is_at_the_target_is_read_without_following_a_link() {
        let dir = std::env::temp_dir().join(format!("mallow-path-command-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ours = dir.join("ours");
        let theirs = dir.join("theirs");
        std::fs::write(&ours, script(Path::new("/Applications/mallow.app/Contents/MacOS/mallow"))).unwrap();
        std::fs::write(&theirs, "#!/bin/sh\necho other\n").unwrap();
        assert_eq!(present(&ours), Present::Ours);
        assert_eq!(present(&theirs), Present::Foreign);
        assert_eq!(present(&dir.join("absent")), Present::Absent);
        #[cfg(unix)]
        {
            let link = dir.join("link");
            std::os::unix::fs::symlink(&ours, &link).unwrap();
            assert_eq!(present(&link), Present::Foreign);
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
