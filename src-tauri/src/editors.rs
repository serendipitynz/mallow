//! Detect installed external editors and open files in them, plus "reveal in the
//! OS file manager" and "open in the OS default handler". Spawning is done with
//! `std::process::Command` directly.

use std::path::Path;
use std::process::Command;

#[derive(serde::Serialize)]
pub struct EditorInfo {
    id: String,
    label: String,
}

impl EditorInfo {
    fn new(id: &str, label: &str) -> Self {
        Self { id: id.into(), label: label.into() }
    }
}

// ---- macOS ------------------------------------------------------------------
#[cfg(target_os = "macos")]
fn mac_app_exists(app: &str) -> bool {
    if Path::new(&format!("/Applications/{app}.app")).exists() {
        return true;
    }
    if let Ok(home) = std::env::var("HOME") {
        if Path::new(&format!("{home}/Applications/{app}.app")).exists() {
            return true;
        }
    }
    false
}

#[cfg(target_os = "macos")]
const MAC_EDITORS: &[(&str, &str, &str)] = &[
    // (id, label, .app name)
    ("vscode", "VS Code", "Visual Studio Code"),
    ("zed", "Zed", "Zed"),
    ("coteditor", "CotEditor", "CotEditor"),
    ("mi", "mi", "mi"),
];

#[cfg(target_os = "macos")]
pub fn detect() -> Vec<EditorInfo> {
    MAC_EDITORS
        .iter()
        .filter(|(_, _, app)| mac_app_exists(app))
        .map(|(id, label, _)| EditorInfo::new(id, label))
        .collect()
}

#[cfg(target_os = "macos")]
pub fn open(id: &str, path: &str) -> Result<(), String> {
    let app = MAC_EDITORS
        .iter()
        .find(|(eid, _, _)| *eid == id)
        .map(|(_, _, app)| *app)
        .ok_or_else(|| format!("unknown editor: {id}"))?;
    Command::new("open")
        .arg("-a")
        .arg(app)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
pub fn reveal(path: &str) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
pub fn open_default(path: &str) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ---- Windows ----------------------------------------------------------------
#[cfg(target_os = "windows")]
fn first_existing(paths: &[String]) -> Option<String> {
    paths.iter().find(|p| Path::new(p).exists()).cloned()
}

#[cfg(target_os = "windows")]
fn win_editor_exe(id: &str) -> Option<String> {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".into());
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    match id {
        "vscode" => first_existing(&[
            format!("{local}\\Programs\\Microsoft VS Code\\Code.exe"),
            format!("{pf}\\Microsoft VS Code\\Code.exe"),
        ]),
        "notepadpp" => {
            first_existing(&[format!("{pf}\\Notepad++\\notepad++.exe"), format!("{pf86}\\Notepad++\\notepad++.exe")])
        }
        "sakura" => first_existing(&[format!("{pf86}\\sakura\\sakura.exe"), format!("{pf}\\sakura\\sakura.exe")]),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
pub fn detect() -> Vec<EditorInfo> {
    [("vscode", "VS Code"), ("notepadpp", "Notepad++"), ("sakura", "サクラエディタ")]
        .iter()
        .filter(|(id, _)| win_editor_exe(id).is_some())
        .map(|(id, label)| EditorInfo::new(id, label))
        .collect()
}

#[cfg(target_os = "windows")]
pub fn open(id: &str, path: &str) -> Result<(), String> {
    let exe = win_editor_exe(id).ok_or_else(|| format!("editor not found: {id}"))?;
    Command::new(exe)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub fn open_default(path: &str) -> Result<(), String> {
    // `explorer <file>` hands the file to its registered handler, and not
    // `cmd /C start`: `cmd` re-parses its command line by its own rules rather
    // than the ones `Command` quotes for, so a path holding `&` or `^` would be
    // split there. It exits non-zero even on success, which costs nothing since
    // the child is spawned and never waited on.
    //
    // Not a clean win, and unverified here for want of a Windows machine:
    // `explorer.exe` does not use `CommandLineToArgvW` either and is reported to
    // split its argument on a comma, so `a,b.html` may open the wrong target or
    // none. The ways out are `rundll32 url.dll,FileProtocolHandler <file>` or a
    // `ShellExecuteW` call, the second of which costs a new dependency — so this
    // waits on the measurement rather than trading one unverified parser for
    // another.
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub fn reveal(path: &str) -> Result<(), String> {
    Command::new("explorer")
        .arg(format!("/select,{path}"))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ---- Linux ------------------------------------------------------------------
#[cfg(target_os = "linux")]
fn in_path(cmd: &str) -> bool {
    Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {cmd}"))
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
const LINUX_EDITORS: &[(&str, &str, &str)] = &[("vscode", "VS Code", "code"), ("zed", "Zed", "zed")];

#[cfg(target_os = "linux")]
pub fn detect() -> Vec<EditorInfo> {
    LINUX_EDITORS
        .iter()
        .filter(|(_, _, cmd)| in_path(cmd))
        .map(|(id, label, _)| EditorInfo::new(id, label))
        .collect()
}

#[cfg(target_os = "linux")]
pub fn open(id: &str, path: &str) -> Result<(), String> {
    let cmd = LINUX_EDITORS
        .iter()
        .find(|(eid, _, _)| *eid == id)
        .map(|(_, _, cmd)| *cmd)
        .ok_or_else(|| format!("unknown editor: {id}"))?;
    Command::new(cmd)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
pub fn open_default(path: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
pub fn reveal(path: &str) -> Result<(), String> {
    // Reveal isn't standardized on Linux; open the parent directory.
    let dir = Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ---- Commands ---------------------------------------------------------------
#[tauri::command]
pub fn detect_editors() -> Vec<EditorInfo> {
    detect()
}

#[tauri::command]
pub fn open_in_editor(id: String, path: String) -> Result<(), String> {
    open(&id, &path)
}

#[tauri::command]
pub fn reveal_in_os(path: String) -> Result<(), String> {
    reveal(&path)
}

/// Hand the file to the OS handler registered for its type.
///
/// Spawned with `std::process` like everything else here, and deliberately not
/// through tauri-plugin-opener: `open_path` requires an allowed `Entry::Path`,
/// `allow-open-path` ships no scope and `opener:default` contributes only URL
/// entries, so every call would return `ForbiddenPath`. Widening that scope at
/// runtime is possible but would be a second runtime-scope mechanism beside
/// `allow_media_dir` for a call this module can already make (decision-3).
#[tauri::command]
pub fn open_in_default_app(path: String) -> Result<(), String> {
    open_default(&path)
}
