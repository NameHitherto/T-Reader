use crate::{entities::FontNameEntry, service::font::font_service};
use crate::{
    entities::font::{DeleteLocalFontResult, ExtractedFontResult, LocalFontsResult},
    service::font::local_font_service,
};

#[tauri::command]
pub fn get_system_fonts() -> Vec<FontNameEntry> {
    font_service::get_system_fonts()
}

#[tauri::command]
pub async fn extract_epub_fonts(filename: String) -> Result<Vec<ExtractedFontResult>, String> {
    tauri::async_runtime::spawn_blocking(move || local_font_service::extract_epub_fonts(&filename))
        .await
        .map_err(|error| format!("提取字体任务失败: {error}"))?
}

#[tauri::command]
pub async fn get_local_fonts() -> Result<LocalFontsResult, String> {
    tauri::async_runtime::spawn_blocking(local_font_service::get_local_fonts)
        .await
        .map_err(|error| format!("扫描字体任务失败: {error}"))?
}

#[tauri::command]
pub async fn delete_local_font(filename: String) -> Result<DeleteLocalFontResult, String> {
    tauri::async_runtime::spawn_blocking(move || local_font_service::delete_local_font(&filename))
        .await
        .map_err(|error| format!("删除字体任务失败: {error}"))?
}
