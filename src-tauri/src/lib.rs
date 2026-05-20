mod api;
mod command;
mod entities;
mod repository;
mod service;
mod utils;

use entities::{AiStreamState, AppUpdateState, ReaderWindowState};
use log::LevelFilter;
use service::window::main_window_service;
use service::window::reader_window_service;
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use utils::logging::build_log_target;

#[cfg(debug_assertions)]
fn build_log_targets() -> Result<Vec<Target>, String> {
    Ok(vec![build_log_target(TargetKind::Stdout)])
}

#[cfg(not(debug_assertions))]
fn build_log_targets() -> Result<Vec<Target>, String> {
    let log_dir = service::filesystem::dir_service::get_local_logs_dir_path()?;
    Ok(vec![build_log_target(TargetKind::Folder {
        path: log_dir,
        file_name: Some("t-reader".to_string()),
    })])
}

pub fn run() {
    let log_targets = build_log_targets().expect("failed to configure log targets");

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .clear_format()
                .targets(log_targets)
                .max_file_size(1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["reader"])
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppUpdateState::default())
        .manage(AiStreamState::default())
        .manage(ReaderWindowState::default())
        .setup(|app| {
            main_window_service::create_main_window(app.handle())
                .expect("failed to create main window");
            reader_window_service::precreate_reader_window(app.handle())
                .expect("failed to pre-create reader window");
            Ok(())
        })
        .invoke_handler(command::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
