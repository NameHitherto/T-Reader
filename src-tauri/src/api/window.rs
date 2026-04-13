use serde_json::Value;
use tauri::{AppHandle, State};

use crate::{
    entities::{DispatchReaderEventResult, OpenReaderWindowResult, ReaderWindowState},
    service::window::reader_window_service,
};

#[tauri::command]
pub async fn open_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
    cfi: Option<String>,
) -> Result<OpenReaderWindowResult, String> {
    reader_window_service::open_reader_window(app, state, book_key, cfi).await
}

#[tauri::command]
pub fn reader_window_ready(state: State<'_, ReaderWindowState>) -> Result<(), String> {
    reader_window_service::reader_window_ready(state)
}

#[tauri::command]
pub fn ack_reader_load(
    state: State<'_, ReaderWindowState>,
    message_id: String,
) -> Result<(), String> {
    reader_window_service::ack_reader_load(state, message_id)
}

#[tauri::command]
pub fn close_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
) -> Result<(), String> {
    reader_window_service::close_reader_window(app, state)
}

#[tauri::command]
pub fn dispatch_reader_event(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    reader_window_service::dispatch_reader_event(app, state, event_name, payload)
}

#[tauri::command]
pub fn dispatch_main_event(
    app: AppHandle,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    reader_window_service::dispatch_main_event(app, event_name, payload)
}
