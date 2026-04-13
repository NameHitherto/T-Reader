use crate::{entities::FontNameEntry, service::font::font_service};

#[tauri::command]
pub fn get_system_fonts() -> Vec<FontNameEntry> {
    font_service::get_system_fonts()
}
