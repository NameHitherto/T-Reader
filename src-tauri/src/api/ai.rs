use tauri::AppHandle;

use crate::service::ai::stream_service;

#[tauri::command]
pub async fn start_stream(app: AppHandle, messages: String) -> Result<(), String> {
    stream_service::start_stream(app, messages).await
}
