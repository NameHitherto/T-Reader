mod api;
mod command;
mod database;
mod entities;
mod repository;
mod service;
mod utils;

use entities::{AppUpdateState, ReaderWindowState};
use log::LevelFilter;
use service::window::main_window_service;
use service::window::reader_window_service;
use std::io;
use tauri::Manager;
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
        .manage(ReaderWindowState::default())
        .setup(|app| {
            let database_state = tauri::async_runtime::block_on(database::initialize_database())
                .map_err(io::Error::other)?;
            app.manage(database_state);

            main_window_service::create_main_window(app.handle())
                .map_err(|error| io::Error::other(error.to_string()))?;
            reader_window_service::precreate_reader_window(app.handle())
                .map_err(|error| io::Error::other(error.to_string()))?;
            Ok(())
        })
        .invoke_handler(command::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
