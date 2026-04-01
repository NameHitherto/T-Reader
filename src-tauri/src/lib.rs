mod command;
mod logging;
mod model;

use command::{
    ack_reader_load,
    check_app_update, check_cloud_dirs_command, check_local_dirs_command, delete_book,
    close_reader_window, dispatch_reader_event, get_cloud_dir_names_command,
    get_local_dir_names_command, get_system_fonts, install_app_update, list_files, load_books,
    load_settings, open_reader_window, prepare_updater_proxy, read_file, read_file_by_path,
    reader_window_ready, save_file, save_settings, start_stream, webdav_delete, webdav_exists,
    webdav_get, webdav_sync_files, webdav_upload, write_file, AppUpdateState,
    ReaderWindowState,
};
#[cfg(not(debug_assertions))]
use command::dir::get_local_cached_dir;
use log::LevelFilter;
use logging::build_log_target;
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};

#[cfg(debug_assertions)]
fn build_log_targets() -> Result<Vec<Target>, String> {
    Ok(vec![build_log_target(TargetKind::Stdout)])
}

#[cfg(not(debug_assertions))]
fn build_log_targets() -> Result<Vec<Target>, String> {
    let log_dir = get_local_cached_dir()?;
    Ok(vec![build_log_target(TargetKind::Folder {
        path: log_dir,
        file_name: Some("t-reader".to_string()),
    })])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_targets = build_log_targets().expect("failed to configure log targets");

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .clear_format()
                .targets(log_targets)
                .max_file_size(1024 * 1024) // 1MB
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppUpdateState::default())
        .manage(ReaderWindowState::default())
        .invoke_handler(tauri::generate_handler![
            save_file,
            load_books,
            delete_book,
            read_file_by_path,
            read_file,
            write_file,
            list_files,
            webdav_upload,
            webdav_get,
            webdav_exists,
            webdav_delete,
            webdav_sync_files,
            save_settings,
            load_settings,
            start_stream,
            get_system_fonts,
            prepare_updater_proxy,
            check_app_update,
            install_app_update,
            check_local_dirs_command,
            check_cloud_dirs_command,
            get_local_dir_names_command,
            get_cloud_dir_names_command,
            open_reader_window,
            reader_window_ready,
            ack_reader_load,
            close_reader_window,
            dispatch_reader_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
