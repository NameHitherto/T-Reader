use tauri::{AppHandle, State};

use crate::entities::AiStreamState;
use crate::service::ai::stream_service;

#[tauri::command]
pub async fn start_stream(
    app: AppHandle,
    state: State<'_, AiStreamState>,
    request_id: String,
    system_prompt: String,
    messages: String,
) -> Result<(), String> {
    stream_service::start_stream(app, state, request_id, system_prompt, messages).await
}

#[tauri::command]
pub fn stop_stream(state: State<'_, AiStreamState>, request_id: String) -> Result<(), String> {
    stream_service::stop_stream(state, request_id)
}
