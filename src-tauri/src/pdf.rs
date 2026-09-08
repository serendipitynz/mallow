//! PDF export: write the calling webview window as a PDF through the platform's
//! print pipeline, with no print UI on screen (decision-14).
//!
//! **This is a second route, not a fix to the first one.** TASK-27 measured the
//! print path on all three platforms and it is clean on exactly one: Windows
//! prints the whole document, macOS loses the tail of a long document to a page
//! count computed before the layout it then honours, and Linux's GTK dialog never
//! returns, which is why `print_window` refuses there. All three live inside wry's
//! `WebviewWindow::print()`, behind a call that takes no arguments, so none of
//! them is reachable from CSS or from Tauri's API. The API each platform exposes
//! for writing a PDF directly is different code from the one that opens its print
//! dialog, so this sidesteps all three defects rather than working around them.
//!
//! **Named for the window for the same reason `print_window` is not
//! `print_document`**: the engine paginates the whole `<body>`, and `@media print`
//! changes what is painted rather than what is paginated. `export_pdf` would make
//! the promise this project already rejected once.
//!
//! **Whether `@media print` applies is a property of the API, not of the
//! platform.** It is why the macOS arm builds an `NSPrintOperation` with a save
//! disposition instead of calling `WKWebView.createPDF`, which renders the view as
//! it stands and would put the explorer and the toolbar on the page with
//! `styles/print.scss` inert. The Windows and Linux calls are their platform's
//! print pipeline by construction. **None of that is proof** — it is checked per
//! platform on the paper itself (TASK-30 AC #1), which is also the only thing that
//! can check it, since no harness opens a print pipeline.
//!
//! **No print UI appears on any of the three routes**: the macOS operation runs
//! with both of its panels off, `PrintToPdf` has no UI at all, and the Linux arm
//! calls `print()` rather than `run_dialog()` — which is what keeps this away from
//! the hang printing cannot avoid there.
//!
//! **The destination always comes from the caller**, which asks the reader for it
//! through the dialog plugin's `save`. Nothing here invents a path: a file
//! appearing somewhere the reader did not name is worse than one keystroke more.
//!
//! Not gated on `cfg(desktop)`, for the reason `print_window` is not: a `cfg` would
//! drop the command from the handler and turn a mobile build into a runtime
//! "command not found", where leaving it out fails to compile instead.

use tauri::async_runtime::{channel, Mutex, Sender};

/// Serializes exports, because a second one started while the first is still
/// running is not merely wasteful on macOS: `NSPrintOperation` raises
/// `NSPrintOperationExistsException` when one is already in progress, and an
/// Objective-C exception crossing back into Rust takes the process down rather
/// than returning an error.
///
/// It refuses rather than queues. A queued second export would write the same
/// document to the same path a moment later, which is not what a reader who
/// pressed the chord twice is asking for, and a refusal is a message they can
/// see. The frontend keeps its own guard so the common double-press never gets
/// this far; this one is for every other caller, and the unattended export that
/// TASK-30's second PR adds is the first of those.
#[derive(Default)]
pub struct ExportLock(Mutex<()>);

/// Where a platform arm reports its outcome. Only Linux and Windows actually
/// need the indirection — both of their calls complete after returning — but all
/// three report the same way so the command has one shape.
type Report = Sender<Result<(), String>>;

/// Write this window's PDF to `path`.
///
/// Resolving means the platform reported the file written, which is what the
/// caller needs to know before telling the reader anything: the write is what
/// they asked for, and it happens at a path they named.
///
/// **All three routes report asynchronously, so a platform that never reports at
/// all leaves this future pending** — nothing here times it out. That is a
/// silence rather than a hang: none of the three blocks the main thread, so the
/// window keeps answering and the reader can try again.
#[tauri::command]
pub async fn write_window_pdf(
    window: tauri::WebviewWindow,
    lock: tauri::State<'_, ExportLock>,
    path: String,
) -> Result<(), String> {
    let Ok(_running) = lock.0.try_lock() else {
        return Err("an export is already running".to_string());
    };
    let path = absolute_destination(&path)?;
    let (report, mut done) = channel::<Result<(), String>>(1);
    window
        .with_webview(move |webview| write_pdf(webview, path, report))
        .map_err(|e| e.to_string())?;
    done.recv()
        .await
        .unwrap_or_else(|| Err("the PDF export ended without reporting an outcome".to_string()))?;
    Ok(())
}

/// The destination as an absolute path, because a relative one fails differently
/// on each platform and on one of them it fails silently.
///
/// Measured 2026-09-08 in CI, which ran the export with `paper/x.pdf`: Linux said
/// `The pathname "paper/x.pdf" is not an absolute path` and stopped, while macOS
/// logged `CFURLGetFSRef was passed a URL which has no scheme` and reported
/// success having written nothing — `fileURLWithPath:` builds a relative NSURL
/// from a relative path, and the print pipeline has nowhere to put the file. The
/// save dialog always answers with an absolute path, so this is about every other
/// caller, starting with the unattended export.
///
/// Resolved against the process's working directory without touching the disk:
/// the file does not exist yet, and following symlinks would be a different
/// promise from the one the caller made.
fn absolute_destination(path: &str) -> Result<String, String> {
    let absolute = std::path::absolute(path).map_err(|e| format!("{path} is not a usable destination: {e}"))?;
    absolute
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| format!("{} is not valid UTF-8", absolute.display()))
}

/// macOS: an `NSPrintOperation` with `NSPrintSaveJob`, so the PDF is written
/// *through* the print pipeline and the print stylesheet applies by construction.
///
/// The print info is built fresh rather than taken from `sharedPrintInfo()`, which
/// wry mutates on every print and which is the kind of application-wide state a
/// stale page count could live in. **That is decision-14's hypothesis about the
/// truncation, not a claim it is fixed**: the cause was never isolated, so a
/// complete export is not evidence for it and a truncated one is not a regression
/// against it (AC #9). A fresh instance is not degenerate — measured on macOS
/// 26.6.2, both it and the shared one report A4 595×842 with imageable bounds
/// 559×783 — so the paper is not what has to be set here; only the margins are.
///
/// **`runOperation()` is the one call that must not be used here, and that is
/// measured rather than read.** 2026-09-07, `pnpm tauri dev`: it pegged a core,
/// stopped answering, and wrote a 318 MB PDF of 4,022,381 objects with no trailer
/// — millions of pages whose content streams were 11 compressed bytes each, which
/// is to say empty. It is a known WebKit behaviour rather than anything about this
/// document: `printOperationWithPrintInfo:` produces blank pages under
/// `runOperation`, and the operation has to be run asynchronously through
/// `runOperationModalForWindow:` instead — **which shows no modal here**, since
/// both panels are off and the disposition is save. So the export answers through
/// a delegate, and that is why this arm has a class of its own.
#[cfg(target_os = "macos")]
fn write_pdf(webview: tauri::webview::PlatformWebview, path: String, report: Report) {
    use objc2::runtime::{NSObjectProtocol, ProtocolObject};
    use objc2::sel;
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob};
    use objc2_foundation::{NSString, NSURL};
    use objc2_web_kit::WKWebView;

    // SAFETY: `inner()` is the WKWebView this webview is built on, and
    // `with_webview` runs this on the main thread, which is where AppKit and
    // WebKit require it.
    let wk: &WKWebView = unsafe { &*(webview.inner() as *const WKWebView) };

    // The guard wry uses, kept for the same reason: `printOperationWithPrintInfo:`
    // is macOS 11+ and the bundle declares no minimum above that. Unlike the print
    // call, a refusal is reported rather than returned as success — the caller has
    // named a file it expects to exist.
    if !wk.respondsToSelector(sel!(printOperationWithPrintInfo:)) {
        let _ = report.try_send(Err("this macOS version cannot export a PDF from the webview".to_string()));
        return;
    }

    // The operation is asynchronous and AppKit reports its outcome to the window
    // it was run for, so a window is not optional here.
    let Some(window) = wk.window() else {
        let _ = report.try_send(Err("the window is not on screen, so no PDF can be written".to_string()));
        return;
    };

    let info = NSPrintInfo::new();
    info.setJobDisposition(unsafe { NSPrintSaveJob });

    // **The four margins are set to what `@page` asks for, and leaving them at
    // zero is what produced the wrong paper.** Measured 2026-09-08 with the print
    // info logged on both sides of the run: it goes in at zero and comes back with
    // all four at 45.354pt, because WebKit reads `@page { margin: 16mm }` and
    // writes it into the print info — but only *after* it has already computed the
    // page box. That first pass mixes the two geometries: the page width is the
    // margin box (505pt) while the page height is the *paper's* aspect ratio
    // applied to it (505 × 842/595 = 713pt, where the margin box is 751pt), and
    // the layout is done at the paper's full width and then scaled by 504/595 to
    // fit. The paper came out complete but at 0.847 scale on 12 pages.
    //
    // **A second pass is what fixes it, and TASK-27 saw that without naming it**:
    // switching printers in the print sheet "refreshed the page count" —
    // `paper-mac-light-7a.pdf` is a second pass, and its page box is 504×751 at
    // scale 1. An export runs the operation once, so the only way to get the
    // second pass's geometry is to start from it.
    //
    // So this is a copy of the stylesheet's value, and it is guarded rather than
    // trusted: `page_margin_matches_the_print_stylesheet` reads the `@page` rule
    // back out of `src/styles/print.scss`, the way `commands.rs` reads the asset
    // scope out of `tauri.conf.json`.
    let margin = page_margin_points();
    info.setTopMargin(margin);
    info.setRightMargin(margin);
    info.setBottomMargin(margin);
    info.setLeftMargin(margin);

    let url = NSURL::fileURLWithPath_isDirectory(&NSString::from_str(&path), false);
    // SAFETY: the dictionary is this print info's own attributes, and both the key
    // and the value are the types `NSPrintJobSavingURL` is documented to take.
    unsafe {
        info.dictionary()
            .setObject_forKey(&url, ProtocolObject::from_ref(NSPrintJobSavingURL));
    }

    // SAFETY: main thread, and the print info is one this function owns.
    let operation = unsafe { wk.printOperationWithPrintInfo(&info) };
    operation.setShowsPrintPanel(false);
    operation.setShowsProgressPanel(false);

    // **Nothing here seeds the print view's frame, and that is a reversal.** The
    // dialog-free recipes all set it from the webview's bounds, so the first
    // version did; the paper that came back was the whole page laid out at the
    // paper's own size and then scaled by 0.847 into the `@page` margin box —
    // measured 2026-09-07 from the clip rects, 504×713 against the print route's
    // 504×750 at scale 1, which is `@page { margin: 16mm }` acting as a shrink
    // rather than as a margin. The frame was the only geometric difference from
    // wry's route, whose paper was measured correct, so it goes: **this arm now
    // differs from that route in the disposition and the panels alone.** The
    // recipes' reason for the line does not apply here either — it is about a
    // webview with no frame of its own, and mallow's is on screen.

    let observer = mac_export::Observer::new(report, path);
    mac_export::retain_until_it_answers(observer.clone());

    // SAFETY: the window is this webview's own, the delegate implements exactly
    // the selector named, and a null context is what the selector's third argument
    // is documented to accept — the outcome travels in the observer's own state
    // instead, so nothing has to be reconstructed from a raw pointer.
    unsafe {
        operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
            &window,
            Some(&observer),
            Some(sel!(printOperationDidRun:success:contextInfo:)),
            std::ptr::null_mut(),
        );
    }
}

/// The paper margin `styles/print.scss` asks for in `@page`, in points.
///
/// It lives here as well as in the stylesheet because macOS needs it before the
/// engine has read the CSS (see `write_pdf`), and the two are held together by a
/// test rather than by this comment.
#[cfg(target_os = "macos")]
fn page_margin_points() -> f64 {
    const PAGE_MARGIN_MM: f64 = 16.0;
    const POINTS_PER_MM: f64 = 72.0 / 25.4;
    PAGE_MARGIN_MM * POINTS_PER_MM
}

/// The object AppKit reports the asynchronous print operation's outcome to.
///
/// It exists because the operation cannot be run synchronously (see `write_pdf`
/// above) and because **AppKit does not retain a `didRunSelector` delegate**, so
/// something on this side has to keep one alive until it is called.
#[cfg(target_os = "macos")]
mod mac_export {
    use std::cell::{Cell, RefCell};
    use std::ffi::c_void;

    use objc2::rc::{Allocated, Retained};
    use objc2::runtime::AnyObject;
    use objc2::{define_class, msg_send, AnyThread, DefinedClass};
    use objc2_foundation::NSObject;

    use super::Report;

    pub(super) struct Ivars {
        report: Report,
        path: String,
        answered: Cell<bool>,
    }

    define_class!(
        // SAFETY: NSObject has no subclassing requirements, and this class does not
        // implement `Drop`.
        #[unsafe(super(NSObject))]
        #[name = "MallowPdfExportObserver"]
        #[ivars = Ivars]
        pub(super) struct Observer;

        impl Observer {
            /// AppKit's `printOperationDidRun:success:contextInfo:`. `success` is
            /// the only thing it says about the job, so a failed write and a
            /// refused one arrive as the same message.
            #[unsafe(method(printOperationDidRun:success:contextInfo:))]
            fn print_operation_did_run(&self, _operation: *mut AnyObject, success: bool, _context: *mut c_void) {
                let ivars = self.ivars();
                let _ = ivars.report.try_send(if success {
                    Ok(())
                } else {
                    Err(format!("the print pipeline did not write {}", ivars.path))
                });
                // Answering is what makes this observer collectable, and the sweep
                // happens on the next export rather than here: dropping the last
                // reference to `self` inside one of its own methods would free the
                // receiver mid-message.
                ivars.answered.set(true);
            }
        }
    );

    impl Observer {
        pub(super) fn new(report: Report, path: String) -> Retained<Self> {
            let this: Allocated<Self> = Self::alloc();
            let this = this.set_ivars(Ivars { report, path, answered: Cell::new(false) });
            unsafe { msg_send![super(this), init] }
        }
    }

    thread_local! {
        /// Observers whose operation has not reported yet. Main-thread-only by
        /// construction: `with_webview` runs every export there.
        static PENDING: RefCell<Vec<Retained<Observer>>> = const { RefCell::new(Vec::new()) };
    }

    pub(super) fn retain_until_it_answers(observer: Retained<Observer>) {
        PENDING.with_borrow_mut(|pending| {
            pending.retain(|held| !held.ivars().answered.get());
            pending.push(observer);
        });
    }
}

/// Windows: WebView2's `PrintToPdf`, which is its print pipeline without its
/// print preview — so the print stylesheet applies and WebView2's own header and
/// footer, which printing adds and CSS cannot remove, are absent from its default
/// settings. `None` takes those defaults.
#[cfg(target_os = "windows")]
fn write_pdf(webview: tauri::webview::PlatformWebview, path: String, report: Report) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2PrintSettings, ICoreWebView2_7};
    use webview2_com::PrintToPdfCompletedHandler;
    use windows_core::{Interface, PCWSTR};

    // SAFETY: the controller is this window's own, and every call below is on the
    // main thread, where `with_webview` runs this.
    let printable = unsafe {
        webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_7>())
    };
    let printable = match printable {
        Ok(printable) => printable,
        Err(e) => {
            let _ = report.try_send(Err(format!("this WebView2 runtime cannot export a PDF: {e}")));
            return;
        }
    };

    // `PrintToPdf` reads the path during the call, so this buffer only has to
    // outlive it — but it does have to be a NUL-terminated wide string, which a
    // Rust `String` is not.
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    // **The closure does not receive an `HRESULT` and a `BOOL`.** webview2-com's
    // macro converts them first — `ClosureArg for HRESULT` yields
    // `windows::core::Result<()>` and `ClosureArg for BOOL` yields `bool` — so
    // `hr.ok()` and `written.as_bool()` do not compile here. Measured by CI on
    // 2026-09-08, which is the first time this arm was compiled anywhere: neither
    // `cargo check` on macOS nor the ubuntu Rust job reaches it.
    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, written| {
        let outcome = result.map_err(|e| e.to_string()).and_then(|()| {
            if written {
                Ok(())
            } else {
                Err("the print pipeline reported no file written".to_string())
            }
        });
        let _ = report.try_send(outcome);
        Ok(())
    }));

    // SAFETY: as above, plus `wide` outliving the call.
    if let Err(e) =
        unsafe { printable.PrintToPdf(PCWSTR(wide.as_ptr()), None::<&ICoreWebView2PrintSettings>, &handler) }
    {
        // The handler is not invoked when the call itself fails, so nothing else
        // would report this.
        let _ = report.try_send(Err(e.to_string()));
    }
}

/// Linux: WebKitGTK's print operation driven by `print()` rather than
/// `run_dialog()`, which is both what applies the print stylesheet and what keeps
/// this away from the dialog that never returns (decision-13).
///
/// **The printer is asked for by name, and the name is not `"Print to File"`
/// everywhere.** WebKit resolves the printer by matching `gtk_printer_get_name`,
/// and GTK's file backend names its printer through gettext, so the English
/// literal is printer-not-found on a Japanese desktop — where this export is the
/// only way a page leaves mallow at all. So the name is read back from GTK
/// itself (`gtk_printers`), and the literal is only the fallback for an
/// enumeration that finds nothing.
#[cfg(target_os = "linux")]
fn write_pdf(webview: tauri::webview::PlatformWebview, path: String, report: Report) {
    use std::cell::RefCell;
    use std::rc::Rc;
    use webkit2gtk::{glib, PrintOperation, PrintOperationExt};

    let uri = match glib::filename_to_uri(&path, None) {
        Ok(uri) => uri,
        Err(e) => {
            let _ = report.try_send(Err(format!("{path} is not a path that can be written to: {e}")));
            return;
        }
    };

    let settings = gtk::PrintSettings::new();
    settings.set_printer(&gtk_printers::file_backend_name().unwrap_or_else(|| "Print to File".to_string()));
    settings.set("output-uri", Some(uri.as_str()));
    settings.set("output-file-format", Some("pdf"));

    let operation = PrintOperation::new(&webview.inner());
    operation.set_print_settings(&settings);

    // `print()` does not keep the operation alive, so it holds itself through its
    // own `finished` handler and lets go there. Both signals are needed to report
    // an outcome and only `finished` sends: WebKit emits `failed` before it, never
    // instead of it, so the error is stashed and read once.
    let alive = Rc::new(RefCell::new(Some(operation.clone())));
    let failure: Rc<RefCell<Option<String>>> = Rc::new(RefCell::new(None));
    operation.connect_failed({
        let failure = Rc::clone(&failure);
        move |_, e| {
            *failure.borrow_mut() = Some(e.to_string());
        }
    });
    operation.connect_finished(move |_| {
        let outcome = match failure.borrow_mut().take() {
            Some(message) => Err(message),
            None => Ok(()),
        };
        let _ = report.try_send(outcome);
        alive.borrow_mut().take();
    });

    operation.print();
}

/// Which printer GTK's file backend registered, asked of GTK rather than assumed.
///
/// **The four symbols are declared here because gtk-rs does not bind them.**
/// gtk-sys 0.18 carries `GtkPrintSettings` and nothing of `GtkPrinter`, so there
/// is no safe wrapper to call and no crate to add that would supply one — these
/// live in libgtk-3, which the `gtk` crate already links, so declaring them costs
/// a dependency-free `extern` block rather than a dependency.
#[cfg(target_os = "linux")]
mod gtk_printers {
    use std::ffi::{c_char, c_int, c_void, CStr};

    /// Returns non-zero to stop the enumeration, per `GtkPrinterFunc`.
    type PrinterFunc = unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int;

    extern "C" {
        fn gtk_enumerate_printers(
            func: PrinterFunc,
            data: *mut c_void,
            destroy: Option<unsafe extern "C" fn(*mut c_void)>,
            wait: c_int,
        );
        fn gtk_printer_get_name(printer: *mut c_void) -> *const c_char;
        fn gtk_printer_is_virtual(printer: *mut c_void) -> c_int;
        fn gtk_printer_accepts_pdf(printer: *mut c_void) -> c_int;
    }

    /// **Virtual *and* PDF-capable is what picks the file backend out**, rather
    /// than the name it is being looked up to find. A queue that writes PDF
    /// through CUPS is a real printer to GTK and reports `is_virtual` false, so
    /// the pair does not match it.
    ///
    /// # Safety
    ///
    /// Called by GTK with one of its own `GtkPrinter`s and the `data` pointer
    /// handed to `gtk_enumerate_printers`, which is the `Option<String>` below.
    unsafe extern "C" fn take_file_backend(printer: *mut c_void, data: *mut c_void) -> c_int {
        if gtk_printer_is_virtual(printer) == 0 || gtk_printer_accepts_pdf(printer) == 0 {
            return 0;
        }
        let name = gtk_printer_get_name(printer);
        if name.is_null() {
            return 0;
        }
        let Ok(name) = CStr::from_ptr(name).to_str() else {
            return 0;
        };
        *(data as *mut Option<String>) = Some(name.to_string());
        1
    }

    /// The name of GTK's print-to-file printer in this locale, or `None` where no
    /// virtual PDF printer is registered at all.
    ///
    /// Enumeration waits, which runs a nested main loop — the same thing GTK does
    /// for a modal dialog, and the reason this must stay on the main thread the
    /// export already runs on.
    pub(super) fn file_backend_name() -> Option<String> {
        let mut found: Option<String> = None;
        // SAFETY: `found` outlives the call because the wait flag makes it
        // synchronous, and the callback is the only writer.
        unsafe {
            gtk_enumerate_printers(take_file_backend, (&mut found as *mut Option<String>).cast(), None, 1);
        }
        found
    }
}

#[cfg(test)]
mod destination_tests {
    use super::absolute_destination;

    // A relative destination is what CI handed the export, and macOS answered by
    // writing nothing and reporting success.
    #[test]
    fn makes_a_relative_destination_absolute() {
        let resolved = absolute_destination("paper/out.pdf").unwrap();
        assert!(std::path::Path::new(&resolved).is_absolute(), "{resolved} is not absolute");
        assert!(resolved.ends_with("out.pdf"), "{resolved} lost the file name");
    }

    #[test]
    fn leaves_an_absolute_destination_alone() {
        let already = std::env::current_dir().unwrap().join("out.pdf");
        let resolved = absolute_destination(already.to_str().unwrap()).unwrap();
        assert_eq!(std::path::Path::new(&resolved), already);
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    /// The margin the macOS export sets on `NSPrintInfo` is the one
    /// `styles/print.scss` asks for in `@page`, and this reads the stylesheet
    /// rather than restating it — changing one alone puts the export back on the
    /// mixed geometry that produced a 0.847-scale page.
    #[test]
    fn page_margin_matches_the_print_stylesheet() {
        let stylesheet = std::fs::read_to_string("../src/styles/print.scss").expect("print.scss is readable");
        let at_page = stylesheet
            .split_once("@page {")
            .expect("print.scss still has an @page rule")
            .1;
        let rule = at_page.split_once('}').expect("the @page rule is closed").0;
        let margin = rule
            .lines()
            .find_map(|line| line.trim().strip_prefix("margin:"))
            .expect("the @page rule still sets a margin")
            .trim()
            .trim_end_matches(';')
            .trim();
        let millimetres: f64 = margin
            .strip_suffix("mm")
            .unwrap_or_else(|| panic!("the @page margin is no longer written in mm: {margin}"))
            .parse()
            .expect("the @page margin is a number");

        assert_eq!(super::page_margin_points(), millimetres * 72.0 / 25.4);
    }
}
