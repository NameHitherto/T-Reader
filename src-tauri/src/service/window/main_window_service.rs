use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

use crate::utils::logging::log_info;

pub const MAIN_LABEL: &str = "main";

pub fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log_info("window", "main-window-creating");

    let window = WebviewWindowBuilder::new(app, MAIN_LABEL, WebviewUrl::App("index.html".into()))
        .title("书架")
        .inner_size(880.0, 660.0)
        .min_inner_size(880.0, 660.0)
        .decorations(false)
        .build()?;

    window.on_window_event(|event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            log_info("window", "main-window-close-requested");
        }
        if let tauri::WindowEvent::Destroyed = event {
            log_info("window", "main-window-destroyed");
        }
    });

    log_info("window", "main-window-created");
    log_info(
        "window",
        &format!("main-window-created-detail label={} size=880x660 decorations=false", MAIN_LABEL),
    );

    Ok(())
}
