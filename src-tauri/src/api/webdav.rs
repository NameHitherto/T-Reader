use crate::{
    entities::{CloudSyncApplyRequest, CloudSyncApplyResult, CloudSyncPreviewResult},
    service::webdav::{
        file_service::{
            webdav_delete_file, webdav_file_exists, webdav_get_file, webdav_upload_file,
        },
        sync_service,
    },
};

#[tauri::command]
pub async fn webdav_upload(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    webdav_upload_file(subdir, filename, contents).await
}

#[tauri::command]
pub async fn webdav_get(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    webdav_get_file(subdir, filename).await
}

#[tauri::command]
pub async fn webdav_exists(subdir: &str, filename: &str) -> Result<bool, String> {
    webdav_file_exists(subdir, filename).await
}

#[tauri::command]
pub async fn webdav_delete(subdir: &str, filename: &str) -> Result<(), String> {
    webdav_delete_file(subdir, filename).await
}

#[tauri::command]
pub async fn webdav_sync_files() -> Result<(), String> {
    sync_service::webdav_sync_files().await
}

#[tauri::command]
pub async fn webdav_get_sync_preview() -> Result<CloudSyncPreviewResult, String> {
    sync_service::webdav_get_sync_preview().await
}

#[tauri::command]
pub async fn webdav_apply_sync_plan(
    request: CloudSyncApplyRequest,
) -> Result<CloudSyncApplyResult, String> {
    sync_service::webdav_apply_sync_plan(request).await
}
