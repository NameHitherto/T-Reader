use crate::{
    database::DatabaseState,
    entities::font::{DeleteLocalFontResult, ExtractedFontResult, LocalFontsResult},
    repository::local_fonts,
    service::font::local_font_service,
};
use crate::{entities::FontNameEntry, service::font::font_service};
use tauri::State;

// 提取、设置侧扫描与删除按顺序更新文件和目录记录。
static FONT_CATALOG_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[tauri::command]
pub fn get_system_fonts() -> Vec<FontNameEntry> {
    font_service::get_system_fonts()
}

#[tauri::command]
pub async fn extract_epub_fonts(
    database: State<'_, DatabaseState>,
    filename: String,
) -> Result<Vec<ExtractedFontResult>, String> {
    let _guard = FONT_CATALOG_LOCK.lock().await;
    let results = tauri::async_runtime::spawn_blocking(move || {
        local_font_service::extract_epub_fonts(&filename)
    })
    .await
    .map_err(|error| format!("提取字体任务失败: {error}"))??;
    for result in &results {
        local_fonts::save_fonts(&database.pool, &result.fonts).await?;
    }
    Ok(results)
}

#[tauri::command]
pub async fn get_local_fonts(
    database: State<'_, DatabaseState>,
) -> Result<LocalFontsResult, String> {
    local_fonts::load_fonts(&database.pool).await
}

#[tauri::command]
pub async fn refresh_local_font_catalog(
    database: State<'_, DatabaseState>,
) -> Result<LocalFontsResult, String> {
    let _guard = FONT_CATALOG_LOCK.lock().await;
    let result = tauri::async_runtime::spawn_blocking(local_font_service::scan_local_fonts)
        .await
        .map_err(|error| format!("扫描字体任务失败: {error}"))??;
    local_fonts::replace_fonts(&database.pool, &result.fonts).await?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_local_font(
    database: State<'_, DatabaseState>,
    filename: String,
) -> Result<DeleteLocalFontResult, String> {
    let _guard = FONT_CATALOG_LOCK.lock().await;
    let file_to_delete = filename.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        local_font_service::delete_local_font(&file_to_delete)
    })
    .await
    .map_err(|error| format!("删除字体任务失败: {error}"))??;
    local_fonts::delete_font(&database.pool, &filename).await?;
    Ok(result)
}
