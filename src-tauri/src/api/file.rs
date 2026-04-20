use crate::service::filesystem::file_service::{
    convert_txt_to_epub as service_convert_txt_to_epub,
    copy_file_to_subdir as service_copy_file_to_subdir,
};

#[tauri::command]
pub fn copy_file_to_subdir(filepath: &str, subdir: &str, filename: &str) -> Result<(), String> {
    service_copy_file_to_subdir(filepath, subdir, filename)
}

#[tauri::command]
pub fn convert_txt_to_epub(filepath: &str, subdir: &str, filename: &str) -> Result<String, String> {
    service_convert_txt_to_epub(filepath, subdir, filename)
}
