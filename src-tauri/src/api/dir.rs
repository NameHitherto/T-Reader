use crate::{
    entities::{CloudDirNames, LocalDirNames},
    service::{
        filesystem::{
            dir_service::{check_local_dirs, cloud_dir_names, local_dir_names},
            settings_service::load_settings_entity,
        },
        webdav::dir_service::ensure_cloud_dirs,
    },
};

#[tauri::command]
pub fn check_local_dirs_command() -> Result<String, String> {
    check_local_dirs()
}

#[tauri::command]
pub async fn check_cloud_dirs_command() -> Result<(), String> {
    let settings = load_settings_entity()?;
    ensure_cloud_dirs(&settings).await
}

#[tauri::command]
pub fn get_local_dir_names_command() -> LocalDirNames {
    local_dir_names()
}

#[tauri::command]
pub fn get_cloud_dir_names_command() -> CloudDirNames {
    cloud_dir_names()
}
