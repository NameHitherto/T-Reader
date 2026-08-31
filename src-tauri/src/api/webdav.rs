use crate::{
    database::DatabaseState,
    entities::{
        webdav_error::WebDavError, CloudSyncApplyRequest, CloudSyncApplyResult,
        CloudSyncPreviewResult, ReconcileProgressConfigsResult,
    },
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
) -> Result<(), WebDavError> {
    webdav_upload_file(&database.pool, subdir, filename, contents).await
}

#[tauri::command]
pub async fn webdav_get(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<Vec<u8>, WebDavError> {
    webdav_get_file(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_exists(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<bool, WebDavError> {
    webdav_file_exists(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_delete(
    database: State<'_, DatabaseState>,
    subdir: &str,
    filename: &str,
) -> Result<(), WebDavError> {
    webdav_delete_file(&database.pool, subdir, filename).await
}

#[tauri::command]
pub async fn webdav_sync_files(
    database: State<'_, DatabaseState>,
) -> Result<(), WebDavError> {
    sync_service::webdav_sync_files(&database.pool).await
}

#[tauri::command]
pub async fn webdav_get_sync_preview(
    database: State<'_, DatabaseState>,
) -> Result<CloudSyncPreviewResult, WebDavError> {
    sync_service::webdav_get_sync_preview(&database.pool).await
}

#[tauri::command]
pub async fn webdav_apply_sync_plan(
    database: State<'_, DatabaseState>,
    request: CloudSyncApplyRequest,
) -> Result<CloudSyncApplyResult, WebDavError> {
    sync_service::webdav_apply_sync_plan(&database.pool, request).await
}

#[tauri::command]
pub async fn webdav_reconcile_progress_configs(
    database: State<'_, DatabaseState>,
) -> Result<ReconcileProgressConfigsResult, WebDavError> {
    sync_service::webdav_reconcile_progress_configs(&database.pool).await
}
