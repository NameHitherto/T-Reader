use tauri::State;

use crate::{
    database::DatabaseState,
    entities::{
        ReaderStyleSettings, SaveAppSettingsRequest, SaveReaderStyleSettingsRequest, Settings,
    },
    repository::settings,
};

#[tauri::command]
pub async fn load_app_settings(database: State<'_, DatabaseState>) -> Result<Settings, String> {
    settings::load_app_settings(&database.pool).await
}

#[tauri::command]
pub async fn save_app_settings(
    database: State<'_, DatabaseState>,
    request: SaveAppSettingsRequest,
) -> Result<Settings, String> {
    settings::save_app_settings(&database.pool, request).await
}

#[tauri::command]
pub async fn load_reader_config(
    database: State<'_, DatabaseState>,
) -> Result<ReaderStyleSettings, String> {
    settings::load_reader_style_settings(&database.pool).await
}

#[tauri::command]
pub async fn save_reader_config(
    database: State<'_, DatabaseState>,
    request: SaveReaderStyleSettingsRequest,
) -> Result<ReaderStyleSettings, String> {
    settings::save_reader_style_settings(&database.pool, request).await
}
