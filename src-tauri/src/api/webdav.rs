use crate::{
    database::DatabaseState,
    entities::{CloudSyncApplyRequest, CloudSyncApplyResult, CloudSyncPreviewResult},
    service::webdav::{
        file_service::{
            webdav_delete_file, webdav_file_exists, webdav_get_file, webdav_upload_file,
        },
        sync_service,
    },
};
use tauri::State;

#[tauri::command]
pub async fn webdav_upload(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
    contents: Vec<u8>,
) -> Result<(), String> {
    webdav_upload_file(&database.pool, subdir, filename, contents).await
}

#[tauri::command]
pub async fn webdav_get(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<Vec<u8>, String> {
    webdav_get_file(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_exists(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<bool, String> {
    webdav_file_exists(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_delete(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<(), String> {
    webdav_delete_file(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_sync_files(database: State<'_, DatabaseState>) -> Result<(), String> {
    sync_service::webdav_sync_files(&database.pool).await
}

#[tauri::command]
pub async fn webdav_get_sync_preview(
    database: State<'_, DatabaseState>,
) -> Result<CloudSyncPreviewResult, String> {
    sync_service::webdav_get_sync_preview(&database.pool).await
}

#[tauri::command]
pub async fn webdav_apply_sync_plan(
    database: State<'_, DatabaseState>,
    request: CloudSyncApplyRequest,
) -> Result<CloudSyncApplyResult, String> {
    sync_service::webdav_apply_sync_plan(&database.pool, request).await
}
