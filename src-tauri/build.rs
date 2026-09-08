fn main() {
    // The unattended export is a build-time mode, the way the probe is: a build
    // without `MALLOW_UNATTENDED=1` contains none of it. A Cargo feature would
    // reach the same arms, but the frontend half of this mode is switched by a
    // Vite `define` reading the same variable, and one variable that both halves
    // read is what keeps them from being enabled apart.
    println!("cargo:rerun-if-env-changed=MALLOW_UNATTENDED");
    println!("cargo:rustc-check-cfg=cfg(unattended)");
    if std::env::var("MALLOW_UNATTENDED").as_deref() == Ok("1") {
        println!("cargo:rustc-cfg=unattended");
    }
    tauri_build::build()
}
