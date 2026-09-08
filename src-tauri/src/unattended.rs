//! The unattended export: what a build made with `MALLOW_UNATTENDED=1` does
//! instead of waiting for a reader.
//!
//! **It is not the PDF export's entry.** `CmdOrCtrl+E`, the gate and the save
//! dialog are untouched and unused here — this calls `write_window_pdf` as a
//! second caller, so it measures the paper and says nothing about AC #2, #3, #4
//! or #6, which stay with a person.
//!
//! It exists because TASK-30's "Nothing automated will verify the paper" lost its
//! premise the moment mallow could write a PDF through the print pipeline itself:
//! producing the paper no longer needs a human at the keyboard, so the eleven
//! round-trips the print work cost in three days do not have to be repeated.
//!
//! **The whole module is `cfg(unattended)`**, and `lib.rs` registers its two
//! commands only in that build, so an ordinary binary carries neither the
//! commands nor the argument parsing.
//!
//! The exit code is the result, because a CI step reads exit codes and not
//! screens: 0 the PDF was written, 1 `write_window_pdf` refused (its message goes
//! to stderr), 2 the document never finished rendering, 3 the arguments were not
//! usable. The frontend decides between 0, 1 and 2; 3 is decided here, before a
//! window is ever opened.

use serde::Serialize;

/// What the run was asked to do. Named arguments rather than positional ones
/// because the same command line is written into a CI step on three platforms and
/// read there by people, and `--theme dark` says what a bare `dark` does not.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub document: String,
    pub out: String,
    pub theme: String,
}

/// Reads the request out of the command line, or explains what is missing.
///
/// Kept separate from the exit so it can be unit-tested: the parse is the part
/// with cases, and `std::process::exit` cannot be one of them.
pub fn parse(args: &[String]) -> Result<Request, String> {
    let mut document = None;
    let mut out = None;
    let mut theme = None;
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        let slot = match arg.as_str() {
            "--document" => &mut document,
            "--out" => &mut out,
            "--theme" => &mut theme,
            _ => continue,
        };
        match rest.next() {
            Some(value) => *slot = Some(value.clone()),
            None => return Err(format!("{arg} needs a value")),
        }
    }

    let theme = theme.unwrap_or_else(|| "light".to_string());
    if theme != "light" && theme != "dark" {
        return Err(format!("--theme must be light or dark, not {theme}"));
    }
    match (document, out) {
        (Some(document), Some(out)) => Ok(Request { document, out, theme }),
        _ => Err("--document <path> and --out <path> are both required".to_string()),
    }
}

/// Whether the document is something that can be opened, checked here because
/// this side can stat a path and the frontend cannot.
///
/// **Existing is not enough.** A *directory* named `report.md` exists, passes a
/// name check, and then fails to be read — at which point no markdown preview
/// mounts, nothing reports a render, and the run spends its whole timeout before
/// failing as "never rendered", which says the paper hung when the truth is that
/// the argument was wrong. Whether it is *markdown* stays with the frontend,
/// where the extension→kind mapping's TypeScript half lives.
pub fn document_problem(path: &str) -> Option<String> {
    let path = std::path::Path::new(path);
    match std::fs::metadata(path) {
        Err(_) => Some(format!("{} does not exist", path.display())),
        Ok(meta) if meta.is_dir() => Some(format!("{} is a directory", path.display())),
        Ok(meta) if !meta.is_file() => Some(format!("{} is not a regular file", path.display())),
        Ok(_) => None,
    }
}

/// The parsed request, or exit 3 — called from `run()` before the app is built,
/// so a mistyped command line costs no window.
pub fn request_or_exit() -> Request {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match parse(&args) {
        Ok(request) => match document_problem(&request.document) {
            None => request,
            Some(problem) => {
                eprintln!("unattended export: {problem}");
                std::process::exit(3);
            }
        },
        Err(message) => {
            eprintln!("unattended export: {message}");
            eprintln!("usage: mallow --document <markdown> --out <pdf> [--theme light|dark]");
            std::process::exit(3);
        }
    }
}

#[tauri::command]
pub fn unattended_request(state: tauri::State<'_, Request>) -> Request {
    state.inner().clone()
}

/// Ends the run. **The process exits inside this call**, so the promise on the
/// frontend never settles — which is why the frontend must have nothing left to
/// do when it invokes this.
#[tauri::command]
pub fn unattended_finish(code: i32, message: String) {
    if !message.is_empty() {
        eprintln!("unattended export: {message}");
    }
    std::process::exit(code);
}

#[cfg(test)]
mod tests {
    use super::parse;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn reads_the_three_arguments_in_any_order() {
        let request = parse(&args(&["--out", "/tmp/a.pdf", "--theme", "dark", "--document", "/docs/a.md"])).unwrap();
        assert_eq!(request.document, "/docs/a.md");
        assert_eq!(request.out, "/tmp/a.pdf");
        assert_eq!(request.theme, "dark");
    }

    // The light/dark pair is what the paper is measured in, and a run that
    // silently took the wrong one would produce a paper nobody can compare.
    #[test]
    fn defaults_the_theme_but_refuses_an_unknown_one() {
        assert_eq!(parse(&args(&["--document", "a.md", "--out", "a.pdf"])).unwrap().theme, "light");
        assert!(parse(&args(&["--document", "a.md", "--out", "a.pdf", "--theme", "sepia"])).is_err());
    }

    #[test]
    fn refuses_a_missing_path_rather_than_inventing_one() {
        assert!(parse(&args(&["--document", "a.md"])).is_err());
        assert!(parse(&args(&["--out", "a.pdf"])).is_err());
        assert!(parse(&args(&["--document"])).is_err());
    }

    /// A directory named like a document is the case an existence check passes
    /// and a read fails, which without this costs the run its whole timeout and
    /// reports the wrong reason.
    #[test]
    fn refuses_a_directory_that_is_named_like_a_document() {
        let dir = std::env::temp_dir().join(format!("mallow-unattended-dir-{}.md", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let problem = super::document_problem(dir.to_str().unwrap());
        std::fs::remove_dir_all(&dir).unwrap();
        assert!(problem.unwrap().contains("is a directory"));
    }

    #[test]
    fn refuses_a_document_that_is_not_there_and_accepts_one_that_is() {
        let file = std::env::temp_dir().join(format!("mallow-unattended-file-{}.md", std::process::id()));
        assert!(super::document_problem(file.to_str().unwrap())
            .unwrap()
            .contains("does not exist"));
        std::fs::write(&file, "# hi\n").unwrap();
        let problem = super::document_problem(file.to_str().unwrap());
        std::fs::remove_file(&file).unwrap();
        assert!(problem.is_none(), "{problem:?}");
    }

    // The binary is launched with whatever else the platform adds, so unknown
    // arguments have to be ignored rather than refused.
    #[test]
    fn ignores_arguments_it_does_not_know() {
        assert!(parse(&args(&["-psn_0_12345", "--document", "a.md", "--out", "a.pdf"])).is_ok());
    }
}
