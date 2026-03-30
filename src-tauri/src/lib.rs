mod command;
mod logging;
mod model;

use command::{
    check_app_update, check_cloud_dirs_command, check_local_dirs_command, delete_book,
    get_cloud_dir_names_command, get_local_dir_names_command, get_system_fonts, install_app_update,
    list_files, load_books, load_settings, prepare_updater_proxy, read_file, read_file_by_path,
    save_file, save_settings, start_stream, webdav_delete, webdav_exists, webdav_get,
    webdav_sync_files, webdav_upload, write_file, AppUpdateState,
};
use log::LevelFilter;
use logging::build_log_target;
use tauri_plugin_log::{TargetKind, TimezoneStrategy};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .clear_format()
                .targets([
                    build_log_target(TargetKind::Stdout),
                    build_log_target(TargetKind::LogDir {
                        file_name: Some("t-reader".to_string()),
                    }),
                    build_log_target(TargetKind::Webview),
                ])
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
            get_cloud_dir_names_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
